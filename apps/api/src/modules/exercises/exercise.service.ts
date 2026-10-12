import { randomUUID } from "node:crypto";
import { HttpException, Inject, Injectable, Logger } from "@nestjs/common";
import {
  AiConfigurationError,
  AIProviderError,
  completeCodeReview,
  normalizeCodeReviewTurn,
  type CodeReviewSafetyDrop,
  parseCodeReviewResult,
  recordAiUsage,
  renderCodeReviewPrompt,
  type AIProvider,
  type ModelRouter,
} from "@platform/ai";
import { evaluateExercise, presentLearningCatalog, selectExercise } from "@platform/curriculum";
import {
  ExerciseRuleError,
  type ExerciseRepository,
  type IdentityRepository,
  type LearningCatalogSource,
  type StoredExercise,
} from "@platform/database";
import {
  EXECUTION_LIMITS,
  scoreExecution,
  type CodeExecutionRunner,
  type ExecutionStatus,
} from "@platform/execution";
import type {
  CodeReviewResponse,
  CodeReviewResult,
  ExerciseAttemptListResponse,
  ExerciseAttemptView,
  ExerciseListResponse,
  ExerciseView,
} from "@platform/types";
import type { CodeReviewRequest } from "@platform/validation";
import { aiFailureLogSuffix } from "../ai/ai-failure-log";
import { AI_PROVIDER, MODEL_ROUTER } from "../ai/ai.module";
import { IDENTITY_REPOSITORY } from "../identity/identity.repository";
import { CODE_EXECUTION_RUNNER } from "../execution/execution.tokens";
import { reviewExecutionFacts } from "./review-facts";
import { EXERCISE_REPOSITORY } from "./exercise.tokens";

const CODE_REVIEW_LIMIT = 10;
const CODE_REVIEW_WINDOW_MS = 10 * 60 * 1000;
const CODE_REVIEW_WAIT_MS = 20_000;

@Injectable()
export class ExerciseService {
  private readonly logger = new Logger(ExerciseService.name);

  constructor(
    @Inject(EXERCISE_REPOSITORY) private readonly exercises: ExerciseRepository,
    @Inject(IDENTITY_REPOSITORY) private readonly identity: IdentityRepository,
    @Inject(CODE_EXECUTION_RUNNER) private readonly runner: CodeExecutionRunner,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
    @Inject(MODEL_ROUTER) private readonly router: ModelRouter,
  ) {}

  async get(userId: string, exerciseId: string): Promise<ExerciseView> {
    const { exercise } = await this.openExercise(userId, exerciseId);
    return toView(exercise);
  }

  async listForLesson(userId: string, lessonSlug: string): Promise<ExerciseListResponse> {
    const source = await this.identity.loadLearningCatalog(userId);
    const lesson = source.modules
      .flatMap((module) => module.lessons)
      .find((item) => item.slug === lessonSlug);
    if (lesson === undefined || !lessonIsOpen(source, lesson.id)) {
      throw notFound();
    }
    const rows = await this.exercises.listPublishedForLesson(lesson.id);
    const visible = rows.filter((row) => row.published && row.rules !== null);
    const outcomes = await this.exercises.latestOutcomes(userId, lesson.id);
    const latest = new Map(outcomes.map((item) => [item.exerciseId, item.passed]));
    const primary = lesson.primaryConceptSlugs[0];
    const mastery = source.context.mastery.find((row) => row.conceptSlug === primary);
    const selected = selectExercise({
      masteryHigh: mastery !== undefined && mastery.score >= 80 && mastery.evidenceCount >= 8,
      exercises: visible.map((row, position) => ({
        id: row.id,
        position,
        required: row.difficulty === "beginner" || row.difficulty === "easy",
        challenge: row.difficulty === "advanced" || row.difficulty === "expert",
        targetsMisconception: false,
        status: latest.has(row.id) ? (latest.get(row.id) === true ? "passed" : "failed") : "unseen",
      })),
    });
    const ordered =
      selected === null
        ? visible
        : [
            ...visible.filter((row) => row.id === selected),
            ...visible.filter((row) => row.id !== selected),
          ];
    return { exercises: ordered.map(toView) };
  }

  async submit(
    userId: string,
    exerciseId: string,
    input: { clientAttemptId: string; submission: string },
  ): Promise<ExerciseAttemptView> {
    const { exercise, timeZone } = await this.openExercise(userId, exerciseId);
    const rules = exercise.rules;
    if (rules === null) {
      throw notFound();
    }
    if (exercise.execution === null) {
      return this.persist(
        userId,
        exercise,
        input,
        timeZone,
        evaluateExercise({
          type: exercise.type,
          rules,
          submission: input.submission,
        }),
      );
    }
    if (exercise.language !== "javascript") {
      throw notFound();
    }
    if (input.submission.trim().length === 0) {
      return this.persist(
        userId,
        exercise,
        input,
        timeZone,
        evaluateExercise({
          type: exercise.type,
          rules,
          submission: input.submission,
        }),
      );
    }

    const prepared = await this.exercises.prepareExecution({
      userId,
      exerciseId: exercise.id,
      clientAttemptId: input.clientAttemptId,
      now: new Date(),
    });
    if (prepared.kind === "stored") {
      return prepared.attempt;
    }
    if (prepared.kind === "busy") {
      throw busy();
    }
    if (prepared.kind === "wait") {
      const stored = await this.waitForAttempt(userId, exercise.id, input.clientAttemptId);
      if (stored !== null) {
        return stored;
      }
      throw busy();
    }

    const correlationId = randomUUID();
    try {
      const observation = await this.runner.execute({
        language: "javascript",
        entry: exercise.execution.entry,
        source: input.submission,
        tests: exercise.execution.tests.map((test) => ({
          id: test.id,
          args: test.args,
          expected: test.expected,
        })),
        timeoutMs: EXECUTION_LIMITS.timeoutMs,
        correlationId,
      });
      this.logger.log(
        `execution correlation=${correlationId} status=${observation.status} durationMs=${observation.durationMs}`,
      );
      if (observation.status === "runner_error") {
        throw unavailable();
      }
      return await this.persist(
        userId,
        exercise,
        input,
        timeZone,
        scoreExecution(exercise.execution, observation),
        observation.status,
      );
    } finally {
      await this.exercises.releaseExecution({
        userId,
        exerciseId: exercise.id,
        clientAttemptId: input.clientAttemptId,
      });
    }
  }

  async history(userId: string, exerciseId: string): Promise<ExerciseAttemptListResponse> {
    const { exercise } = await this.openExercise(userId, exerciseId);
    return { attempts: await this.exercises.listAttempts(userId, exercise.id) };
  }

  async review(
    userId: string,
    exerciseId: string,
    input: CodeReviewRequest,
  ): Promise<CodeReviewResponse> {
    const { exercise } = await this.openExercise(userId, exerciseId);
    const correlationId = randomUUID();
    const started = Date.now();
    const prepared = await this.exercises.prepareCodeReview({
      userId,
      exerciseId,
      attemptId: input.attemptId,
      clientReviewId: input.clientReviewId,
      mode: input.mode,
      now: new Date(),
      limit: CODE_REVIEW_LIMIT,
      windowMs: CODE_REVIEW_WINDOW_MS,
    });
    if (prepared === null) {
      throw notFound();
    }
    if (prepared.kind === "limited") {
      throw new HttpException(
        { code: "RATE_LIMITED", message: "Too many reviews. Try again later." },
        429,
      );
    }
    if (prepared.kind === "stored") {
      return { review: storedReview(prepared.review) };
    }
    if (prepared.kind === "wait") {
      const review = await this.waitForReview(userId, input);
      if (review === null) {
        throw aiUnavailable();
      }
      return { review };
    }

    try {
      const facts = reviewExecutionFacts({
        passedRules: prepared.target.passedRules,
        feedback: prepared.target.feedback,
        passed: prepared.target.passed,
        testCount: prepared.target.testCount,
      });
      if (facts === null) {
        throw aiUnavailable();
      }
      const prompt = renderCodeReviewPrompt({
        mode: input.mode,
        hintLevel: prepared.hintLevel,
        exercise: {
          title: prepared.target.title,
          objective: prepared.target.prompt,
          instructions: prepared.target.instructions,
          language: "javascript",
        },
        concepts: prepared.target.concepts,
        execution: {
          status: facts.status,
          passedTests: facts.passedTests,
          totalTests: facts.totalTests,
          score: prepared.target.score,
          passed: prepared.target.passed,
        },
        preferences: {
          locale: prepared.target.locale,
          explanationStyle: prepared.target.explanationStyle,
        },
        source: prepared.target.submission,
      });
      const route = this.router.resolve("code_review");
      const response = await completeCodeReview({
        router: this.router,
        provider: this.ai,
        system: prompt.system,
        user: prompt.user,
      });
      const normalized = normalizeCodeReviewTurn(response.json, {
        allowedConceptSlugs: new Set(prepared.target.allowedConceptSlugs),
        passed: prepared.target.passed,
        forbiddenLiterals: hiddenLiterals(exercise.execution),
      });
      const review = normalized.result;
      const usage = recordAiUsage({
        userId,
        task: "code_review",
        provider: route.provider,
        model: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        inputMicrosPerMillion: route.inputMicrosPerMillion,
        outputMicrosPerMillion: route.outputMicrosPerMillion,
        cached: false,
        latencyMs: response.latencyMs,
        correlationId,
        sessionId: null,
      });
      await this.exercises.recordCodeReviewUsage({
        userId,
        provider: usage.provider,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costMicros: usage.estimatedCostMicros,
        latencyMs: usage.latencyMs,
        correlationId,
      });
      await this.exercises.completeCodeReview(prepared.reviewId, review, new Date());
      this.logger.log(
        `review correlation=${correlationId} mode=${input.mode} status=completed durationMs=${Date.now() - started}${safetyDropSuffix(normalized.safetyDrops)}`,
      );
      return { review };
    } catch (error) {
      await this.exercises.releaseCodeReview(prepared.reviewId).catch(() => undefined);
      if (isReviewFailure(error)) {
        this.logger.warn(
          `review correlation=${correlationId} mode=${input.mode} status=unavailable ${aiFailureLogSuffix(error)} durationMs=${Date.now() - started}`,
        );
        throw aiUnavailable();
      }
      throw error;
    }
  }

  private async waitForReview(
    userId: string,
    input: CodeReviewRequest,
  ): Promise<CodeReviewResult | null> {
    const deadline = Date.now() + CODE_REVIEW_WAIT_MS;
    while (Date.now() < deadline) {
      const row = await this.exercises.findCodeReview({
        userId,
        attemptId: input.attemptId,
        clientReviewId: input.clientReviewId,
        mode: input.mode,
      });
      if (row === null) {
        return null;
      }
      if (row.status === "completed") {
        return storedReview(row.review);
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return null;
  }

  private async persist(
    userId: string,
    exercise: StoredExercise,
    input: { clientAttemptId: string; submission: string },
    timeZone: string,
    evaluation: {
      score: number;
      passed: boolean;
      feedback: string;
      passedRules: ExerciseAttemptView["passedRules"];
      failedRules: ExerciseAttemptView["failedRules"];
    },
    executionStatus?: ExecutionStatus,
  ): Promise<ExerciseAttemptView> {
    try {
      return await this.exercises.submit({
        userId,
        exerciseId: exercise.id,
        conceptId: exercise.conceptId,
        clientAttemptId: input.clientAttemptId,
        submission: input.submission,
        score: evaluation.score,
        passed: evaluation.passed,
        feedback: evaluation.feedback,
        passedRules: evaluation.passedRules,
        failedRules: evaluation.failedRules,
        executionStatus,
        now: new Date(),
        timeZone,
      });
    } catch (error) {
      if (error instanceof ExerciseRuleError) {
        throw new HttpException({ code: error.code, message: error.message }, error.status);
      }
      throw error;
    }
  }

  private async waitForAttempt(
    userId: string,
    exerciseId: string,
    clientAttemptId: string,
  ): Promise<ExerciseAttemptView | null> {
    const deadline = Date.now() + EXECUTION_LIMITS.timeoutMs + 6_000;
    while (Date.now() < deadline) {
      const stored = await this.exercises.findClientAttempt(userId, exerciseId, clientAttemptId);
      if (stored !== null) {
        return stored;
      }
      const pending = await this.exercises.executionPending({
        userId,
        exerciseId,
        clientAttemptId,
      });
      if (!pending) {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return null;
  }

  private async openExercise(userId: string, exerciseId: string) {
    const exercise = await this.exercises.findById(exerciseId);
    if (exercise === null || !exercise.published || exercise.rules === null) {
      throw notFound();
    }
    const source = await this.identity.loadLearningCatalog(userId);
    if (!lessonIsOpen(source, exercise.lessonId)) {
      throw notFound();
    }
    return { exercise, timeZone: source.context.timeZone };
  }
}

function lessonIsOpen(source: LearningCatalogSource, lessonId: string): boolean {
  const sourceLesson = source.modules
    .flatMap((module) => module.lessons)
    .find((item) => item.id === lessonId);
  if (sourceLesson === undefined) {
    return false;
  }
  const catalog = presentLearningCatalog({
    now: new Date(),
    path: source.path,
    modules: source.modules,
    concepts: source.concepts,
    context: source.context,
  });
  const lesson = catalog.modules
    .flatMap((module) => module.lessons)
    .find((item) => item.slug === sourceLesson.slug);
  return (
    lesson !== undefined &&
    (lesson.availability === "current" ||
      lesson.availability === "completed" ||
      lesson.availability === "practice")
  );
}

function toView(exercise: {
  id: string;
  slug: string;
  lessonSlug: string;
  title: string;
  prompt: string;
  instructions: string;
  type: ExerciseView["type"];
  language: ExerciseView["language"];
  difficulty: ExerciseView["difficulty"];
  starterCode: string | null;
  options: ExerciseView["options"];
  execution: StoredExercise["execution"];
}): ExerciseView {
  return {
    id: exercise.id,
    slug: exercise.slug,
    lessonSlug: exercise.lessonSlug,
    title: exercise.title,
    prompt: exercise.prompt,
    instructions: exercise.instructions,
    type: exercise.type,
    language: exercise.language,
    difficulty: exercise.difficulty,
    starterCode: exercise.starterCode,
    options: exercise.options,
    executionAvailable: exercise.execution !== null,
  };
}

function safetyDropSuffix(drops: readonly CodeReviewSafetyDrop[]): string {
  if (drops.length === 0) {
    return "";
  }
  return ` safety_drops=${drops.map((drop) => `${drop.path}:${drop.category}:${drop.count}`).join(",")}`;
}

function hiddenLiterals(execution: StoredExercise["execution"]): string[] {
  if (execution === null) {
    return [];
  }
  const values: string[] = [];
  for (const test of execution.tests) {
    values.push(test.id);
    collectLiteral(test.expected, values);
    for (const arg of test.args) {
      collectLiteral(arg, values);
    }
  }
  return [...new Set(values.filter((item) => item.length >= 3 && !/^\d+$/.test(item)))];
}

function collectLiteral(value: unknown, values: string[]): void {
  if (typeof value === "string") {
    values.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectLiteral(item, values);
    }
  }
}

function storedReview(value: unknown): CodeReviewResult {
  try {
    return parseCodeReviewResult(value);
  } catch {
    throw aiUnavailable();
  }
}

function isReviewFailure(error: unknown): boolean {
  return error instanceof AIProviderError || error instanceof AiConfigurationError;
}

function aiUnavailable(): HttpException {
  return new HttpException(
    { code: "AI_UNAVAILABLE", message: "The teacher is temporarily unavailable." },
    503,
  );
}

function notFound(): HttpException {
  return new HttpException({ code: "NOT_FOUND", message: "That exercise was not found." }, 404);
}

function unavailable(): HttpException {
  return new HttpException(
    { code: "EXECUTION_UNAVAILABLE", message: "Execution is unavailable." },
    503,
  );
}

function busy(): HttpException {
  return new HttpException({ code: "EXECUTION_BUSY", message: "Execution is busy." }, 503);
}
