import { PrismaPg } from "@prisma/adapter-pg";
import {
  SPEAKING_AI_CALLS_PER_DAY,
  SPEAKING_ATTEMPTS_PER_10_MIN,
  SPEAKING_ATTEMPTS_PER_DAY,
  SPEAKING_EVIDENCE,
  SPEAKING_MAX_EVENTS_PER_SESSION,
  SPEAKING_TITLE,
  SPEAKING_TRANSCRIPTIONS_PER_DAY,
  SPEAKING_WINDOW_MS,
  masteryBand,
  speakingEvidence,
} from "@platform/curriculum";
import type {
  SpeakingFeedback,
  SpeakingMode,
  SpeakingPractice,
  SpeakingSessionView,
} from "@platform/types";
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { writeSkillMasteryProjection } from "./progress-repository";
import { assertFeature, CommercialRuleError, readCommercialPlan } from "./commercial-access";

const PENDING_TTL_MS = 60_000;
const UNCLEAR_SPEECH = "Transkript qiymətləndirmək üçün kifayət etmədi.";

export class SpeakingRuleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SpeakingRuleError";
  }
}

export interface SpeakingTurnContext {
  mode: SpeakingMode;
  questionTitle: string;
  questionPrompt: string;
  conceptName: string;
  conceptId: string;
  masteryBand: string | null;
  misconception: string | null;
  priorAnswers: string[];
  locale: string;
  timeZone: string;
}

export interface SpeakingUsageWrite {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: bigint;
  latencyMs: number;
  correlationId: string;
  speakingAttemptId: string;
  taskType: "teach" | "interview";
}

export interface TranscriptionUsageWrite {
  provider: string;
  model: string;
  durationMs: number | null;
  latencyMs: number;
  costMicros: bigint;
  correlationId: string;
  speakingAttemptId: string;
}

export type SpeakingBegin =
  | { kind: "stored"; view: SpeakingSessionView }
  | { kind: "wait" }
  | { kind: "ready"; attemptId: string; context: SpeakingTurnContext }
  | { kind: "resume"; attemptId: string; transcript: string; context: SpeakingTurnContext };

export interface SpeakingRepository {
  practice(userId: string): Promise<SpeakingPractice>;
  start(input: { userId: string; mode: SpeakingMode; now: Date }): Promise<SpeakingSessionView>;
  getSession(userId: string, sessionId: string): Promise<SpeakingSessionView | null>;
  abandon(input: { userId: string; sessionId: string; now: Date }): Promise<SpeakingSessionView>;
  beginAttempt(input: {
    userId: string;
    sessionId: string;
    clientAttemptId: string;
    now: Date;
    audio: boolean;
  }): Promise<SpeakingBegin>;
  releaseAttempt(attemptId: string): Promise<void>;
  saveTranscript(attemptId: string, transcript: string): Promise<void>;
  markEvaluationFailed(attemptId: string): Promise<void>;
  markUnclear(input: {
    userId: string;
    sessionId: string;
    attemptId: string;
    transcript: string;
    now: Date;
  }): Promise<SpeakingSessionView>;
  recordTranscription(userId: string, usage: TranscriptionUsageWrite): Promise<void>;
  finishAttempt(input: {
    userId: string;
    sessionId: string;
    attemptId: string;
    transcript: string;
    understanding: "unknown" | "incorrect" | "partial" | "correct";
    speech: string;
    feedback: string;
    strengths: string[];
    issues: string[];
    now: Date;
    timeZone: string;
    usage: SpeakingUsageWrite;
  }): Promise<SpeakingSessionView>;
  disconnect(): Promise<void>;
}

export function createSpeakingRepository(databaseUrl: string): SpeakingRepository {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  return new PrismaSpeakingRepository(prisma);
}

class PrismaSpeakingRepository implements SpeakingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async practice(userId: string): Promise<SpeakingPractice> {
    const [questionCount, active] = await Promise.all([
      this.prisma.speakingQuestion.count({ where: { published: true } }),
      this.prisma.speakingSession.findFirst({
        where: { userId, status: "active" },
        select: { id: true },
      }),
    ]);
    return {
      title: SPEAKING_TITLE,
      description: "Qısa proqramlaşdırma sualına danışaraq və ya yazaraq cavab verin.",
      questionCount,
      activeSessionId: active?.id ?? null,
    };
  }

  async start(input: {
    userId: string;
    mode: SpeakingMode;
    now: Date;
  }): Promise<SpeakingSessionView> {
    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, input.userId);
      const active = await tx.speakingSession.findFirst({
        where: { userId: input.userId, status: "active" },
      });
      if (active !== null) {
        if (active.mode !== input.mode) {
          throw new SpeakingRuleError(
            409,
            "SPEAKING_ACTIVE",
            "A speaking practice is already open.",
          );
        }
        const view = await sessionView(tx, input.userId, active.id);
        if (view === null) {
          throw new SpeakingRuleError(404, "NOT_FOUND", "That speaking practice was not found.");
        }
        return view;
      }
      await assertSpeakingFeature(tx, input.userId, input.now);
      const first = await tx.speakingQuestion.findFirst({
        where: { published: true },
        orderBy: { position: "asc" },
      });
      if (first === null) {
        throw new SpeakingRuleError(404, "NOT_FOUND", "That speaking practice was not found.");
      }
      const created = await tx.speakingSession.create({
        data: {
          userId: input.userId,
          mode: input.mode,
          status: "active",
          currentQuestionId: first.id,
          startedAt: input.now,
        },
      });
      const view = await sessionView(tx, input.userId, created.id);
      if (view === null) {
        throw new SpeakingRuleError(404, "NOT_FOUND", "That speaking practice was not found.");
      }
      return view;
    });
  }

  async getSession(userId: string, sessionId: string): Promise<SpeakingSessionView | null> {
    return sessionView(this.prisma, userId, sessionId);
  }

  async abandon(input: {
    userId: string;
    sessionId: string;
    now: Date;
  }): Promise<SpeakingSessionView> {
    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, input.userId);
      const session = await tx.speakingSession.findFirst({
        where: { id: input.sessionId, userId: input.userId },
      });
      if (session === null) {
        throw new SpeakingRuleError(404, "NOT_FOUND", "That speaking practice was not found.");
      }
      if (session.status === "completed") {
        throw new SpeakingRuleError(409, "SPEAKING_CLOSED", "This speaking practice is closed.");
      }
      if (session.status === "active") {
        await tx.speakingSession.update({
          where: { id: session.id },
          data: { status: "abandoned", completedAt: input.now, currentQuestionId: null },
        });
      }
      const view = await sessionView(tx, input.userId, session.id);
      if (view === null) {
        throw new SpeakingRuleError(404, "NOT_FOUND", "That speaking practice was not found.");
      }
      return view;
    });
  }

  async beginAttempt(input: {
    userId: string;
    sessionId: string;
    clientAttemptId: string;
    now: Date;
    audio: boolean;
  }): Promise<SpeakingBegin> {
    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, input.userId);
      const session = await tx.speakingSession.findFirst({
        where: { id: input.sessionId, userId: input.userId },
      });
      if (session === null) {
        throw new SpeakingRuleError(404, "NOT_FOUND", "That speaking practice was not found.");
      }
      await tx.$queryRaw`SELECT id FROM speaking_sessions WHERE id = CAST(${session.id} AS uuid) FOR UPDATE`;
      if (session.status !== "active" || session.currentQuestionId === null) {
        throw new SpeakingRuleError(409, "SPEAKING_CLOSED", "This speaking practice is closed.");
      }
      const existing = await tx.speakingAttempt.findUnique({
        where: {
          sessionId_clientAttemptId: {
            sessionId: session.id,
            clientAttemptId: input.clientAttemptId,
          },
        },
      });
      if (existing !== null) {
        if (existing.status === "completed" || existing.status === "unclear") {
          const view = await sessionView(tx, input.userId, session.id);
          if (view === null) {
            throw new SpeakingRuleError(404, "NOT_FOUND", "That speaking practice was not found.");
          }
          return { kind: "stored", view };
        }
        if (existing.status === "transcribed") {
          return {
            kind: "resume",
            attemptId: existing.id,
            transcript: existing.transcript,
            context: await turnContext(tx, session, existing.questionId),
          };
        }
        if (input.now.getTime() - existing.createdAt.getTime() > PENDING_TTL_MS) {
          await tx.speakingAttempt.delete({ where: { id: existing.id } });
        } else {
          return { kind: "wait" };
        }
      }
      const user = await tx.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: { timezone: true },
      });
      await assertCapacity(tx, input.userId, user.timezone, input.now, input.audio);
      const sequence = await tx.speakingAttempt.count({ where: { sessionId: session.id } });
      try {
        const created = await tx.speakingAttempt.create({
          data: {
            sessionId: session.id,
            questionId: session.currentQuestionId,
            userId: input.userId,
            clientAttemptId: input.clientAttemptId,
            sequence: sequence + 1,
            status: "pending",
          },
        });
        return {
          kind: "ready",
          attemptId: created.id,
          context: await turnContext(tx, session, session.currentQuestionId),
        };
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return { kind: "wait" };
        }
        throw error;
      }
    });
  }

  async releaseAttempt(attemptId: string): Promise<void> {
    await this.prisma.speakingAttempt.deleteMany({
      where: { id: attemptId, status: "pending" },
    });
  }

  async saveTranscript(attemptId: string, transcript: string): Promise<void> {
    await this.prisma.speakingAttempt.updateMany({
      where: { id: attemptId, status: "pending" },
      data: { transcript },
    });
  }

  async markEvaluationFailed(attemptId: string): Promise<void> {
    await this.prisma.speakingAttempt.updateMany({
      where: { id: attemptId, status: "pending" },
      data: { status: "transcribed" },
    });
  }

  async markUnclear(input: {
    userId: string;
    sessionId: string;
    attemptId: string;
    transcript: string;
    now: Date;
  }): Promise<SpeakingSessionView> {
    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, input.userId);
      await tx.speakingAttempt.updateMany({
        where: { id: input.attemptId, status: { in: ["pending", "transcribed"] } },
        data: {
          status: "unclear",
          transcript: input.transcript,
          speech: UNCLEAR_SPEECH,
          feedback: "Yenidən qısa danışın və ya cavabı yazın.",
          understanding: null,
        },
      });
      await countAttempt(tx, input.userId, input.now);
      const view = await sessionView(tx, input.userId, input.sessionId);
      if (view === null) {
        throw new SpeakingRuleError(404, "NOT_FOUND", "That speaking practice was not found.");
      }
      return view;
    });
  }

  async finishAttempt(input: {
    userId: string;
    sessionId: string;
    attemptId: string;
    transcript: string;
    understanding: "unknown" | "incorrect" | "partial" | "correct";
    speech: string;
    feedback: string;
    strengths: string[];
    issues: string[];
    now: Date;
    timeZone: string;
    usage: SpeakingUsageWrite;
  }): Promise<SpeakingSessionView> {
    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, input.userId);
      const session = await tx.speakingSession.findFirst({
        where: { id: input.sessionId, userId: input.userId },
      });
      if (session === null || session.currentQuestionId === null || session.status !== "active") {
        throw new SpeakingRuleError(409, "SPEAKING_CLOSED", "This speaking practice is closed.");
      }
      const attempt = await tx.speakingAttempt.findFirst({
        where: {
          id: input.attemptId,
          sessionId: session.id,
          status: { in: ["pending", "transcribed"] },
        },
      });
      if (attempt === null) {
        const view = await sessionView(tx, input.userId, session.id);
        if (view === null) {
          throw new SpeakingRuleError(404, "NOT_FOUND", "That speaking practice was not found.");
        }
        return view;
      }
      const evidence = speakingEvidence(input.understanding);
      await tx.speakingAttempt.update({
        where: { id: attempt.id },
        data: {
          status: "completed",
          transcript: input.transcript,
          understanding: input.understanding,
          speech: input.speech,
          feedback: input.feedback,
          strengths: input.strengths,
          issues: input.issues,
        },
      });
      await tx.aiUsage.create({
        data: {
          userId: input.userId,
          sessionId: null,
          taskType: input.usage.taskType,
          provider: input.usage.provider,
          model: input.usage.model,
          inputTokens: input.usage.inputTokens,
          outputTokens: input.usage.outputTokens,
          costMicros: input.usage.costMicros,
          latencyMs: input.usage.latencyMs,
          cached: false,
          correlationId: input.usage.correlationId,
          speakingAttemptId: input.usage.speakingAttemptId,
        },
      });
      await countAttempt(tx, input.userId, input.now);
      if (evidence !== null) {
        await writeSpeakingEvent(tx, {
          userId: input.userId,
          sessionId: session.id,
          attemptId: attempt.id,
          conceptId: (
            await tx.speakingQuestion.findUniqueOrThrow({ where: { id: attempt.questionId } })
          ).conceptId,
          now: input.now,
          timeZone: input.timeZone,
        });
      }
      const next = await tx.speakingQuestion.findFirst({
        where: {
          published: true,
          position: { gt: await questionPosition(tx, attempt.questionId) },
        },
        orderBy: { position: "asc" },
      });
      await tx.speakingSession.update({
        where: { id: session.id },
        data:
          next === null
            ? {
                status: "completed",
                completedAt: input.now,
                currentQuestionId: null,
                aiCalls: { increment: 1 },
              }
            : {
                currentQuestionId: next.id,
                aiCalls: { increment: 1 },
              },
      });
      const view = await sessionView(tx, input.userId, session.id);
      if (view === null) {
        throw new SpeakingRuleError(404, "NOT_FOUND", "That speaking practice was not found.");
      }
      return view;
    });
  }

  async recordTranscription(userId: string, usage: TranscriptionUsageWrite): Promise<void> {
    await writeTranscription(this.prisma, userId, usage);
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

async function questionPosition(tx: Prisma.TransactionClient, questionId: string): Promise<number> {
  const question = await tx.speakingQuestion.findUniqueOrThrow({ where: { id: questionId } });
  return question.position;
}

async function writeSpeakingEvent(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    sessionId: string;
    attemptId: string;
    conceptId: string;
    now: Date;
    timeZone: string;
  },
): Promise<void> {
  const existing = await tx.learningEvent.findFirst({
    where: { userId: input.userId, source: "speaking", sourceId: input.attemptId },
  });
  if (existing !== null) {
    return;
  }
  const attempts = await tx.speakingAttempt.findMany({
    where: { sessionId: input.sessionId },
    select: { id: true },
  });
  const written = await tx.learningEvent.count({
    where: {
      userId: input.userId,
      source: "speaking",
      sourceId: { in: attempts.map((attempt) => attempt.id) },
    },
  });
  if (written >= SPEAKING_MAX_EVENTS_PER_SESSION) {
    return;
  }
  await tx.learningEvent.create({
    data: {
      userId: input.userId,
      conceptId: input.conceptId,
      source: "speaking",
      sourceId: input.attemptId,
      evidence: SPEAKING_EVIDENCE,
      weight: 1,
      metadata: { outcome: "speaking" },
    },
  });
  await writeSkillMasteryProjection(tx, {
    userId: input.userId,
    conceptId: input.conceptId,
    now: input.now,
    timeZone: input.timeZone,
  });
}

async function assertSpeakingFeature(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<void> {
  const commercial = await readCommercialPlan(tx, userId, now);
  if (commercial === null) {
    return;
  }
  try {
    assertFeature(commercial, "speaking");
  } catch (error) {
    if (error instanceof CommercialRuleError) {
      throw new SpeakingRuleError(error.status, error.code, error.message);
    }
    throw error;
  }
}

async function assertCapacity(
  tx: Prisma.TransactionClient,
  userId: string,
  timeZone: string,
  now: Date,
  audio: boolean,
): Promise<void> {
  const commercial = await readCommercialPlan(tx, userId, now);
  if (commercial !== null) {
    try {
      assertFeature(commercial, "speaking");
    } catch (error) {
      if (error instanceof CommercialRuleError) {
        throw new SpeakingRuleError(error.status, error.code, error.message);
      }
      throw error;
    }
  }
  const dailyAttempts = commercial?.entitlements.dailySpeakingAttempts ?? SPEAKING_ATTEMPTS_PER_DAY;
  const dailyAi = commercial?.entitlements.dailySpeakingAi ?? SPEAKING_AI_CALLS_PER_DAY;
  const dailyTranscriptions =
    commercial?.entitlements.dailyTranscriptions ?? SPEAKING_TRANSCRIPTIONS_PER_DAY;
  const windowStart = new Date(Math.floor(now.getTime() / SPEAKING_WINDOW_MS) * SPEAKING_WINDOW_MS);
  const recent = await tx.authRateBucket.findUnique({
    where: {
      action_subjectHash_windowStart: {
        action: "speaking_attempt",
        subjectHash: userId,
        windowStart,
      },
    },
  });
  if ((recent?.hits ?? 0) >= SPEAKING_ATTEMPTS_PER_10_MIN) {
    throw new SpeakingRuleError(429, "RATE_LIMITED", "Speaking practice is temporarily limited.");
  }
  const day = await dayStart(tx, timeZone);
  const attempts = await tx.speakingAttempt.count({
    where: {
      userId,
      status: { in: ["completed", "unclear", "transcribed"] },
      createdAt: { gte: day },
    },
  });
  if (attempts >= dailyAttempts) {
    throw new SpeakingRuleError(
      429,
      "QUOTA_EXCEEDED",
      "The speaking quota for this plan is reached.",
    );
  }
  const aiCalls = await tx.speakingAttempt.count({
    where: { userId, status: "completed", createdAt: { gte: day } },
  });
  if (aiCalls >= dailyAi) {
    throw new SpeakingRuleError(
      429,
      "QUOTA_EXCEEDED",
      "The speaking quota for this plan is reached.",
    );
  }
  if (audio) {
    const transcriptions = await tx.transcriptionUsage.count({
      where: { userId, createdAt: { gte: day } },
    });
    if (transcriptions >= dailyTranscriptions) {
      throw new SpeakingRuleError(
        429,
        "QUOTA_EXCEEDED",
        "The speaking quota for this plan is reached.",
      );
    }
  }
}

async function countAttempt(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<void> {
  const windowStart = new Date(Math.floor(now.getTime() / SPEAKING_WINDOW_MS) * SPEAKING_WINDOW_MS);
  await tx.authRateBucket.upsert({
    where: {
      action_subjectHash_windowStart: {
        action: "speaking_attempt",
        subjectHash: userId,
        windowStart,
      },
    },
    create: { action: "speaking_attempt", subjectHash: userId, windowStart, hits: 1 },
    update: { hits: { increment: 1 } },
  });
}

async function writeTranscription(
  tx: Prisma.TransactionClient | PrismaClient,
  userId: string,
  usage: TranscriptionUsageWrite,
): Promise<void> {
  await tx.transcriptionUsage.create({
    data: {
      userId,
      provider: usage.provider,
      model: usage.model,
      durationMs: usage.durationMs,
      status: "completed",
      latencyMs: usage.latencyMs,
      costMicros: usage.costMicros,
      correlationId: usage.correlationId,
      speakingAttemptId: usage.speakingAttemptId,
    },
  });
}

async function dayStart(tx: Prisma.TransactionClient, timeZone: string): Promise<Date> {
  const rows = await tx.$queryRaw<Array<{ start: Date }>>`
    SELECT (date_trunc('day', now() AT TIME ZONE ${timeZone}) AT TIME ZONE ${timeZone}) AS start
  `;
  return rows[0]?.start ?? new Date();
}

async function turnContext(
  tx: Prisma.TransactionClient,
  session: { id: string; userId: string; mode: SpeakingMode },
  questionId: string,
): Promise<SpeakingTurnContext> {
  const question = await tx.speakingQuestion.findUniqueOrThrow({
    where: { id: questionId },
    include: { concept: true },
  });
  const user = await tx.user.findUniqueOrThrow({
    where: { id: session.userId },
    select: { locale: true, timezone: true },
  });
  const mastery = await tx.skillMastery.findUnique({
    where: { userId_conceptId: { userId: session.userId, conceptId: question.conceptId } },
  });
  const band = mastery === null ? null : masteryBand(mastery.score, mastery.evidenceCount);
  const misconception = await tx.misconception.findFirst({
    where: { userId: session.userId, conceptId: question.conceptId },
    orderBy: { lastSeenAt: "desc" },
  });
  const prior = await tx.speakingAttempt.findMany({
    where: { sessionId: session.id, status: "completed" },
    orderBy: { sequence: "desc" },
    take: 2,
  });
  return {
    mode: session.mode,
    questionTitle: question.title,
    questionPrompt: question.prompt,
    conceptName: question.concept.name,
    conceptId: question.conceptId,
    masteryBand: band,
    misconception: misconception?.description.slice(0, 200) ?? null,
    priorAnswers: prior.map((attempt) => attempt.transcript.slice(0, 400)).reverse(),
    locale: user.locale,
    timeZone: user.timezone,
  };
}

async function sessionView(
  db: Prisma.TransactionClient | PrismaClient,
  userId: string,
  sessionId: string,
): Promise<SpeakingSessionView | null> {
  const session = await db.speakingSession.findFirst({
    where: { id: sessionId, userId },
    include: { currentQuestion: true },
  });
  if (session === null) {
    return null;
  }
  const published = await db.speakingQuestion.count({ where: { published: true } });
  const latest = await db.speakingAttempt.findFirst({
    where: { sessionId: session.id, status: { in: ["completed", "unclear"] } },
    orderBy: { sequence: "desc" },
  });
  const question =
    session.currentQuestion === null || !session.currentQuestion.published
      ? null
      : {
          title: session.currentQuestion.title,
          prompt: session.currentQuestion.prompt,
          position: session.currentQuestion.position,
          total: published,
        };
  return {
    id: session.id,
    mode: session.mode,
    status: session.status,
    question,
    feedback: latest === null ? null : feedbackOf(latest),
    nextAction: nextAction(session.status, latest?.status ?? null),
  };
}

function feedbackOf(attempt: {
  status: "pending" | "transcribed" | "completed" | "unclear";
  transcript: string;
  speech: string;
  feedback: string;
  understanding: "unknown" | "incorrect" | "partial" | "correct" | null;
  strengths: Prisma.JsonValue;
  issues: Prisma.JsonValue;
}): SpeakingFeedback {
  return {
    transcript: attempt.transcript,
    speech: attempt.speech,
    feedback: attempt.feedback,
    understanding: attempt.status === "unclear" ? "unclear" : (attempt.understanding ?? "unknown"),
    strengths: stringList(attempt.strengths),
    issues: stringList(attempt.issues),
  };
}

function stringList(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function nextAction(
  status: "active" | "completed" | "abandoned",
  attempt: "pending" | "transcribed" | "completed" | "unclear" | null,
): string | null {
  if (status === "abandoned") {
    return "Bu məşq dayandırılıb.";
  }
  if (status === "completed") {
    return "Məşq bitdi. Dərsə qayıdın.";
  }
  if (attempt === "unclear") {
    return "Yenidən qısa danışın və ya cavabı yazın.";
  }
  if (attempt === "completed") {
    return "Növbəti sual hazırdır.";
  }
  return null;
}

async function lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM users WHERE id = CAST(${userId} AS uuid) FOR UPDATE`;
}
