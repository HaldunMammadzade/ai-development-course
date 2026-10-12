import { PrismaPg } from "@prisma/adapter-pg";
import {
  INTERVIEW_WEEK_MS,
  MAX_ACTIVE_INTERVIEWS,
  MAX_AI_CALLS_PER_INTERVIEW,
  MAX_COMPLETED_PER_DAY,
  MAX_INTERVIEWS_PER_WEEK,
  MAX_LEARNING_EVENTS,
  UNLOCK_MASTERY,
  blendFollowUp,
  decideInterviewStep,
  finalInterviewScore,
  interviewBand,
  interviewHiddenLiterals,
  learningEvidence,
  masteryBand,
} from "@platform/curriculum";
import { EXECUTION_LIMITS } from "@platform/execution";
import type {
  ExecutionConfig,
  InterviewBand,
  InterviewDetail,
  InterviewHistoryItem,
  InterviewQuestionView,
  InterviewReportView,
  InterviewSessionView,
  InterviewSummary,
} from "@platform/types";
import { executionConfigSchema } from "@platform/validation";
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { writeSkillMasteryProjection } from "./progress-repository";
import { assertFeature, CommercialRuleError, readCommercialPlan } from "./commercial-access";

const PENDING_TTL_MS = 60_000;

export class InterviewRuleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "InterviewRuleError";
  }
}

export interface InterviewTurnContext {
  answerId: string;
  sessionId: string;
  questionId: string;
  interviewTitle: string;
  questionTitle: string;
  questionPrompt: string;
  questionType: "verbal" | "code";
  difficulty: string;
  conceptName: string;
  execution: ExecutionConfig | null;
  hiddenLiterals: string[];
  studentText: string;
  studentCode: string | null;
  priorAnswers: string[];
  masteryBand: string | null;
  misconception: string | null;
  locale: string;
  timeZone: string;
}

export type InterviewBegin =
  | { kind: "stored"; session: InterviewSessionView }
  | { kind: "wait" }
  | { kind: "ready"; turn: InterviewTurnContext };

export interface InterviewFinish {
  userId: string;
  sessionId: string;
  answerId: string;
  understanding: "unknown" | "incorrect" | "partial" | "correct";
  reasoning: "weak" | "developing" | "strong";
  evidence: number;
  executionScore: number | null;
  speech: string;
  feedback: string;
  strengths: string[];
  issues: string[];
  followUpRecommended: boolean;
  now: Date;
  timeZone: string;
  usage: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costMicros: bigint;
    latencyMs: number;
    correlationId: string;
  };
}

export interface InterviewRepository {
  list(userId: string): Promise<InterviewSummary[]>;
  open(userId: string, slug: string): Promise<InterviewDetail | null>;
  start(userId: string, slug: string, now: Date): Promise<InterviewSessionView>;
  getSession(userId: string, sessionId: string): Promise<InterviewSessionView | null>;
  report(userId: string, sessionId: string): Promise<InterviewReportView | null>;
  abandon(userId: string, sessionId: string): Promise<InterviewSessionView>;
  beginAnswer(input: {
    userId: string;
    sessionId: string;
    clientAnswerId: string;
    text: string;
    code: string | null;
    now: Date;
  }): Promise<InterviewBegin>;
  releaseAnswer(input: {
    userId: string;
    sessionId: string;
    questionId: string;
    answerId: string;
    clientAnswerId: string;
  }): Promise<void>;
  finishAnswer(input: InterviewFinish): Promise<InterviewSessionView>;
  prepareExecution(input: {
    userId: string;
    sessionId: string;
    questionId: string;
    clientAnswerId: string;
    now: Date;
  }): Promise<"claimed" | "busy">;
  releaseExecution(input: {
    userId: string;
    sessionId: string;
    questionId: string;
    clientAnswerId: string;
  }): Promise<void>;
  findCompleted(
    userId: string,
    sessionId: string,
    clientAnswerId: string,
  ): Promise<InterviewSessionView | null>;
  isPending(userId: string, sessionId: string, clientAnswerId: string): Promise<boolean>;
  disconnect(): Promise<void>;
}

export function createInterviewRepository(databaseUrl: string): InterviewRepository {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  return new PrismaInterviewRepository(prisma);
}

class PrismaInterviewRepository implements InterviewRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string): Promise<InterviewSummary[]> {
    const rows = await this.prisma.interview.findMany({
      where: { status: "published" },
      orderBy: { title: "asc" },
      include: {
        requirements: { select: { conceptId: true } },
        questions: { where: { status: "published", parentId: null }, select: { id: true } },
      },
    });
    const scores = await this.mastery(userId);
    return rows
      .filter((row) => eligible(row.requirements, scores))
      .map((row) => ({
        slug: row.slug,
        title: row.title,
        description: row.description,
        estimatedMinutes: row.estimatedMinutes,
        questionCount: row.questions.length,
      }));
  }

  async open(userId: string, slug: string): Promise<InterviewDetail | null> {
    const row = await this.published(slug);
    if (
      row === null ||
      row.status !== "published" ||
      !eligible(row.requirements, await this.mastery(userId))
    ) {
      return null;
    }
    const sessions = await this.prisma.interviewSession.findMany({
      where: { userId, interviewId: row.id },
      orderBy: { startedAt: "desc" },
      take: 20,
    });
    return {
      slug: row.slug,
      title: row.title,
      description: row.description,
      objective: row.objective,
      estimatedMinutes: row.estimatedMinutes,
      questionCount: row.questions.filter(
        (question) => question.status === "published" && question.parentId === null,
      ).length,
      activeSessionId: sessions.find((session) => session.status === "active")?.id ?? null,
      history: sessions.map(historyItem),
    };
  }

  async start(userId: string, slug: string, now: Date): Promise<InterviewSessionView> {
    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const interview = await tx.interview.findUnique({
        where: { slug },
        include: { requirements: { select: { conceptId: true } }, questions: true },
      });
      if (
        interview === null ||
        interview.status !== "published" ||
        !eligible(interview.requirements, await masteryMap(tx, userId))
      ) {
        throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
      }
      const active = await tx.interviewSession.count({ where: { userId, status: "active" } });
      if (active >= MAX_ACTIVE_INTERVIEWS) {
        throw new InterviewRuleError(409, "INTERVIEW_ACTIVE", "An interview is already open.");
      }
      const commercial = await readCommercialPlan(tx, userId, now);
      if (commercial !== null) {
        try {
          assertFeature(commercial, "interviews");
        } catch (error) {
          if (error instanceof CommercialRuleError) {
            throw new InterviewRuleError(error.status, error.code, error.message);
          }
          throw error;
        }
      }
      const user = await tx.user.findUnique({ where: { id: userId }, select: { timezone: true } });
      const completedToday = await completedOnDay(tx, userId, user?.timezone ?? "UTC", now);
      const dailyCap = commercial?.entitlements.dailyInterviews ?? MAX_COMPLETED_PER_DAY;
      if (completedToday >= dailyCap) {
        throw new InterviewRuleError(
          429,
          "QUOTA_EXCEEDED",
          "The interview quota for this plan is reached.",
        );
      }
      await consumeWeek(
        tx,
        userId,
        now,
        commercial?.entitlements.weeklyInterviewStarts ?? MAX_INTERVIEWS_PER_WEEK,
      );
      const first = interview.questions
        .filter((question) => question.status === "published" && question.parentId === null)
        .sort((left, right) => left.position - right.position)[0];
      if (first === undefined) {
        throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
      }
      const session = await tx.interviewSession.create({
        data: {
          userId,
          interviewId: interview.id,
          currentQuestionId: first.id,
          startedAt: now,
        },
      });
      const view = await sessionView(tx, userId, session.id);
      if (view === null) {
        throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
      }
      return view;
    });
  }

  async getSession(userId: string, sessionId: string): Promise<InterviewSessionView | null> {
    return sessionView(this.prisma, userId, sessionId);
  }

  async report(userId: string, sessionId: string): Promise<InterviewReportView | null> {
    const view = await sessionView(this.prisma, userId, sessionId);
    return view?.report ?? null;
  }

  async abandon(userId: string, sessionId: string): Promise<InterviewSessionView> {
    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const session = await lockedSession(tx, userId, sessionId);
      if (session.status === "completed") {
        throw new InterviewRuleError(
          409,
          "INTERVIEW_CLOSED",
          "That interview is already finished.",
        );
      }
      if (session.status === "active") {
        await tx.interviewSession.update({
          where: { id: sessionId },
          data: { status: "abandoned" },
        });
      }
      const view = await sessionView(tx, userId, sessionId);
      if (view === null) {
        throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
      }
      return view;
    });
  }

  async beginAnswer(input: {
    userId: string;
    sessionId: string;
    clientAnswerId: string;
    text: string;
    code: string | null;
    now: Date;
  }): Promise<InterviewBegin> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockUser(tx, input.userId);
        const session = await lockedSession(tx, input.userId, input.sessionId);
        if (session.status !== "active" || session.currentQuestionId === null) {
          throw new InterviewRuleError(409, "INTERVIEW_CLOSED", "That interview is closed.");
        }
        const existing = await tx.interviewAnswer.findUnique({
          where: {
            sessionId_clientAnswerId: {
              sessionId: input.sessionId,
              clientAnswerId: input.clientAnswerId,
            },
          },
        });
        if (existing?.status === "completed") {
          const stored = await sessionView(tx, input.userId, input.sessionId);
          if (stored === null) {
            throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
          }
          return { kind: "stored", session: stored };
        }
        if (existing?.status === "pending") {
          if (existing.createdAt.getTime() >= input.now.getTime() - PENDING_TTL_MS) {
            return { kind: "wait" };
          }
          await tx.interviewAnswer.delete({ where: { id: existing.id } });
        }
        const otherPending = await tx.interviewAnswer.findFirst({
          where: { sessionId: input.sessionId, status: "pending" },
        });
        if (otherPending !== null) {
          if (otherPending.createdAt.getTime() < input.now.getTime() - PENDING_TTL_MS) {
            await tx.interviewAnswer.delete({ where: { id: otherPending.id } });
          } else {
            throw new InterviewRuleError(
              409,
              "INTERVIEW_BUSY",
              "An answer is already being reviewed.",
            );
          }
        }
        if (session.aiCalls >= MAX_AI_CALLS_PER_INTERVIEW) {
          throw new InterviewRuleError(
            429,
            "RATE_LIMITED",
            "The interview review limit was reached.",
          );
        }
        const question = await tx.interviewQuestion.findUnique({
          where: { id: session.currentQuestionId },
          include: { concept: true },
        });
        if (question === null || question.status !== "published") {
          throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
        }
        const code = input.code?.trim() ? input.code : null;
        if (question.type === "code" && code === null) {
          throw new InterviewRuleError(400, "VALIDATION", "This question needs code.");
        }
        if (question.type === "verbal" && code !== null) {
          throw new InterviewRuleError(400, "VALIDATION", "This question does not take code.");
        }
        if (input.text.trim().length === 0) {
          throw new InterviewRuleError(400, "VALIDATION", "The answer is empty.");
        }
        const execution = readExecution(question.execution);
        const sequence = await tx.interviewAnswer.count({ where: { sessionId: input.sessionId } });
        const answer = await tx.interviewAnswer.create({
          data: {
            sessionId: input.sessionId,
            questionId: question.id,
            userId: input.userId,
            clientAnswerId: input.clientAnswerId,
            sequence: sequence + 1,
            text: input.text,
            code,
          },
        });
        const prior = await tx.interviewAnswer.findMany({
          where: { sessionId: input.sessionId, status: "completed" },
          orderBy: { sequence: "desc" },
          take: 2,
          select: { text: true },
        });
        const mastery = await tx.skillMastery.findUnique({
          where: { userId_conceptId: { userId: input.userId, conceptId: question.conceptId } },
        });
        const mistake = await tx.misconception.findFirst({
          where: { userId: input.userId, conceptId: question.conceptId, status: "active" },
          orderBy: { lastSeenAt: "desc" },
          select: { description: true },
        });
        const user = await tx.user.findUnique({
          where: { id: input.userId },
          select: { locale: true, timezone: true },
        });
        return {
          kind: "ready",
          turn: {
            answerId: answer.id,
            sessionId: input.sessionId,
            questionId: question.id,
            interviewTitle: session.interview.title,
            questionTitle: question.title,
            questionPrompt: question.prompt,
            questionType: question.type,
            difficulty: question.difficulty,
            conceptName: question.concept.name,
            execution,
            hiddenLiterals: interviewHiddenLiterals(execution),
            studentText: input.text,
            studentCode: code,
            priorAnswers: prior.map((item) => item.text).reverse(),
            masteryBand:
              mastery === null ? null : masteryBand(mastery.score, mastery.evidenceCount),
            misconception: mistake === null ? null : mistake.description.slice(0, 200),
            locale: localeLabel(user?.locale),
            timeZone: user?.timezone ?? "UTC",
          },
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { kind: "wait" };
      }
      throw error;
    }
  }

  async releaseAnswer(input: {
    userId: string;
    sessionId: string;
    questionId: string;
    answerId: string;
    clientAnswerId: string;
  }): Promise<void> {
    await this.prisma.interviewAnswer.deleteMany({
      where: { id: input.answerId, userId: input.userId, status: "pending" },
    });
    await this.releaseExecution(input);
  }

  async finishAnswer(input: InterviewFinish): Promise<InterviewSessionView> {
    return this.prisma.$transaction(
      async (tx) => {
        await lockUser(tx, input.userId);
        const session = await lockedSession(tx, input.userId, input.sessionId);
        const answer = await tx.interviewAnswer.findUnique({ where: { id: input.answerId } });
        if (
          answer === null ||
          answer.userId !== input.userId ||
          answer.sessionId !== input.sessionId
        ) {
          throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
        }
        if (answer.status === "completed" || session.status === "completed") {
          const stored = await sessionView(tx, input.userId, input.sessionId);
          if (stored === null) {
            throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
          }
          return stored;
        }
        if (session.status !== "active" || session.currentQuestionId !== answer.questionId) {
          throw new InterviewRuleError(409, "INTERVIEW_CLOSED", "That interview is closed.");
        }
        await tx.interviewAnswer.update({
          where: { id: answer.id },
          data: {
            status: "completed",
            understanding: input.understanding,
            reasoning: input.reasoning,
            evidence: input.evidence,
            executionScore: input.executionScore,
            speech: input.speech,
            feedback: input.feedback,
            strengths: input.strengths,
            issues: input.issues,
            evaluatedAt: input.now,
          },
        });
        const question = await tx.interviewQuestion.findUnique({
          where: { id: answer.questionId },
          include: {
            parent: true,
            followUps: { where: { status: "published" }, orderBy: { position: "asc" } },
          },
        });
        if (question === null) {
          throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
        }
        const main = question.parent ?? question;
        const nextMain = await tx.interviewQuestion.findFirst({
          where: {
            interviewId: session.interviewId,
            status: "published",
            parentId: null,
            position: { gt: main.position },
          },
          orderBy: { position: "asc" },
        });
        const step = decideInterviewStep({
          phase: session.phase,
          understanding: input.understanding,
          followUpRecommended: input.followUpRecommended,
          followUpsUsed: session.followUpsUsed,
          hasAuthoredFollowUp: question.followUps.length > 0,
          hasNextMain: nextMain !== null,
        });
        if (step === "follow_up") {
          const follow = question.followUps[0];
          if (follow === undefined) {
            throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
          }
          await tx.interviewSession.update({
            where: { id: session.id },
            data: {
              currentQuestionId: follow.id,
              phase: "follow_up",
              followUpsUsed: session.followUpsUsed + 1,
              aiCalls: { increment: 1 },
            },
          });
        } else if (step === "next" && nextMain !== null) {
          await tx.interviewSession.update({
            where: { id: session.id },
            data: {
              currentQuestionId: nextMain.id,
              phase: "question",
              followUpsUsed: 0,
              aiCalls: { increment: 1 },
            },
          });
        } else {
          await completeSession(tx, {
            userId: input.userId,
            sessionId: session.id,
            interviewId: session.interviewId,
            now: input.now,
            timeZone: input.timeZone,
          });
        }
        await tx.aiUsage.create({
          data: {
            userId: input.userId,
            sessionId: null,
            taskType: "interview",
            provider: input.usage.provider,
            model: input.usage.model,
            inputTokens: input.usage.inputTokens,
            outputTokens: input.usage.outputTokens,
            costMicros: input.usage.costMicros,
            latencyMs: input.usage.latencyMs,
            cached: false,
            correlationId: input.usage.correlationId,
          },
        });
        const view = await sessionView(tx, input.userId, input.sessionId);
        if (view === null) {
          throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
        }
        return view;
      },
      { maxWait: 5_000, timeout: 15_000 },
    );
  }

  async prepareExecution(input: {
    userId: string;
    sessionId: string;
    questionId: string;
    clientAnswerId: string;
    now: Date;
  }): Promise<"claimed" | "busy"> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(12, 12)`;
      const staleBefore = new Date(input.now.getTime() - EXECUTION_LIMITS.claimTtlMs);
      await tx.exerciseExecutionClaim.deleteMany({ where: { createdAt: { lt: staleBefore } } });
      await tx.projectExecutionClaim.deleteMany({ where: { createdAt: { lt: staleBefore } } });
      await tx.interviewExecutionClaim.deleteMany({ where: { createdAt: { lt: staleBefore } } });
      const own = await tx.interviewExecutionClaim.findUnique({
        where: {
          userId_sessionId_questionId_clientAnswerId: {
            userId: input.userId,
            sessionId: input.sessionId,
            questionId: input.questionId,
            clientAnswerId: input.clientAnswerId,
          },
        },
      });
      if (own !== null) {
        return "claimed";
      }
      const active =
        (await tx.exerciseExecutionClaim.count()) +
        (await tx.projectExecutionClaim.count()) +
        (await tx.interviewExecutionClaim.count());
      if (active >= EXECUTION_LIMITS.maxConcurrent) {
        return "busy";
      }
      await tx.interviewExecutionClaim.create({
        data: {
          userId: input.userId,
          sessionId: input.sessionId,
          questionId: input.questionId,
          clientAnswerId: input.clientAnswerId,
          createdAt: input.now,
        },
      });
      return "claimed";
    });
  }

  async releaseExecution(input: {
    userId: string;
    sessionId: string;
    questionId: string;
    clientAnswerId: string;
  }): Promise<void> {
    await this.prisma.interviewExecutionClaim.deleteMany({ where: input });
  }

  async findCompleted(
    userId: string,
    sessionId: string,
    clientAnswerId: string,
  ): Promise<InterviewSessionView | null> {
    const answer = await this.prisma.interviewAnswer.findUnique({
      where: { sessionId_clientAnswerId: { sessionId, clientAnswerId } },
    });
    if (answer === null || answer.userId !== userId || answer.status !== "completed") {
      return null;
    }
    return sessionView(this.prisma, userId, sessionId);
  }

  async isPending(userId: string, sessionId: string, clientAnswerId: string): Promise<boolean> {
    const answer = await this.prisma.interviewAnswer.findUnique({
      where: { sessionId_clientAnswerId: { sessionId, clientAnswerId } },
    });
    return answer !== null && answer.userId === userId && answer.status === "pending";
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private async mastery(userId: string): Promise<Map<string, number>> {
    return masteryMap(this.prisma, userId);
  }

  private async published(slug: string) {
    return this.prisma.interview.findUnique({
      where: { slug },
      include: { requirements: { select: { conceptId: true } }, questions: true },
    });
  }
}

async function completeSession(
  tx: Prisma.TransactionClient,
  input: { userId: string; sessionId: string; interviewId: string; now: Date; timeZone: string },
): Promise<void> {
  const answers = await tx.interviewAnswer.findMany({
    where: { sessionId: input.sessionId, status: "completed" },
    include: { question: { include: { concept: true, parent: true } } },
  });
  const mains = answers.filter((answer) => answer.question.parentId === null);
  const items = mains.map((main) => {
    const follow = answers.find((answer) => answer.question.parentId === main.questionId);
    const evidence =
      follow === undefined ? main.evidence : blendFollowUp(main.evidence, follow.evidence);
    return {
      answerId: main.id,
      conceptId: main.question.conceptId,
      conceptName: main.question.concept.name,
      position: main.question.position,
      weight: main.question.weight,
      evidence,
      strengths: stringList(main.strengths),
      issues: stringList(main.issues),
    };
  });
  const finalScore = finalInterviewScore(items);
  const band = interviewBand(finalScore);
  const strengths = unique(items.flatMap((item) => item.strengths)).slice(0, 5);
  const weaknesses = unique(items.flatMap((item) => item.issues)).slice(0, 5);
  const conceptsToReview = unique(
    items.filter((item) => item.evidence < 60).map((item) => item.conceptName),
  ).slice(0, 6);
  const summary =
    band === "strong"
      ? "Əsas anlayışları izah edə bildiniz."
      : band === "developing"
        ? "Bəzi anlayışlar aydındır, bəziləri isə təkrar istəyir."
        : "Bu müsahibə əsas anlayışların təkrarını göstərir.";
  const nextAction =
    conceptsToReview.length === 0
      ? "Növbəti dərsə davam edin."
      : `Bu mövzuları dərsdə təkrarla: ${conceptsToReview.join(", ")}.`;
  await tx.interviewSession.update({
    where: { id: input.sessionId },
    data: {
      status: "completed",
      phase: "question",
      currentQuestionId: null,
      aiCalls: { increment: 1 },
      finalScore,
      band,
      completedAt: input.now,
      report: { summary, strengths, weaknesses, conceptsToReview, nextAction },
    },
  });
  const byConcept = new Map<string, { evidence: number; answerId: string; position: number }>();
  for (const item of items) {
    const current = byConcept.get(item.conceptId);
    if (current === undefined || item.evidence > current.evidence) {
      byConcept.set(item.conceptId, {
        evidence: item.evidence,
        answerId: item.answerId,
        position: item.position,
      });
    }
  }
  const ranked = [...byConcept.entries()].sort(
    (left, right) => left[1].position - right[1].position,
  );
  const answerIds = items.map((item) => item.answerId);
  const existing = await tx.learningEvent.count({
    where: { userId: input.userId, source: "interview", sourceId: { in: answerIds } },
  });
  if (existing > 0) {
    return;
  }
  let written = 0;
  for (const [conceptId, chosen] of ranked) {
    if (written >= MAX_LEARNING_EVENTS) {
      break;
    }
    const evidence = learningEvidence(chosen.evidence);
    if (evidence === null) {
      continue;
    }
    await tx.learningEvent.create({
      data: {
        userId: input.userId,
        conceptId,
        source: "interview",
        sourceId: chosen.answerId,
        evidence,
        weight: 1,
        metadata: { outcome: "interview" },
      },
    });
    await writeSkillMasteryProjection(tx, {
      userId: input.userId,
      conceptId,
      now: input.now,
      timeZone: input.timeZone,
    });
    written += 1;
  }
}

async function sessionView(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
  sessionId: string,
): Promise<InterviewSessionView | null> {
  const session = await db.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      interview: true,
      currentQuestion: { include: { parent: true } },
    },
  });
  if (session === null) {
    return null;
  }
  const total = await db.interviewQuestion.count({
    where: { interviewId: session.interviewId, status: "published", parentId: null },
  });
  const latest = await db.interviewAnswer.findFirst({
    where: { sessionId, status: "completed" },
    orderBy: { sequence: "desc" },
  });
  return {
    id: session.id,
    interviewSlug: session.interview.slug,
    interviewTitle: session.interview.title,
    status: session.status,
    question: questionView(session.currentQuestion, total),
    speech: latest === null || latest.speech.length === 0 ? null : latest.speech,
    report: reportView(session),
  };
}

function questionView(
  question: {
    title: string;
    prompt: string;
    type: "verbal" | "code";
    position: number;
    starterCode: string | null;
    status: "published" | "draft";
    parent: { position: number } | null;
  } | null,
  total: number,
): InterviewQuestionView | null {
  if (question === null || question.status !== "published") {
    return null;
  }
  return {
    title: question.title,
    prompt: question.prompt,
    type: question.type,
    position: question.parent?.position ?? question.position,
    total,
    followUp: question.parent !== null,
    starterCode: question.type === "code" ? question.starterCode : null,
  };
}

function reportView(session: {
  status: string;
  finalScore: number | null;
  band: string | null;
  report: Prisma.JsonValue;
}): InterviewReportView | null {
  if (session.status !== "completed" || session.finalScore === null || !isBand(session.band)) {
    return null;
  }
  const body = isRecord(session.report) ? session.report : {};
  return {
    finalScore: session.finalScore,
    band: session.band,
    summary: boundedText(body.summary),
    strengths: stringList(body.strengths)
      .map(boundedText)
      .filter((item) => item.length > 0),
    weaknesses: stringList(body.weaknesses)
      .map(boundedText)
      .filter((item) => item.length > 0),
    conceptsToReview: stringList(body.conceptsToReview)
      .map(boundedText)
      .filter((item) => item.length > 0),
    nextAction: boundedText(body.nextAction),
    scoreSource: "server",
  };
}

function boundedText(value: unknown): string {
  if (typeof value !== "string" || /senior/i.test(value)) {
    return "";
  }
  return value;
}

function historyItem(session: {
  id: string;
  status: "active" | "completed" | "abandoned";
  startedAt: Date;
  completedAt: Date | null;
  finalScore: number | null;
  band: string | null;
}): InterviewHistoryItem {
  return {
    id: session.id,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
    finalScore: session.status === "completed" ? session.finalScore : null,
    band: session.status === "completed" && isBand(session.band) ? session.band : null,
  };
}

function eligible(
  requirements: ReadonlyArray<{ conceptId: string }>,
  scores: Map<string, number>,
): boolean {
  return (
    requirements.length > 0 &&
    requirements.every((requirement) => (scores.get(requirement.conceptId) ?? 0) >= UNLOCK_MASTERY)
  );
}

async function masteryMap(
  db: PrismaClient | Prisma.TransactionClient,
  userId: string,
): Promise<Map<string, number>> {
  const rows = await db.skillMastery.findMany({
    where: { userId },
    select: { conceptId: true, score: true },
  });
  return new Map(rows.map((row) => [row.conceptId, row.score]));
}

async function completedOnDay(
  tx: Prisma.TransactionClient,
  userId: string,
  timeZone: string,
  now: Date,
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ count: number }>>`
    SELECT COUNT(*)::int AS count
    FROM interview_sessions
    WHERE user_id = CAST(${userId} AS uuid)
      AND status = 'completed'
      AND (completed_at AT TIME ZONE ${timeZone})::date = (${now}::timestamptz AT TIME ZONE ${timeZone})::date
  `;
  return Number(rows[0]?.count ?? 0);
}

async function consumeWeek(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
  limit: number,
): Promise<void> {
  const windowStart = new Date(Math.floor(now.getTime() / INTERVIEW_WEEK_MS) * INTERVIEW_WEEK_MS);
  const bucket = await tx.authRateBucket.upsert({
    where: {
      action_subjectHash_windowStart: {
        action: "interview_start",
        subjectHash: userId,
        windowStart,
      },
    },
    create: { action: "interview_start", subjectHash: userId, windowStart, hits: 1 },
    update: { hits: { increment: 1 } },
  });
  if (bucket.hits > limit) {
    throw new InterviewRuleError(
      429,
      "QUOTA_EXCEEDED",
      "The interview quota for this plan is reached.",
    );
  }
}

async function lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE id = CAST(${userId} AS uuid) FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
  }
}

async function lockedSession(tx: Prisma.TransactionClient, userId: string, sessionId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM interview_sessions
    WHERE id = CAST(${sessionId} AS uuid) AND user_id = CAST(${userId} AS uuid)
    FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
  }
  const session = await tx.interviewSession.findUnique({
    where: { id: sessionId },
    include: { interview: true },
  });
  if (session === null || session.userId !== userId) {
    throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
  }
  return session;
}

function readExecution(value: Prisma.JsonValue): ExecutionConfig | null {
  if (value === null) {
    return null;
  }
  const parsed = executionConfigSchema.safeParse(value);
  if (!parsed.success) {
    throw new InterviewRuleError(404, "NOT_FOUND", "That interview was not found.");
  }
  return parsed.data;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function localeLabel(locale: string | undefined): string {
  if (locale === "en" || locale === "tr" || locale === "ru") {
    return locale;
  }
  return "az-AZ";
}

function isBand(value: string | null): value is InterviewBand {
  return value === "weak" || value === "developing" || value === "strong";
}
