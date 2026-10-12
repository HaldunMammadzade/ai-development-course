import { PrismaPg } from "@prisma/adapter-pg";
import {
  EXERCISE_ATTEMPT_LIMIT,
  EXERCISE_ATTEMPT_WINDOW_MS,
  exerciseMasteryUpdate,
} from "@platform/curriculum";
import { EXECUTION_LIMITS, type ExecutionStatus } from "@platform/execution";
import type {
  CodeReviewMode,
  Difficulty,
  ExecutionConfig,
  ExerciseAttemptView,
  ExerciseLanguage,
  ExerciseOptionDefinition,
  ExerciseRule,
  ExerciseRuleSummary,
  ExerciseType,
  ExplanationStyle,
  Locale,
} from "@platform/types";
import { executionConfigSchema, exerciseRulesSchema } from "@platform/validation";
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { writeSkillMasteryProjection } from "./progress-repository";
import { assertFeature, CommercialRuleError, readCommercialPlan } from "./commercial-access";

export class ExerciseRuleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ExerciseRuleError";
  }
}

export interface StoredExercise {
  id: string;
  slug: string;
  lessonId: string;
  lessonSlug: string;
  conceptId: string;
  title: string;
  prompt: string;
  instructions: string;
  type: ExerciseType;
  language: ExerciseLanguage | null;
  difficulty: Difficulty;
  starterCode: string | null;
  published: boolean;
  options: ExerciseOptionDefinition[];
  rules: ExerciseRule[] | null;
  execution: ExecutionConfig | null;
}

export type ExecutionPreparation =
  | { kind: "stored"; attempt: ExerciseAttemptView }
  | { kind: "claimed" }
  | { kind: "busy" }
  | { kind: "wait" };

export interface NewExerciseAttempt {
  userId: string;
  exerciseId: string;
  conceptId: string;
  clientAttemptId: string;
  submission: string;
  score: number;
  passed: boolean;
  feedback: string;
  passedRules: ExerciseRuleSummary[];
  failedRules: ExerciseRuleSummary[];
  executionStatus?: ExecutionStatus;
  now: Date;
  timeZone: string;
}

export interface ReviewConcept {
  slug: string;
  name: string;
  mastery: "weak" | "developing" | "secure" | null;
}

export interface ReviewTarget {
  attemptId: string;
  submission: string;
  score: number;
  passed: boolean;
  feedback: string;
  testCount: number;
  title: string;
  prompt: string;
  instructions: string;
  concepts: ReviewConcept[];
  allowedConceptSlugs: string[];
  explanationStyle: ExplanationStyle;
  locale: Locale;
  passedRules: Prisma.JsonValue;
}

export type ReviewPreparation =
  | { kind: "stored"; review: unknown }
  | { kind: "claimed"; reviewId: string; hintLevel: number; target: ReviewTarget }
  | { kind: "wait" }
  | { kind: "limited" }
  | null;

export interface ExerciseRepository {
  findById(exerciseId: string): Promise<StoredExercise | null>;
  listPublishedForLesson(lessonId: string): Promise<StoredExercise[]>;
  latestOutcomes(
    userId: string,
    lessonId: string,
  ): Promise<Array<{ exerciseId: string; passed: boolean }>>;
  prepareExecution(input: {
    userId: string;
    exerciseId: string;
    clientAttemptId: string;
    now: Date;
  }): Promise<ExecutionPreparation>;
  executionPending(input: {
    userId: string;
    exerciseId: string;
    clientAttemptId: string;
  }): Promise<boolean>;
  releaseExecution(input: {
    userId: string;
    exerciseId: string;
    clientAttemptId: string;
  }): Promise<void>;
  findClientAttempt(
    userId: string,
    exerciseId: string,
    clientAttemptId: string,
  ): Promise<ExerciseAttemptView | null>;
  submit(input: NewExerciseAttempt): Promise<ExerciseAttemptView>;
  listAttempts(userId: string, exerciseId: string): Promise<ExerciseAttemptView[]>;
  prepareCodeReview(input: {
    userId: string;
    exerciseId: string;
    attemptId: string;
    clientReviewId: string;
    mode: CodeReviewMode;
    now: Date;
    limit: number;
    windowMs: number;
  }): Promise<ReviewPreparation>;
  findCodeReview(input: {
    userId: string;
    attemptId: string;
    clientReviewId: string;
    mode: CodeReviewMode;
  }): Promise<{ status: "completed"; review: unknown } | { status: "pending" } | null>;
  completeCodeReview(reviewId: string, result: unknown, now: Date): Promise<void>;
  releaseCodeReview(reviewId: string): Promise<void>;
  recordCodeReviewUsage(input: {
    userId: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costMicros: bigint;
    latencyMs: number;
    correlationId: string;
  }): Promise<void>;
  disconnect(): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createExerciseRepository(databaseUrl: string): ExerciseRepository {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  return new PrismaExerciseRepository(prisma);
}

class PrismaExerciseRepository implements ExerciseRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(exerciseId: string): Promise<StoredExercise | null> {
    if (!UUID.test(exerciseId)) {
      return null;
    }
    const row = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: { lesson: { select: { slug: true } } },
    });
    return row === null ? null : toStored(row);
  }

  async listPublishedForLesson(lessonId: string): Promise<StoredExercise[]> {
    const rows = await this.prisma.exercise.findMany({
      where: { lessonId, published: true },
      include: { lesson: { select: { slug: true } } },
      orderBy: { position: "asc" },
    });
    return rows.map(toStored);
  }

  async latestOutcomes(
    userId: string,
    lessonId: string,
  ): Promise<Array<{ exerciseId: string; passed: boolean }>> {
    const rows = await this.prisma.exerciseAttempt.findMany({
      where: { userId, exercise: { lessonId } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { exerciseId: true, passed: true },
    });
    const seen = new Set<string>();
    return rows.filter((row) => {
      if (seen.has(row.exerciseId)) {
        return false;
      }
      seen.add(row.exerciseId);
      return true;
    });
  }

  async prepareExecution(input: {
    userId: string;
    exerciseId: string;
    clientAttemptId: string;
    now: Date;
  }): Promise<ExecutionPreparation> {
    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, input.userId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(12, 12)`;
      const existing = await tx.exerciseAttempt.findUnique({
        where: { userId_exerciseId_clientAttemptId: claimKey(input) },
      });
      if (existing !== null) {
        return { kind: "stored", attempt: toAttempt(existing) };
      }
      const staleBefore = new Date(input.now.getTime() - EXECUTION_LIMITS.claimTtlMs);
      await tx.exerciseExecutionClaim.deleteMany({
        where: { createdAt: { lt: staleBefore } },
      });
      await tx.projectExecutionClaim.deleteMany({
        where: { createdAt: { lt: staleBefore } },
      });
      await tx.interviewExecutionClaim.deleteMany({
        where: { createdAt: { lt: staleBefore } },
      });
      const own = await tx.exerciseExecutionClaim.findUnique({
        where: { userId_exerciseId_clientAttemptId: claimKey(input) },
      });
      if (own !== null) {
        return { kind: "wait" };
      }
      const exerciseClaims = await tx.exerciseExecutionClaim.count();
      const projectClaims = await tx.projectExecutionClaim.count();
      const interviewClaims = await tx.interviewExecutionClaim.count();
      const active = exerciseClaims + projectClaims + interviewClaims;
      if (active >= EXECUTION_LIMITS.maxConcurrent) {
        return { kind: "busy" };
      }
      await tx.exerciseExecutionClaim.create({
        data: { ...claimKey(input), createdAt: input.now },
      });
      return { kind: "claimed" };
    });
  }

  async executionPending(input: {
    userId: string;
    exerciseId: string;
    clientAttemptId: string;
  }): Promise<boolean> {
    const claim = await this.prisma.exerciseExecutionClaim.findUnique({
      where: { userId_exerciseId_clientAttemptId: claimKey(input) },
      select: { clientAttemptId: true },
    });
    return claim !== null;
  }

  async releaseExecution(input: {
    userId: string;
    exerciseId: string;
    clientAttemptId: string;
  }): Promise<void> {
    await this.prisma.exerciseExecutionClaim.deleteMany({
      where: claimKey(input),
    });
  }

  async findClientAttempt(
    userId: string,
    exerciseId: string,
    clientAttemptId: string,
  ): Promise<ExerciseAttemptView | null> {
    const row = await this.prisma.exerciseAttempt.findUnique({
      where: { userId_exerciseId_clientAttemptId: { userId, exerciseId, clientAttemptId } },
    });
    return row === null ? null : toAttempt(row);
  }

  async submit(input: NewExerciseAttempt): Promise<ExerciseAttemptView> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await lockUser(tx, input.userId);
          const existing = await tx.exerciseAttempt.findUnique({
            where: {
              userId_exerciseId_clientAttemptId: {
                userId: input.userId,
                exerciseId: input.exerciseId,
                clientAttemptId: input.clientAttemptId,
              },
            },
          });
          if (existing !== null) {
            return toAttempt(existing);
          }

          const recent = await tx.exerciseAttempt.count({
            where: {
              userId: input.userId,
              createdAt: { gte: new Date(input.now.getTime() - EXERCISE_ATTEMPT_WINDOW_MS) },
            },
          });
          if (recent >= EXERCISE_ATTEMPT_LIMIT) {
            throw new ExerciseRuleError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
          }

          const attemptNumber =
            (await tx.exerciseAttempt.count({
              where: { userId: input.userId, exerciseId: input.exerciseId },
            })) + 1;
          const created = await tx.exerciseAttempt.create({
            data: {
              exerciseId: input.exerciseId,
              userId: input.userId,
              clientAttemptId: input.clientAttemptId,
              submission: input.submission,
              status: input.passed ? "passed" : "failed",
              score: input.score,
              passed: input.passed,
              feedback: input.feedback,
              passedRules: JSON.parse(
                JSON.stringify(storedPassedRules(input.passedRules, input.executionStatus)),
              ) as Prisma.InputJsonValue,
              failedRules: JSON.parse(JSON.stringify(input.failedRules)) as Prisma.InputJsonValue,
              attemptNumber,
              createdAt: input.now,
            },
          });
          const update = exerciseMasteryUpdate(input.score);
          if (input.passed && update !== null) {
            await tx.learningEvent.create({
              data: {
                userId: input.userId,
                conceptId: input.conceptId,
                source: "exercise",
                sourceId: created.id,
                evidence: update.evidence,
                weight: update.weight,
                metadata: { outcome: "passed", score: input.score },
              },
            });
            await writeSkillMasteryProjection(tx, {
              userId: input.userId,
              conceptId: input.conceptId,
              now: input.now,
              timeZone: input.timeZone,
            });
          }
          return toAttempt(created);
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.prisma.exerciseAttempt.findUnique({
          where: {
            userId_exerciseId_clientAttemptId: {
              userId: input.userId,
              exerciseId: input.exerciseId,
              clientAttemptId: input.clientAttemptId,
            },
          },
        });
        if (existing !== null) {
          return toAttempt(existing);
        }
      }
      throw error;
    }
  }

  async listAttempts(userId: string, exerciseId: string): Promise<ExerciseAttemptView[]> {
    const rows = await this.prisma.exerciseAttempt.findMany({
      where: { userId, exerciseId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return rows.map(toAttempt);
  }

  async prepareCodeReview(input: {
    userId: string;
    exerciseId: string;
    attemptId: string;
    clientReviewId: string;
    mode: CodeReviewMode;
    now: Date;
    limit: number;
    windowMs: number;
  }): Promise<ReviewPreparation> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockUser(tx, input.userId);
        const attempt = await tx.exerciseAttempt.findUnique({ where: { id: input.attemptId } });
        if (
          attempt === null ||
          attempt.userId !== input.userId ||
          attempt.exerciseId !== input.exerciseId
        ) {
          return null;
        }
        const exercise = await tx.exercise.findUnique({
          where: { id: input.exerciseId },
          include: {
            concept: {
              include: { prerequisites: { include: { prerequisite: true } } },
            },
            lesson: { include: { concepts: { include: { concept: true } } } },
          },
        });
        if (
          exercise === null ||
          exercise.type !== "code_text" ||
          exercise.language !== "javascript" ||
          executionConfigSchema.safeParse(exercise.execution).success !== true
        ) {
          return null;
        }
        const existing = await tx.codeReview.findUnique({
          where: {
            userId_attemptId_clientReviewId_mode: {
              userId: input.userId,
              attemptId: input.attemptId,
              clientReviewId: input.clientReviewId,
              mode: input.mode,
            },
          },
        });
        if (existing?.status === "completed") {
          return { kind: "stored", review: existing.result };
        }
        if (existing?.status === "pending") {
          return { kind: "wait" };
        }
        const commercial = await readCommercialPlan(tx, input.userId, input.now);
        if (commercial !== null) {
          try {
            assertFeature(commercial, "codeReview");
          } catch (error) {
            if (error instanceof CommercialRuleError) {
              throw new ExerciseRuleError(error.status, error.code, error.message);
            }
            throw error;
          }
          const day = new Date(input.now.getTime() - 24 * 60 * 60 * 1000);
          const reviews = await tx.codeReview.count({
            where: { userId: input.userId, status: "completed", createdAt: { gte: day } },
          });
          if (reviews >= commercial.entitlements.dailyCodeReviews) {
            throw new ExerciseRuleError(
              429,
              "QUOTA_EXCEEDED",
              "The code-review quota for this plan is reached.",
            );
          }
        }
        const windowStart = new Date(
          Math.floor(input.now.getTime() / input.windowMs) * input.windowMs,
        );
        const bucket = await tx.authRateBucket.upsert({
          where: {
            action_subjectHash_windowStart: {
              action: "code_review",
              subjectHash: input.userId,
              windowStart,
            },
          },
          create: {
            action: "code_review",
            subjectHash: input.userId,
            windowStart,
            hits: 1,
          },
          update: { hits: { increment: 1 } },
        });
        if (bucket.hits > input.limit) {
          return { kind: "limited" };
        }
        const hints = await tx.codeReview.count({
          where: { attemptId: input.attemptId, mode: "hint", status: "completed" },
        });
        const user = await tx.user.findUnique({
          where: { id: input.userId },
          select: { locale: true, studentPreferences: { select: { explanationStyle: true } } },
        });
        const concepts = reviewConcepts(exercise);
        const mastery = await tx.skillMastery.findMany({
          where: {
            userId: input.userId,
            concept: { slug: { in: concepts.map((item) => item.slug) } },
          },
          include: { concept: { select: { slug: true } } },
        });
        const review = await tx.codeReview.create({
          data: {
            userId: input.userId,
            exerciseId: input.exerciseId,
            attemptId: input.attemptId,
            clientReviewId: input.clientReviewId,
            mode: input.mode,
            status: "pending",
          },
        });
        return {
          kind: "claimed",
          reviewId: review.id,
          hintLevel: Math.min(3, hints + 1),
          target: reviewTarget(exercise, attempt, concepts, mastery, user),
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { kind: "wait" };
      }
      throw error;
    }
  }

  async findCodeReview(input: {
    userId: string;
    attemptId: string;
    clientReviewId: string;
    mode: CodeReviewMode;
  }): Promise<{ status: "completed"; review: unknown } | { status: "pending" } | null> {
    const row = await this.prisma.codeReview.findUnique({
      where: {
        userId_attemptId_clientReviewId_mode: {
          userId: input.userId,
          attemptId: input.attemptId,
          clientReviewId: input.clientReviewId,
          mode: input.mode,
        },
      },
    });
    if (row === null) {
      return null;
    }
    return row.status === "completed"
      ? { status: "completed", review: row.result }
      : { status: "pending" };
  }

  async completeCodeReview(reviewId: string, result: unknown, now: Date): Promise<void> {
    await this.prisma.codeReview.update({
      where: { id: reviewId },
      data: { status: "completed", result: result as Prisma.InputJsonValue, completedAt: now },
    });
  }

  async releaseCodeReview(reviewId: string): Promise<void> {
    await this.prisma.codeReview.deleteMany({ where: { id: reviewId, status: "pending" } });
  }

  async recordCodeReviewUsage(input: {
    userId: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costMicros: bigint;
    latencyMs: number;
    correlationId: string;
  }): Promise<void> {
    await this.prisma.aiUsage.create({
      data: {
        userId: input.userId,
        sessionId: null,
        taskType: "code_review",
        provider: input.provider,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costMicros: input.costMicros,
        latencyMs: input.latencyMs,
        cached: false,
        correlationId: input.correlationId,
      },
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

function claimKey(input: { userId: string; exerciseId: string; clientAttemptId: string }): {
  userId: string;
  exerciseId: string;
  clientAttemptId: string;
} {
  return {
    userId: input.userId,
    exerciseId: input.exerciseId,
    clientAttemptId: input.clientAttemptId,
  };
}

async function lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE id = CAST(${userId} AS uuid) FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new ExerciseRuleError(404, "NOT_FOUND", "That exercise was not found.");
  }
}

function reviewConcepts(exercise: {
  concept: {
    slug: string;
    name: string;
    prerequisites: Array<{ prerequisite: { slug: string; name: string } }>;
  };
  lesson: { concepts: Array<{ concept: { slug: string; name: string } }> };
}): Array<{ slug: string; name: string }> {
  const rows = [
    { slug: exercise.concept.slug, name: exercise.concept.name },
    ...exercise.concept.prerequisites.map((row) => ({
      slug: row.prerequisite.slug,
      name: row.prerequisite.name,
    })),
    ...exercise.lesson.concepts.map((row) => ({ slug: row.concept.slug, name: row.concept.name })),
  ];
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.slug)) {
      return false;
    }
    seen.add(row.slug);
    return true;
  });
}

function reviewTarget(
  exercise: {
    title: string;
    prompt: string;
    instructions: string;
    execution: Prisma.JsonValue | null;
    concept: {
      slug: string;
      name: string;
      prerequisites: Array<{ prerequisite: { slug: string; name: string } }>;
    };
    lesson: { concepts: Array<{ concept: { slug: string; name: string } }> };
  },
  attempt: {
    id: string;
    submission: string;
    score: number;
    passed: boolean;
    feedback: string;
    passedRules: Prisma.JsonValue;
  },
  concepts: Array<{ slug: string; name: string }>,
  mastery: Array<{ score: number; concept: { slug: string } }>,
  user: {
    locale: string;
    studentPreferences: { explanationStyle: ExplanationStyle } | null;
  } | null,
): ReviewTarget {
  const scores = new Map(mastery.map((row) => [row.concept.slug, row.score]));
  const parsed = executionConfigSchema.safeParse(exercise.execution);
  return {
    attemptId: attempt.id,
    submission: attempt.submission,
    score: attempt.score,
    passed: attempt.passed,
    feedback: attempt.feedback,
    testCount: parsed.success ? parsed.data.tests.length : 0,
    title: exercise.title,
    prompt: exercise.prompt,
    instructions: exercise.instructions,
    concepts: concepts.map((concept) => ({
      ...concept,
      mastery: masteryBand(scores.get(concept.slug)),
    })),
    allowedConceptSlugs: concepts.map((concept) => concept.slug),
    explanationStyle: user?.studentPreferences?.explanationStyle ?? "clear",
    locale: toReviewLocale(user?.locale ?? "az_AZ"),
    passedRules: attempt.passedRules,
  };
}

function storedPassedRules(
  rules: ExerciseRuleSummary[],
  executionStatus: ExecutionStatus | undefined,
): Array<ExerciseRuleSummary | { executionStatus: ExecutionStatus }> {
  if (executionStatus === undefined) {
    return rules;
  }
  return [...rules, { executionStatus }];
}

function masteryBand(score: number | undefined): ReviewConcept["mastery"] {
  if (score === undefined) {
    return null;
  }
  if (score < 45) {
    return "weak";
  }
  if (score < 75) {
    return "developing";
  }
  return "secure";
}

function toReviewLocale(locale: string): Locale {
  if (locale === "az_AZ" || locale === "az-AZ") {
    return "az-AZ";
  }
  if (locale === "en" || locale === "tr" || locale === "ru") {
    return locale;
  }
  return "az-AZ";
}

function toStored(row: {
  id: string;
  slug: string;
  lessonId: string;
  conceptId: string;
  title: string;
  prompt: string;
  instructions: string;
  type: ExerciseType;
  language: ExerciseLanguage | null;
  difficulty: Difficulty;
  starterCode: string | null;
  published: boolean;
  options: Prisma.JsonValue;
  rules: Prisma.JsonValue;
  execution: Prisma.JsonValue | null;
  lesson: { slug: string };
}): StoredExercise {
  const parsed = exerciseRulesSchema.safeParse(row.rules);
  const execution = readExecution(row.execution);
  return {
    id: row.id,
    slug: row.slug,
    lessonId: row.lessonId,
    lessonSlug: row.lesson.slug,
    conceptId: row.conceptId,
    title: row.title,
    prompt: row.prompt,
    instructions: row.instructions,
    type: row.type,
    language: row.language,
    difficulty: row.difficulty,
    starterCode: row.starterCode,
    published: row.published,
    options: readOptions(row.options),
    rules: parsed.success && execution !== "invalid" ? parsed.data : null,
    execution: execution === "invalid" ? null : execution,
  };
}

function readExecution(value: Prisma.JsonValue | null): ExecutionConfig | null | "invalid" {
  if (value === null) {
    return null;
  }
  const parsed = executionConfigSchema.safeParse(value);
  return parsed.success ? parsed.data : "invalid";
}

function readOptions(value: Prisma.JsonValue): ExerciseOptionDefinition[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const options: ExerciseOptionDefinition[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      continue;
    }
    const id = "id" in item ? item.id : undefined;
    const label = "label" in item ? item.label : undefined;
    if (typeof id === "string" && typeof label === "string") {
      options.push({ id, label });
    }
  }
  return options;
}

function toAttempt(row: {
  id: string;
  exerciseId: string;
  status: "passed" | "failed";
  score: number;
  passed: boolean;
  feedback: string;
  passedRules: Prisma.JsonValue;
  failedRules: Prisma.JsonValue;
  attemptNumber: number;
  submission: string;
  createdAt: Date;
}): ExerciseAttemptView {
  return {
    id: row.id,
    exerciseId: row.exerciseId,
    status: row.status,
    score: row.score,
    passed: row.passed,
    feedback: row.feedback,
    passedRules: readSummaries(row.passedRules),
    failedRules: readSummaries(row.failedRules),
    attemptNumber: row.attemptNumber,
    submission: row.submission,
    createdAt: row.createdAt.toISOString(),
  };
}

function readSummaries(value: Prisma.JsonValue): ExerciseRuleSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const summaries: ExerciseRuleSummary[] = [];
  for (const item of value) {
    if (typeof item === "object" && item !== null && "feedback" in item) {
      const feedback = item.feedback;
      if (typeof feedback === "string") {
        summaries.push({ feedback });
      }
    }
  }
  return summaries;
}
