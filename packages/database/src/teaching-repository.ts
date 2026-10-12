import { PrismaPg } from "@prisma/adapter-pg";
import {
  HOMEWORK_DUE_MS,
  TEACHING_BURST_WINDOW_MS,
  TEACHING_SESSION_IDLE_MS,
  WEAK_MASTERY_BELOW,
  classifyStoredEvidence,
  advanceTeachingProgress,
  assessStrongModelQuota,
  assessTeacherQuota,
  assessTeachingBurst,
  currentTeachingBlock,
  getNextAction,
  homeworkDoneUpdate,
  initialTeachingProgress,
  isLessonUnlocked,
  isOpenTeachingState,
  publicLessonBlock,
  recapPracticePrompt,
  selectTeacherMemory,
  studentCalendarDay,
  studentDayInterval,
  teachingTurnNeedsAnswer,
  type TeachingProgressMarks,
} from "@platform/curriculum";
import type {
  ChallengeLevel,
  ExplanationStyle,
  HomeworkCompletionResponse,
  HomeworkListResponse,
  LessonBlock,
  Locale,
  NextAction,
  Phase1TeachingMode,
  TeachingHomeworkView,
  TeachingOpenResponse,
  TeachingSessionView,
  TeachingState,
  TeachingTurnResponse,
  Understanding,
} from "@platform/types";
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { writeSkillMasteryProjection } from "./progress-repository";
import { newSessionReviewFocus, reviewSlugIfPrimary } from "./review-focus";
import { readNextActionContext } from "./student-onboarding";
import { readCommercialPlan } from "./commercial-access";

const STALE_CLAIM_MS = 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TeachingRuleError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "TeachingRuleError";
    this.status = status;
    this.code = code;
  }
}

export interface PreparedTeachingTurn {
  sessionId: string;
  userId: string;
  clientTurnId: string;
  state: TeachingState;
  mode: Phase1TeachingMode;
  turnCount: number;
  summary: string | null;
  studentMessage: string;
  timeZone: string;
  locale: Locale;
  studentName: string | null;
  explanationStyle: ExplanationStyle;
  challengeLevel: ChallengeLevel;
  lesson: {
    slug: string;
    title: string;
    objective: string;
    blocks: LessonBlock[];
  };
  concepts: Array<{
    slug: string;
    name: string;
    role: "primary" | "supporting";
    mastery: number | null;
    evidenceCount: number;
    lastEvidenceAt: Date | null;
  }>;
  prerequisites: Array<{
    conceptSlug: string;
    prerequisiteSlug: string;
    name: string;
    mastery: number | null;
    evidenceCount: number;
  }>;
  misconceptions: Array<{
    code: string;
    description: string;
    conceptSlug: string;
    occurrenceCount: number;
  }>;
  recentEvidence: Array<{
    source:
      | "lesson_check"
      | "homework"
      | "exercise"
      | "speaking"
      | "interview"
      | "project"
      | "quiz"
      | "code_review";
    outcome: "success" | "partial" | "failure";
    occurredAt: Date;
  }>;
  homeworkPrompts: string[];
  memory: Array<{
    category: "learning" | "mistake" | "preference";
    conceptSlug: string | null;
    content: string;
  }>;
  recentMessages: Array<{ role: "student" | "teacher"; speech: string }>;
  marks: TeachingProgressMarks;
  reviewSession: boolean;
  reviewConceptSlug: string | null;
}

export interface TeachingClaim {
  kind: "pending" | "replay" | "failed" | "missing";
  response?: TeachingTurnResponse;
  status?: number;
  code?: string;
  message?: string;
}

export interface CommitTeachingTurn {
  userId: string;
  sessionId: string;
  clientTurnId: string;
  expectedState: TeachingState;
  speech: string;
  understanding: Understanding;
  state: TeachingState;
  skillUpdates: Array<{
    conceptSlug: string;
    understanding: Exclude<Understanding, "unknown">;
    evidence: number;
    weight: number;
  }>;
  misconception: { code: string; description: string; conceptSlug: string } | null;
  memoryNotes: Array<{
    category: "learning" | "mistake" | "preference";
    conceptSlug: string | null;
    content: string;
    importance: 1 | 2 | 3;
  }>;
  homework: string | null;
  reviewConceptSlug: string | null;
  adaptive: {
    decision:
      | "CONTINUE"
      | "REEXPLAIN"
      | "HINT"
      | "RETRY"
      | "REVIEW"
      | "CHALLENGE"
      | "REMEDIATE_PREREQUISITE";
    strategy:
      | "EXPLAIN"
      | "SOCRATIC"
      | "EXAMPLE"
      | "ANALOGY"
      | "GUIDED_RETRY"
      | "TARGETED_REVIEW"
      | "CHALLENGE";
    reason: string;
  };
  usage: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costMicros: bigint;
    latencyMs: number;
    correlationId: string;
  };
  now: Date;
}

export interface TeachingRepository {
  openSession(input: {
    userId: string;
    mode: Phase1TeachingMode;
    now: Date;
  }): Promise<TeachingOpenResponse>;
  getSession(userId: string, sessionId: string, now: Date): Promise<TeachingSessionView>;
  abandonSession(userId: string, sessionId: string, now: Date): Promise<TeachingSessionView>;
  listHomework(userId: string): Promise<HomeworkListResponse>;
  completeHomework(
    userId: string,
    homeworkId: string,
    now: Date,
  ): Promise<HomeworkCompletionResponse>;
  prepareTurn(input: {
    userId: string;
    sessionId: string;
    clientTurnId: string;
    message: string | null;
    now: Date;
    strongModel: boolean;
  }): Promise<
    | { kind: "replay"; response: TeachingTurnResponse }
    | { kind: "failed"; status: number; code: string; message: string }
    | { kind: "pending" }
    | { kind: "ready"; snapshot: PreparedTeachingTurn }
  >;
  readClaim(userId: string, sessionId: string, clientTurnId: string): Promise<TeachingClaim>;
  commitTurn(input: CommitTeachingTurn): Promise<TeachingTurnResponse>;
  failTurn(input: {
    userId: string;
    sessionId: string;
    clientTurnId: string;
    status: number;
    code: string;
    message: string;
  }): Promise<void>;
  disconnect(): Promise<void>;
}

export function createTeachingRepository(databaseUrl: string): TeachingRepository {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  return new PrismaTeachingRepository(prisma);
}

class PrismaTeachingRepository implements TeachingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async openSession(input: {
    userId: string;
    mode: Phase1TeachingMode;
    now: Date;
  }): Promise<TeachingOpenResponse> {
    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, input.userId);
      await expireIdleSessions(tx, input.userId, input.now);
      const context = await readNextActionContext(tx, input.userId);
      const nextAction = nextActionFrom(context, input.now);
      if (nextAction.kind === "path_complete") {
        return { kind: "path_complete", nextAction };
      }
      if (nextAction.kind === "do_homework") {
        const homework = await homeworkView(tx, nextAction.homeworkId, input.userId);
        const session =
          homework === null
            ? null
            : await this.sessionViewOrNull(tx, input.userId, homework.sessionId, input.now);
        if (homework === null) {
          throw rule(409, "HOMEWORK_UNAVAILABLE", "Homework could not be loaded.");
        }
        return { kind: "homework", homework: homework.view, session, nextAction };
      }
      if (nextAction.kind === "continue_lesson") {
        return {
          kind: "session",
          session: await this.sessionView(tx, input.userId, nextAction.sessionId, input.now),
          nextAction,
        };
      }
      const lesson = context.lessons.find((item) => item.id === nextAction.lessonId);
      const mastery = new Map(
        context.mastery.map((row) => [
          row.conceptSlug,
          { score: row.score, evidenceCount: row.evidenceCount },
        ]),
      );
      if (
        lesson === undefined ||
        lesson.status !== "published" ||
        !isLessonUnlocked({
          lesson,
          lessons: context.lessons,
          prerequisites: context.prerequisites,
          masteryByConcept: mastery,
        })
      ) {
        throw rule(409, "LESSON_UNAVAILABLE", "That lesson is not available.");
      }
      const reviewFocus = newSessionReviewFocus(nextAction, lesson.primaryConceptSlugs);
      if (!reviewFocus.ok) {
        throw rule(409, "LESSON_UNAVAILABLE", "That lesson is not available.");
      }
      const existingProgress = await tx.lessonProgress.findUnique({
        where: { userId_lessonId: { userId: input.userId, lessonId: lesson.id } },
      });
      const created = await tx.teachingSession.create({
        data: {
          userId: input.userId,
          lessonId: lesson.id,
          mode: input.mode,
          state: "created",
          turnCount: 0,
          reviewConceptSlug: reviewFocus.slug,
          startedAt: input.now,
          lastActivityAt: input.now,
        },
      });
      if (existingProgress === null) {
        await tx.lessonProgress.create({
          data: {
            userId: input.userId,
            lessonId: lesson.id,
            status: "in_progress",
            startedAt: input.now,
          },
        });
      } else if (existingProgress.status !== "completed") {
        await tx.lessonProgress.update({
          where: { userId_lessonId: { userId: input.userId, lessonId: lesson.id } },
          data: { status: "in_progress", startedAt: existingProgress.startedAt ?? input.now },
        });
      }
      const session = await this.sessionView(tx, input.userId, created.id, input.now);
      const refreshed = nextActionFrom(await readNextActionContext(tx, input.userId), input.now);
      return {
        kind: "session",
        session: { ...session, nextAction: refreshed },
        nextAction: refreshed,
      };
    });
  }

  async getSession(userId: string, sessionId: string, now: Date): Promise<TeachingSessionView> {
    return this.prisma.$transaction(async (tx) => {
      await this.abandonIfIdle(tx, userId, sessionId, now);
      return this.sessionView(tx, userId, sessionId, now);
    });
  }

  async abandonSession(userId: string, sessionId: string, now: Date): Promise<TeachingSessionView> {
    return this.prisma.$transaction(async (tx) => {
      const session = await ownedSession(tx, userId, sessionId);
      if (session.state === "completed" || session.state === "review_completed") {
        throw rule(409, "SESSION_CLOSED", "A completed session cannot be abandoned.");
      }
      if (session.state !== "abandoned") {
        await tx.teachingSession.update({
          where: { id: session.id },
          data: { state: "abandoned", endedAt: now },
        });
      }
      return this.sessionView(tx, userId, sessionId, now);
    });
  }

  async listHomework(userId: string): Promise<HomeworkListResponse> {
    const rows = await this.prisma.homeworkAssignment.findMany({
      where: { userId, status: { in: ["assigned", "done"] } },
      include: { lesson: { select: { slug: true, title: true } } },
      orderBy: [{ dueAt: "asc" }],
      take: 50,
    });
    const rank = { assigned: 0, done: 1, skipped: 2 };
    return {
      homework: rows
        .slice()
        .sort(
          (left, right) =>
            rank[left.status] - rank[right.status] || left.dueAt.getTime() - right.dueAt.getTime(),
        )
        .map((row) => toHomeworkView(row)),
    };
  }

  async completeHomework(
    userId: string,
    homeworkId: string,
    now: Date,
  ): Promise<HomeworkCompletionResponse> {
    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, userId);
      const row = await lockedHomework(tx, userId, homeworkId);
      if (row.status === "done") {
        return homeworkCompletionView(tx, userId, row.id, now);
      }
      if (row.status !== "assigned") {
        throw rule(409, "HOMEWORK_CLOSED", "This homework cannot be completed.");
      }
      const lesson = await tx.lesson.findFirst({
        where: { id: row.lessonId },
        include: { concepts: { include: { concept: { select: { id: true, slug: true } } } } },
      });
      if (lesson === null) {
        throw rule(409, "LESSON_UNAVAILABLE", "That lesson is not available.");
      }
      const completed = await tx.homeworkAssignment.updateMany({
        where: { id: row.id, userId, status: "assigned" },
        data: { status: "done", completedAt: now },
      });
      if (completed.count === 0) {
        return homeworkCompletionView(tx, userId, row.id, now);
      }
      const learner = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { timezone: true },
      });
      const update = homeworkDoneUpdate();
      for (const link of lesson.concepts) {
        await tx.learningEvent.create({
          data: {
            userId,
            conceptId: link.concept.id,
            source: "homework",
            sourceId: row.id,
            evidence: update.evidence,
            weight: update.weight,
            metadata: { outcome: "done" },
          },
        });
        await writeSkillMasteryProjection(tx, {
          userId,
          conceptId: link.concept.id,
          now,
          timeZone: learner.timezone,
        });
        await tx.misconception.updateMany({
          where: { userId, conceptId: link.concept.id, status: "active" },
          data: { status: "resolved" },
        });
      }
      return homeworkCompletionView(tx, userId, row.id, now);
    });
  }

  async prepareTurn(input: {
    userId: string;
    sessionId: string;
    clientTurnId: string;
    message: string | null;
    now: Date;
    strongModel: boolean;
  }): Promise<
    | { kind: "replay"; response: TeachingTurnResponse }
    | { kind: "failed"; status: number; code: string; message: string }
    | { kind: "pending" }
    | { kind: "ready"; snapshot: PreparedTeachingTurn }
  > {
    if (!UUID.test(input.clientTurnId)) {
      throw rule(400, "VALIDATION", "clientTurnId must be a UUID.");
    }
    return this.prisma.$transaction(async (tx) => {
      const located = await ownedSession(tx, input.userId, input.sessionId);
      await lockUser(tx, input.userId);
      await lockSession(tx, located.id);
      const session = await ownedSession(tx, input.userId, input.sessionId);
      const existing = await claimRow(tx, session.id, input.clientTurnId);
      const settled = interpretClaim(existing?.payload);
      if (settled.kind === "replay" || settled.kind === "failed") {
        return settled;
      }
      if (isIdle(session, input.now) && isOpenTeachingState(session.state)) {
        await tx.teachingSession.update({
          where: { id: session.id },
          data: { state: "abandoned", endedAt: input.now },
        });
        throw rule(409, "SESSION_CLOSED", "This session expired after 12 hours of inactivity.");
      }
      if (!isOpenTeachingState(session.state)) {
        throw rule(409, "SESSION_CLOSED", "This teaching session is closed.");
      }
      if (session.mode !== "explain" && session.mode !== "socratic") {
        throw rule(409, "SESSION_CLOSED", "This teaching mode is not available.");
      }
      if (settled.kind === "pending") {
        if (
          existing !== null &&
          existing.createdAt.getTime() + STALE_CLAIM_MS > input.now.getTime()
        ) {
          return { kind: "pending" };
        }
        await tx.teachingMessage.deleteMany({
          where: { sessionId: session.id, clientTurnId: input.clientTurnId, role: "student" },
        });
      }
      await clearStaleClaims(tx, session.id, input.clientTurnId, input.now);
      const needsAnswer = teachingTurnNeedsAnswer(session.state);
      const advancing = input.message === null;
      if (needsAnswer === advancing) {
        throw rule(
          400,
          "VALIDATION",
          needsAnswer ? "This step needs an answer." : "This step continues without a new answer.",
        );
      }
      await assertQuota(tx, input.userId, input.now);
      await assertBurst(tx, input.userId, input.now);
      if (input.strongModel) {
        await assertStrongModel(tx, input.userId, input.now);
      }
      const snapshot = await loadSnapshot(
        tx,
        session,
        input.message ?? "",
        input.clientTurnId,
        input.now,
      );
      try {
        await tx.teachingMessage.create({
          data: {
            sessionId: session.id,
            clientTurnId: input.clientTurnId,
            role: "student",
            speech: input.message ?? "",
            payload: { status: "pending" },
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const raced = interpretClaim(
            (await claimRow(tx, session.id, input.clientTurnId))?.payload,
          );
          if (raced.kind === "replay" || raced.kind === "failed" || raced.kind === "pending") {
            return raced;
          }
        }
        throw error;
      }
      return { kind: "ready", snapshot };
    });
  }

  async readClaim(userId: string, sessionId: string, clientTurnId: string): Promise<TeachingClaim> {
    const session = await this.prisma.teachingSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (session === null) {
      throw rule(404, "NOT_FOUND", "That teaching session was not found.");
    }
    const row = await claimRow(this.prisma, sessionId, clientTurnId);
    return interpretClaim(row?.payload);
  }

  async commitTurn(input: CommitTeachingTurn): Promise<TeachingTurnResponse> {
    return this.prisma.$transaction(async (tx) => {
      const session = await ownedSession(tx, input.userId, input.sessionId);
      await lockSession(tx, session.id);
      if (session.state !== input.expectedState) {
        throw rule(409, "CONFLICT", "The teaching session changed before the turn was saved.");
      }
      const claim = await claimRow(tx, session.id, input.clientTurnId);
      if (claim === null || interpretClaim(claim.payload).kind !== "pending") {
        throw rule(409, "CONFLICT", "This teaching turn is no longer pending.");
      }
      const lesson = await tx.lesson.findUniqueOrThrow({
        where: { id: session.lessonId },
        include: { blocks: { orderBy: { position: "asc" } } },
      });
      const blocks = parseBlocks(lesson.blocks);
      const marks = readMarks(await latestBook(tx, session.id));
      const fromBlock = currentTeachingBlock(
        blocks,
        session.state,
        marks.usedCheckPositions,
        input.reviewConceptSlug,
      );
      const nextMarks = advanceTeachingProgress({
        marks,
        from: session.state,
        to: input.state,
        understanding: input.understanding,
        checkPosition: fromBlock.type === "check_question" ? fromBlock.position : null,
      });
      let homeworkId: string | null = null;
      if (input.state === "homework" && !nextMarks.homeworkPersisted) {
        const createdHomework = await tx.homeworkAssignment.create({
          data: {
            userId: input.userId,
            sessionId: session.id,
            lessonId: session.lessonId,
            prompt: homeworkPrompt(input.homework, blocks, lesson.objective),
            status: "assigned",
            dueAt: new Date(input.now.getTime() + HOMEWORK_DUE_MS),
          },
        });
        homeworkId = createdHomework.id;
        nextMarks.homeworkPersisted = true;
      }
      const completed = input.state === "completed";
      const closed =
        completed || input.state === "abandoned" || input.state === "review_completed";
      await tx.teachingSession.update({
        where: { id: session.id },
        data: {
          state: input.state,
          turnCount: { increment: 1 },
          lastActivityAt: input.now,
          ...(closed ? { endedAt: input.now } : {}),
        },
      });
      const teacherMessage = await tx.teachingMessage.create({
        data: {
          sessionId: session.id,
          role: "teacher",
          speech: input.speech,
          model: input.usage.model,
          inputTokens: input.usage.inputTokens,
          outputTokens: input.usage.outputTokens,
          payload: { book: { ...nextMarks } } as Prisma.InputJsonObject,
        },
      });
      const learner = await tx.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: { timezone: true },
      });
      const conceptIds = await conceptIdsBySlug(tx, [
        ...input.skillUpdates.map((item) => item.conceptSlug),
        ...input.memoryNotes.flatMap((item) =>
          item.conceptSlug === null ? [] : [item.conceptSlug],
        ),
        ...(input.misconception === null ? [] : [input.misconception.conceptSlug]),
      ]);
      const source = session.state === "homework" ? "homework" : "lesson_check";
      for (const update of input.skillUpdates) {
        const conceptId = conceptIds.get(update.conceptSlug);
        if (conceptId === undefined) {
          continue;
        }
        await tx.learningEvent.create({
          data: {
            userId: input.userId,
            conceptId,
            source,
            sourceId: teacherMessage.id,
            evidence: update.evidence,
            weight: update.weight,
            metadata: { state: session.state, understanding: input.understanding },
          },
        });
        await writeSkillMasteryProjection(tx, {
          userId: input.userId,
          conceptId,
          now: input.now,
          timeZone: learner.timezone,
        });
      }
      if (input.misconception !== null) {
        const conceptId = conceptIds.get(input.misconception.conceptSlug);
        if (conceptId !== undefined) {
          await tx.misconception.upsert({
            where: {
              userId_conceptId_code: {
                userId: input.userId,
                conceptId,
                code: input.misconception.code,
              },
            },
            create: {
              userId: input.userId,
              conceptId,
              code: input.misconception.code,
              description: input.misconception.description,
            },
            update: {
              description: input.misconception.description,
              occurrenceCount: { increment: 1 },
              lastSeenAt: input.now,
              status: "active",
            },
          });
        }
      }
      for (const update of input.skillUpdates) {
        if (update.understanding !== "correct") {
          continue;
        }
        const conceptId = conceptIds.get(update.conceptSlug);
        if (conceptId === undefined) {
          continue;
        }
        await tx.misconception.updateMany({
          where: { userId: input.userId, conceptId, status: "active" },
          data: { status: "resolved" },
        });
      }
      for (const note of input.memoryNotes) {
        await tx.memoryItem.create({
          data: {
            userId: input.userId,
            category: note.category,
            conceptId:
              note.conceptSlug === null ? null : (conceptIds.get(note.conceptSlug) ?? null),
            content: note.content,
            importance: note.importance,
            sessionId: session.id,
          },
        });
      }
      if (completed) {
        await tx.lessonProgress.upsert({
          where: { userId_lessonId: { userId: input.userId, lessonId: session.lessonId } },
          create: {
            userId: input.userId,
            lessonId: session.lessonId,
            status: "completed",
            startedAt: input.now,
            completedAt: input.now,
          },
          update: { status: "completed", completedAt: input.now },
        });
      }
      await incrementTeacherTurn(tx, input.userId, learner.timezone, input.now, completed ? 1 : 0);
      await tx.aiUsage.create({
        data: {
          userId: input.userId,
          taskType: "teach",
          provider: input.usage.provider,
          model: input.usage.model,
          inputTokens: input.usage.inputTokens,
          outputTokens: input.usage.outputTokens,
          costMicros: input.usage.costMicros,
          cached: false,
          latencyMs: input.usage.latencyMs,
          correlationId: input.usage.correlationId,
          sessionId: session.id,
          createdAt: input.now,
        },
      });
      const mastery = await masteryForLesson(tx, input.userId, session.lessonId);
      const homework = await sessionHomework(tx, session.id);
      const nextAction = nextActionFrom(await readNextActionContext(tx, input.userId), input.now);
      const updated = await tx.teachingSession.findUniqueOrThrow({ where: { id: session.id } });
      const response: TeachingTurnResponse = {
        session: {
          id: session.id,
          lessonSlug: lesson.slug,
          lessonTitle: lesson.title,
          mode: phase1Mode(updated.mode),
          state: updated.state,
          turnNumber: updated.turnCount,
          completed: updated.state === "completed",
        },
        teacher: { message: input.speech, understanding: input.understanding },
        learning: {
          updatedConcepts: input.skillUpdates.flatMap((update) => {
            if (!conceptIds.has(update.conceptSlug)) {
              return [];
            }
            return [
              {
                conceptSlug: update.conceptSlug,
                understanding: update.understanding,
                evidence: update.evidence,
                mastery: mastery.get(update.conceptSlug) ?? null,
              },
            ];
          }),
          mastery: [...mastery.entries()].map(([slug, score]) => ({ slug, mastery: score })),
          nextAction,
          adaptive: input.adaptive,
        },
        usage: { turnConsumed: true },
        block: publicLessonBlock(
          currentTeachingBlock(
            blocks,
            updated.state,
            nextMarks.usedCheckPositions,
            input.reviewConceptSlug,
          ),
        ),
        homework: homework ?? (homeworkId === null ? null : await homeworkById(tx, homeworkId)),
      };
      const stored = JSON.parse(JSON.stringify(response)) as TeachingTurnResponse;
      await tx.teachingMessage.update({
        where: { id: claim.id },
        data: { payload: storedPayload(stored) },
      });
      return stored;
    });
  }

  async failTurn(input: {
    userId: string;
    sessionId: string;
    clientTurnId: string;
    status: number;
    code: string;
    message: string;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const session = await ownedSession(tx, input.userId, input.sessionId);
      await lockSession(tx, session.id);
      const claim = await claimRow(tx, session.id, input.clientTurnId);
      if (claim === null || interpretClaim(claim.payload).kind !== "pending") {
        return;
      }
      await tx.teachingMessage.update({
        where: { id: claim.id },
        data: {
          payload: {
            status: "failed",
            httpStatus: input.status,
            code: input.code,
            message: input.message,
          },
        },
      });
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private async abandonIfIdle(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<void> {
    const session = await ownedSession(tx, userId, sessionId);
    await lockSession(tx, session.id);
    if (!isIdle(session, now) || !isOpenTeachingState(session.state)) {
      return;
    }
    await tx.teachingSession.update({
      where: { id: session.id },
      data: { state: "abandoned", endedAt: now },
    });
  }

  private async sessionView(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<TeachingSessionView> {
    const view = await this.sessionViewOrNull(tx, userId, sessionId, now);
    if (view === null) {
      throw rule(404, "NOT_FOUND", "That teaching session was not found.");
    }
    return view;
  }

  private async sessionViewOrNull(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<TeachingSessionView | null> {
    const session = await tx.teachingSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        lesson: {
          include: {
            blocks: { orderBy: { position: "asc" } },
            concepts: { include: { concept: { select: { slug: true, name: true } } } },
          },
        },
        messages: { orderBy: { createdAt: "asc" } },
      },
    });
    if (session === null) {
      return null;
    }
    const blocks = parseBlocks(session.lesson.blocks);
    const marks = readMarks(await latestBook(tx, session.id));
    const primarySlugs = session.lesson.concepts.flatMap((link) =>
      link.role === "primary" ? [link.concept.slug] : [],
    );
    const reviewSlug = reviewSlugIfPrimary(session.reviewConceptSlug, primarySlugs);
    const reviewConceptName =
      reviewSlug === null
        ? null
        : (session.lesson.concepts.find((link) => link.concept.slug === reviewSlug)?.concept.name ??
          null);
    const block = publicLessonBlock(
      currentTeachingBlock(blocks, session.state, marks.usedCheckPositions, reviewSlug),
    );
    const mastery = await masteryForLesson(tx, userId, session.lessonId);
    return {
      id: session.id,
      lessonSlug: session.lesson.slug,
      lessonTitle: session.lesson.title,
      mode: phase1Mode(session.mode),
      state: session.state,
      turnNumber: session.turnCount,
      completed: session.state === "completed",
      reviewConceptName,
      block,
      messages: session.messages.flatMap((message) => {
        if (
          (message.role !== "student" && message.role !== "teacher") ||
          message.speech.length === 0
        ) {
          return [];
        }
        return [
          {
            id: message.id,
            role: message.role,
            speech: message.speech,
            createdAt: message.createdAt.toISOString(),
          },
        ];
      }),
      homework: await sessionHomework(tx, session.id),
      progress: session.lesson.concepts.map((link) => ({
        slug: link.concept.slug,
        mastery: mastery.get(link.concept.slug) ?? null,
      })),
      nextAction: nextActionFrom(await readNextActionContext(tx, userId), now),
    };
  }
}

function rule(status: number, code: string, message: string): TeachingRuleError {
  return new TeachingRuleError(status, code, message);
}

function nextActionFrom(
  context: Awaited<ReturnType<typeof readNextActionContext>>,
  now: Date,
): NextAction {
  return getNextAction({
    now,
    timeZone: context.timeZone,
    homework: context.homework,
    sessions: context.sessions,
    lessons: context.lessons,
    prerequisites: context.prerequisites,
    masteryByConcept: new Map(
      context.mastery.map((row) => [
        row.conceptSlug,
        { score: row.score, evidenceCount: row.evidenceCount },
      ]),
    ),
  });
}

async function lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE id = CAST(${userId} AS uuid) FOR UPDATE
  `;
  if (rows.length === 0) {
    throw rule(404, "NOT_FOUND", "That teaching session was not found.");
  }
}

async function lockSession(tx: Prisma.TransactionClient, sessionId: string): Promise<void> {
  await tx.$queryRaw`
    SELECT id FROM teaching_sessions WHERE id = CAST(${sessionId} AS uuid) FOR UPDATE
  `;
}

async function expireIdleSessions(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<void> {
  await tx.teachingSession.updateMany({
    where: {
      userId,
      endedAt: null,
      state: { notIn: ["completed", "abandoned", "review_completed"] },
      lastActivityAt: { lt: new Date(now.getTime() - TEACHING_SESSION_IDLE_MS) },
    },
    data: { state: "abandoned", endedAt: now },
  });
}

async function ownedSession(tx: Prisma.TransactionClient, userId: string, sessionId: string) {
  if (!UUID.test(sessionId)) {
    throw rule(404, "NOT_FOUND", "That teaching session was not found.");
  }
  const session = await tx.teachingSession.findFirst({ where: { id: sessionId, userId } });
  if (session === null) {
    throw rule(404, "NOT_FOUND", "That teaching session was not found.");
  }
  return session;
}

function isIdle(session: { lastActivityAt: Date; state: TeachingState }, now: Date): boolean {
  return now.getTime() - session.lastActivityAt.getTime() >= TEACHING_SESSION_IDLE_MS;
}

async function claimRow(
  tx: Prisma.TransactionClient | PrismaClient,
  sessionId: string,
  clientTurnId: string,
) {
  return tx.teachingMessage.findFirst({
    where: { sessionId, clientTurnId, role: "student" },
  });
}

function interpretClaim(
  payload: unknown,
):
  | { kind: "replay"; response: TeachingTurnResponse }
  | { kind: "failed"; status: number; code: string; message: string }
  | { kind: "pending" }
  | { kind: "missing" } {
  if (typeof payload !== "object" || payload === null || !("status" in payload)) {
    return { kind: "missing" };
  }
  const status = payload.status;
  if (status === "pending") {
    return { kind: "pending" };
  }
  if (status === "complete" && "response" in payload && isTurnResponse(payload.response)) {
    return { kind: "replay", response: payload.response };
  }
  if (
    status === "failed" &&
    "httpStatus" in payload &&
    "code" in payload &&
    "message" in payload &&
    typeof payload.httpStatus === "number" &&
    typeof payload.code === "string" &&
    typeof payload.message === "string"
  ) {
    return {
      kind: "failed",
      status: payload.httpStatus,
      code: payload.code,
      message: payload.message,
    };
  }
  return { kind: "missing" };
}

async function clearStaleClaims(
  tx: Prisma.TransactionClient,
  sessionId: string,
  clientTurnId: string,
  now: Date,
): Promise<void> {
  const rows = await tx.teachingMessage.findMany({
    where: { sessionId, role: "student", NOT: { clientTurnId } },
    select: { id: true, createdAt: true, payload: true },
  });
  const stale = rows.filter(
    (row) =>
      interpretClaim(row.payload).kind === "pending" &&
      row.createdAt.getTime() + STALE_CLAIM_MS <= now.getTime(),
  );
  if (stale.length === 0) {
    return;
  }
  await tx.teachingMessage.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
  const fresh = rows.filter(
    (row) =>
      interpretClaim(row.payload).kind === "pending" &&
      row.createdAt.getTime() + STALE_CLAIM_MS > now.getTime(),
  );
  if (fresh.length > 0) {
    throw rule(409, "TURN_IN_PROGRESS", "A teaching turn is already in progress.");
  }
}

async function assertQuota(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<void> {
  await readCommercialPlan(tx, userId, now);
  const plan = await tx.userPlan.findUnique({
    where: { userId },
    include: { plan: true },
  });
  if (plan === null || plan.status !== "active" || !plan.plan.active) {
    throw rule(403, "PLAN_REQUIRED", "An active plan is required before teaching.");
  }
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true },
  });
  const usage = await tx.$queryRaw<Array<{ day: string; teacher_turns: number }>>`
    SELECT to_char(activity_date, 'YYYY-MM-DD') AS day, teacher_turns
    FROM daily_activity
    WHERE user_id = CAST(${userId} AS uuid)
  `;
  const decision = assessTeacherQuota({
    now,
    timeZone: user.timezone,
    dailyLimit: plan.plan.dailyTeacherTurns,
    monthlyLimit: plan.plan.monthlyTeacherTurns,
    usage: usage.map((row) => ({
      activityDate: row.day,
      teacherTurns: Number(row.teacher_turns),
    })),
  });
  if (!decision.allowed) {
    throw rule(
      429,
      "QUOTA_EXCEEDED",
      decision.scope === "day"
        ? "The daily teacher-turn limit is reached. It resets at the next midnight in your timezone."
        : "The monthly teacher-turn limit is reached. It resets at the start of the next month in your timezone.",
    );
  }
}

async function assertBurst(tx: Prisma.TransactionClient, userId: string, now: Date): Promise<void> {
  const cutoff = new Date(now.getTime() - TEACHING_BURST_WINDOW_MS);
  const rows = await tx.$queryRaw<Array<{ successful: number; reserved: number }>>`
    SELECT
      (
        SELECT count(*)::int
        FROM teaching_messages AS message
        JOIN teaching_sessions AS session ON session.id = message.session_id
        WHERE session.user_id = CAST(${userId} AS uuid)
          AND message.role = 'teacher'
          AND message.created_at > ${cutoff}
      ) AS successful,
      (
        SELECT count(*)::int
        FROM teaching_messages AS message
        JOIN teaching_sessions AS session ON session.id = message.session_id
        WHERE session.user_id = CAST(${userId} AS uuid)
          AND message.role = 'student'
          AND message.payload->>'status' = 'pending'
          AND message.created_at > ${cutoff}
      ) AS reserved
  `;
  const count = rows[0] ?? { successful: 0, reserved: 0 };
  const decision = assessTeachingBurst({
    successfulTurns: Number(count.successful),
    reservedTurns: Number(count.reserved),
  });
  if (!decision.allowed) {
    throw rule(
      429,
      "RATE_LIMITED",
      "The teaching pace limit is reached. Try again in a few minutes.",
    );
  }
}

async function assertStrongModel(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<void> {
  const plan = await tx.userPlan.findUnique({
    where: { userId },
    include: { plan: true },
  });
  if (plan === null || plan.status !== "active" || !plan.plan.active) {
    throw rule(403, "PLAN_REQUIRED", "An active plan is required before teaching.");
  }
  const user = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { timezone: true },
  });
  const window = studentDayInterval(now, user.timezone);
  const rows = await tx.$queryRaw<Array<{ successful: number; reserved: number }>>`
    SELECT
      (
        SELECT count(*)::int
        FROM ai_usage
        WHERE user_id = CAST(${userId} AS uuid)
          AND task_type = 'teach'
          AND created_at >= ${window.start}
          AND created_at < ${window.end}
      ) AS successful,
      (
        SELECT count(*)::int
        FROM teaching_messages AS message
        JOIN teaching_sessions AS session ON session.id = message.session_id
        WHERE session.user_id = CAST(${userId} AS uuid)
          AND message.role = 'student'
          AND message.payload->>'status' = 'pending'
          AND message.created_at >= ${window.start}
          AND message.created_at < ${window.end}
      ) AS reserved
  `;
  const count = rows[0] ?? { successful: 0, reserved: 0 };
  const decision = assessStrongModelQuota({
    successfulCalls: Number(count.successful),
    reservedCalls: Number(count.reserved),
    limit: plan.plan.dailyStrongCalls,
  });
  if (!decision.allowed) {
    throw rule(
      429,
      "QUOTA_EXCEEDED",
      "The daily strong-model limit is reached. It resets at the next midnight in your timezone.",
    );
  }
}

async function lockedHomework(tx: Prisma.TransactionClient, userId: string, homeworkId: string) {
  if (!UUID.test(homeworkId)) {
    throw rule(404, "NOT_FOUND", "That homework was not found.");
  }
  const rows = await tx.$queryRaw<
    Array<{ id: string; status: "assigned" | "done" | "skipped"; lesson_id: string }>
  >`
    SELECT id, status, lesson_id
    FROM homework_assignments
    WHERE id = CAST(${homeworkId} AS uuid)
      AND user_id = CAST(${userId} AS uuid)
    FOR UPDATE
  `;
  const row = rows[0];
  if (row === undefined) {
    throw rule(404, "NOT_FOUND", "That homework was not found.");
  }
  return { id: row.id, status: row.status, lessonId: row.lesson_id };
}

async function homeworkCompletionView(
  tx: Prisma.TransactionClient,
  userId: string,
  homeworkId: string,
  now: Date,
): Promise<HomeworkCompletionResponse> {
  const row = await tx.homeworkAssignment.findFirstOrThrow({
    where: { id: homeworkId, userId },
    include: { lesson: { select: { slug: true, title: true } } },
  });
  const events = await tx.learningEvent.findMany({
    where: { userId, source: "homework", sourceId: homeworkId },
    include: { concept: { select: { slug: true } } },
  });
  const mastery = await masteryForLesson(tx, userId, row.lessonId);
  return {
    homework: toHomeworkView(row),
    learning: {
      updatedConcepts: events.map((event) => ({
        conceptSlug: event.concept.slug,
        evidence: event.evidence,
        mastery: mastery.get(event.concept.slug) ?? null,
      })),
      nextAction: nextActionFrom(await readNextActionContext(tx, userId), now),
    },
  };
}

async function incrementTeacherTurn(
  tx: Prisma.TransactionClient,
  userId: string,
  timeZone: string,
  now: Date,
  lessonsCompleted: number,
): Promise<void> {
  const day = studentCalendarDay(now, timeZone);
  await tx.$executeRaw`
    INSERT INTO daily_activity (user_id, activity_date, teacher_turns, lessons_completed, minutes)
    VALUES (CAST(${userId} AS uuid), CAST(${day} AS date), 1, ${lessonsCompleted}, 0)
    ON CONFLICT (user_id, activity_date)
    DO UPDATE SET
      teacher_turns = daily_activity.teacher_turns + 1,
      lessons_completed = daily_activity.lessons_completed + ${lessonsCompleted}
  `;
}

async function loadSnapshot(
  tx: Prisma.TransactionClient,
  session: {
    id: string;
    userId: string;
    lessonId: string;
    mode: string;
    state: TeachingState;
    turnCount: number;
    summary: string | null;
    reviewConceptSlug: string | null;
  },
  studentMessage: string,
  clientTurnId: string,
  now: Date,
): Promise<PreparedTeachingTurn> {
  const user = await tx.user.findUniqueOrThrow({
    where: { id: session.userId },
    include: { studentPreferences: true },
  });
  const lesson = await tx.lesson.findUniqueOrThrow({
    where: { id: session.lessonId },
    include: {
      blocks: { orderBy: { position: "asc" } },
      concepts: { include: { concept: true } },
    },
  });
  const blocks = parseBlocks(lesson.blocks);
  if (blocks.length === 0) {
    throw rule(409, "LESSON_UNAVAILABLE", "That lesson is not available.");
  }
  const lessonSlugs = lesson.concepts.map((link) => link.concept.slug);
  const edges = await tx.conceptPrerequisite.findMany({
    where: { concept: { slug: { in: lessonSlugs } } },
    include: {
      concept: { select: { slug: true } },
      prerequisite: { select: { slug: true, name: true } },
    },
  });
  const masteryRows = await tx.skillMastery.findMany({
    where: {
      userId: session.userId,
      concept: {
        slug: {
          in: [...lessonSlugs, ...edges.map((edge) => edge.prerequisite.slug)],
        },
      },
    },
    include: { concept: { select: { slug: true } } },
  });
  const mastery = new Map(masteryRows.map((row) => [row.concept.slug, row]));
  const misconceptions = await tx.misconception.findMany({
    where: { userId: session.userId, status: "active" },
    include: { concept: { select: { slug: true } } },
    orderBy: { lastSeenAt: "desc" },
    take: 10,
  });
  const homework = await tx.homeworkAssignment.findMany({
    where: { userId: session.userId, status: "assigned" },
    orderBy: { dueAt: "asc" },
    select: { prompt: true },
  });
  const recent = await tx.teachingMessage.findMany({
    where: {
      sessionId: session.id,
      role: { in: ["student", "teacher"] },
      NOT: { clientTurnId },
      speech: { not: "" },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  return {
    sessionId: session.id,
    userId: session.userId,
    clientTurnId,
    state: session.state,
    mode: phase1Mode(session.mode),
    turnCount: session.turnCount,
    summary: session.summary,
    studentMessage,
    timeZone: user.timezone,
    locale: toLocale(user.locale),
    studentName: user.name,
    explanationStyle: user.studentPreferences?.explanationStyle ?? "clear",
    challengeLevel: user.studentPreferences?.challengeLevel ?? "adaptive",
    lesson: {
      slug: lesson.slug,
      title: lesson.title,
      objective: lesson.objective,
      blocks,
    },
    concepts: lesson.concepts.map((link) => {
      const row = mastery.get(link.concept.slug);
      return {
        slug: link.concept.slug,
        name: link.concept.name,
        role: link.role,
        mastery: row?.score ?? null,
        evidenceCount: row?.evidenceCount ?? 0,
        lastEvidenceAt: row?.lastEvidenceAt ?? null,
      };
    }),
    prerequisites: edges.map((edge) => {
      const row = mastery.get(edge.prerequisite.slug);
      return {
        conceptSlug: edge.concept.slug,
        prerequisiteSlug: edge.prerequisite.slug,
        name: edge.prerequisite.name,
        mastery: row?.score ?? null,
        evidenceCount: row?.evidenceCount ?? 0,
      };
    }),
    misconceptions: misconceptions.map((item) => ({
      code: item.code,
      description: item.description,
      conceptSlug: item.concept.slug,
      occurrenceCount: item.occurrenceCount,
    })),
    recentEvidence: await recentAdaptiveEvidence(tx, session.userId, session.lessonId, lessonSlugs),
    homeworkPrompts: homework.map((item) => item.prompt),
    memory: selectTeacherMemory({
      notes: (
        await tx.memoryItem.findMany({
          where: {
            userId: session.userId,
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          },
          include: { concept: { select: { slug: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        })
      ).map((item) => ({
        category: item.category,
        conceptSlug: item.concept?.slug ?? null,
        content: item.content,
        createdAt: item.createdAt,
      })),
      lessonConceptSlugs: new Set(lessonSlugs),
      weakConceptSlugs: new Set(
        [...mastery.entries()].flatMap(([slug, row]) =>
          row.score < WEAK_MASTERY_BELOW ? [slug] : [],
        ),
      ),
    }),
    recentMessages: recent
      .reverse()
      .flatMap((message) =>
        message.role === "student" || message.role === "teacher"
          ? [{ role: message.role, speech: message.speech }]
          : [],
      ),
    marks: readMarks(await latestBook(tx, session.id)),
    reviewSession: session.reviewConceptSlug !== null,
    reviewConceptSlug: reviewSlugIfPrimary(
      session.reviewConceptSlug,
      lesson.concepts.flatMap((link) => (link.role === "primary" ? [link.concept.slug] : [])),
    ),
  };
}

function parseBlocks(
  rows: Array<{ position: number; type: string; body: unknown }>,
): LessonBlock[] {
  return rows.flatMap((row) => {
    const block = parseBlock(row);
    return block === null ? [] : [block];
  });
}

function parseBlock(row: { position: number; type: string; body: unknown }): LessonBlock | null {
  if (typeof row.body !== "object" || row.body === null) {
    return null;
  }
  const body = row.body as Record<string, unknown>;
  if (row.type === "reading" && typeof body.markdown === "string") {
    return {
      type: "reading",
      position: row.position,
      markdown: body.markdown,
      conceptSlugs: stringList(body.conceptSlugs),
    };
  }
  if (row.type === "check_question" && typeof body.prompt === "string") {
    const difficulty = body.difficulty;
    if (
      difficulty !== "beginner" &&
      difficulty !== "easy" &&
      difficulty !== "intermediate" &&
      difficulty !== "advanced" &&
      difficulty !== "expert"
    ) {
      return null;
    }
    return {
      type: "check_question",
      position: row.position,
      prompt: body.prompt,
      rubric: stringList(body.rubric),
      conceptSlugs: stringList(body.conceptSlugs),
      difficulty,
      ...(body.harder === true ? { harder: true } : {}),
    };
  }
  if (
    row.type === "recap" &&
    Array.isArray(body.points) &&
    typeof body.practicePrompt === "string"
  ) {
    return {
      type: "recap",
      position: row.position,
      points: stringList(body.points),
      practicePrompt: body.practicePrompt,
    };
  }
  return null;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function latestBook(tx: Prisma.TransactionClient, sessionId: string): Promise<unknown> {
  const message = await tx.teachingMessage.findFirst({
    where: { sessionId, role: "teacher" },
    orderBy: { createdAt: "desc" },
    select: { payload: true },
  });
  return message?.payload ?? null;
}

function readMarks(payload: unknown): TeachingProgressMarks {
  const initial = initialTeachingProgress();
  if (typeof payload !== "object" || payload === null || !("book" in payload)) {
    return initial;
  }
  const book = payload.book;
  if (typeof book !== "object" || book === null) {
    return initial;
  }
  const marks = book as Partial<TeachingProgressMarks>;
  return {
    hintCount: numberOr(marks.hintCount, 0),
    incorrectEvaluations: numberOr(marks.incorrectEvaluations, 0),
    usedCheckPositions: Array.isArray(marks.usedCheckPositions)
      ? marks.usedCheckPositions.filter((item: unknown): item is number => typeof item === "number")
      : [],
    recapSummarized: marks.recapSummarized === true,
    homeworkPersisted: marks.homeworkPersisted === true,
  };
}

function storedPayload(response: TeachingTurnResponse): Prisma.InputJsonValue {
  return {
    status: "complete",
    response: JSON.parse(JSON.stringify(response)) as Prisma.InputJsonObject,
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function homeworkPrompt(proposed: string | null, blocks: LessonBlock[], objective: string): string {
  const text = proposed?.trim() || recapPracticePrompt(blocks) || objective;
  return text.slice(0, 280);
}

async function conceptIdsBySlug(
  tx: Prisma.TransactionClient,
  slugs: string[],
): Promise<Map<string, string>> {
  if (slugs.length === 0) {
    return new Map();
  }
  const rows = await tx.concept.findMany({
    where: { slug: { in: [...new Set(slugs)] } },
    select: { id: true, slug: true },
  });
  return new Map(rows.map((row) => [row.slug, row.id]));
}

async function recentAdaptiveEvidence(
  tx: Prisma.TransactionClient,
  userId: string,
  lessonId: string,
  conceptSlugs: readonly string[],
): Promise<PreparedTeachingTurn["recentEvidence"]> {
  const [events, attempts] = await Promise.all([
    tx.learningEvent.findMany({
      where: { userId, concept: { slug: { in: [...conceptSlugs] } } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { source: true, evidence: true, createdAt: true },
    }),
    tx.exerciseAttempt.findMany({
      where: { userId, passed: false, exercise: { lessonId } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { createdAt: true },
    }),
  ]);
  return [
    ...events.map((event) => ({
      source: event.source,
      outcome: classifyStoredEvidence(event.source, event.evidence),
      occurredAt: event.createdAt,
    })),
    ...attempts.map((attempt) => ({
      source: "exercise" as const,
      outcome: "failure" as const,
      occurredAt: attempt.createdAt,
    })),
  ]
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
    .slice(0, 5);
}

async function masteryForLesson(
  tx: Prisma.TransactionClient,
  userId: string,
  lessonId: string,
): Promise<Map<string, number>> {
  const rows = await tx.skillMastery.findMany({
    where: { userId, concept: { lessonConcepts: { some: { lessonId } } } },
    include: { concept: { select: { slug: true } } },
  });
  return new Map(rows.map((row) => [row.concept.slug, row.score]));
}

async function sessionHomework(
  tx: Prisma.TransactionClient,
  sessionId: string,
): Promise<TeachingHomeworkView | null> {
  const row = await tx.homeworkAssignment.findFirst({
    where: { sessionId },
    include: { lesson: { select: { slug: true, title: true } } },
    orderBy: { dueAt: "asc" },
  });
  if (row === null) {
    return null;
  }
  return toHomeworkView(row);
}

async function homeworkById(
  tx: Prisma.TransactionClient,
  homeworkId: string,
): Promise<TeachingHomeworkView | null> {
  const row = await tx.homeworkAssignment.findUnique({
    where: { id: homeworkId },
    include: { lesson: { select: { slug: true, title: true } } },
  });
  if (row === null) {
    return null;
  }
  return toHomeworkView(row);
}

async function homeworkView(
  tx: Prisma.TransactionClient,
  homeworkId: string,
  userId: string,
): Promise<{ view: TeachingHomeworkView; sessionId: string } | null> {
  const row = await tx.homeworkAssignment.findFirst({
    where: { id: homeworkId, userId },
    include: { lesson: { select: { slug: true, title: true } } },
  });
  if (row === null) {
    return null;
  }
  return {
    sessionId: row.sessionId,
    view: toHomeworkView(row),
  };
}

function toHomeworkView(row: {
  id: string;
  prompt: string;
  status: "assigned" | "done" | "skipped";
  dueAt: Date;
  completedAt: Date | null;
  lesson: { slug: string; title: string };
}): TeachingHomeworkView {
  return {
    id: row.id,
    prompt: row.prompt,
    status: row.status,
    dueAt: row.dueAt.toISOString(),
    completedAt: row.completedAt === null ? null : row.completedAt.toISOString(),
    lessonSlug: row.lesson.slug,
    lessonTitle: row.lesson.title,
    title: row.lesson.title,
  };
}

function phase1Mode(mode: string): Phase1TeachingMode {
  if (mode === "socratic") {
    return "socratic";
  }
  return "explain";
}

function toLocale(locale: string): Locale {
  if (locale === "az_AZ" || locale === "az-AZ") {
    return "az-AZ";
  }
  if (locale === "en" || locale === "tr" || locale === "ru") {
    return locale;
  }
  return "az-AZ";
}

function isTurnResponse(value: unknown): value is TeachingTurnResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  return "session" in value && "teacher" in value && "learning" in value && "usage" in value;
}
