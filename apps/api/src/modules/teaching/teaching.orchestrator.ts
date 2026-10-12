import { HttpException, Inject, Injectable, Logger } from "@nestjs/common";
import {
  AIProviderError,
  AiConfigurationError,
  TeachingModeUnavailableError,
  assertInputSize,
  buildTeacherContext,
  completeTeach,
  decodeTeacherJson,
  normalizeTeacherTurn,
  recordAiUsage,
  renderTeachPrompt,
  type AIProvider,
  type ModelRouter,
} from "@platform/ai";
import {
  currentTeachingBlock,
  hasRemainingCheckQuestion,
  lessonHasHarderCheck,
} from "@platform/curriculum";
import {
  TeachingRuleError,
  type CommitTeachingTurn,
  type PreparedTeachingTurn,
  type TeachingRepository,
} from "@platform/database";
import type {
  HomeworkCompletionResponse,
  HomeworkListResponse,
  Phase1TeachingMode,
  TeachingOpenResponse,
  TeachingSessionView,
  TeachingTurnResponse,
} from "@platform/types";
import { AI_PROVIDER, MODEL_ROUTER } from "../ai/ai.module";
import { elapsedMs, teachTimingEvent, type TeachTimingOutcome } from "./teach-timing";
import {
  TEACHING_CLOCK,
  TEACHING_MONOTONIC,
  TEACHING_REPOSITORY,
  type MonotonicClock,
  type TeachingClock,
} from "./teaching.tokens";

const UNAVAILABLE = "The teacher is temporarily unavailable.";
const WAIT_MS = 25_000;

@Injectable()
export class TeachingOrchestrator {
  private readonly logger = new Logger(TeachingOrchestrator.name);

  constructor(
    @Inject(TEACHING_REPOSITORY) private readonly teaching: TeachingRepository,
    @Inject(AI_PROVIDER) private readonly provider: AIProvider,
    @Inject(MODEL_ROUTER) private readonly router: ModelRouter,
    @Inject(TEACHING_CLOCK) private readonly clock: TeachingClock,
    @Inject(TEACHING_MONOTONIC) private readonly monotonic: MonotonicClock,
  ) {}

  open(userId: string, mode: Phase1TeachingMode): Promise<TeachingOpenResponse> {
    return this.guard(() => this.teaching.openSession({ userId, mode, now: this.clock.now() }));
  }

  get(userId: string, sessionId: string): Promise<TeachingSessionView> {
    return this.guard(() => this.teaching.getSession(userId, sessionId, this.clock.now()));
  }

  abandon(userId: string, sessionId: string): Promise<TeachingSessionView> {
    return this.guard(() => this.teaching.abandonSession(userId, sessionId, this.clock.now()));
  }

  listHomework(userId: string): Promise<HomeworkListResponse> {
    return this.guard(() => this.teaching.listHomework(userId));
  }

  completeHomework(userId: string, homeworkId: string): Promise<HomeworkCompletionResponse> {
    return this.guard(() => this.teaching.completeHomework(userId, homeworkId, this.clock.now()));
  }

  async turn(input: {
    userId: string;
    sessionId: string;
    clientTurnId: string;
    message?: string;
    advance: boolean;
    correlationId: string;
  }): Promise<TeachingTurnResponse> {
    const totalStarted = this.monotonic();
    const spans: TurnSpans = {
      prepareMs: null,
      promptMs: null,
      providerMs: null,
      commitMs: null,
      commitStarted: null,
      providerName: null,
      modelName: null,
    };
    let outcome: TeachTimingOutcome = "error";
    let errorCategory: string | null = null;
    let httpStatus: number | null = null;
    let schemaIssues: Array<{ path: string; code: string }> = [];
    let emitted = false;
    let ready = false;
    const classify = (error: unknown): string => {
      if (error instanceof AIProviderError) {
        httpStatus = error.httpStatus;
        schemaIssues = error.schemaIssues.map((issue) => ({ path: issue.path, code: issue.code }));
      } else {
        httpStatus = null;
        schemaIssues = [];
      }
      return categoryOf(error);
    };
    const emit = (): void => {
      if (emitted) {
        return;
      }
      emitted = true;
      this.logger.log(
        JSON.stringify(
          teachTimingEvent({
            correlationId: input.correlationId,
            outcome,
            error: errorCategory,
            httpStatus,
            schemaIssues,
            provider: spans.providerName,
            model: spans.modelName,
            prepareMs: spans.prepareMs,
            promptMs: spans.promptMs,
            providerMs: spans.providerMs,
            commitMs: spans.commitMs,
            totalMs: elapsedMs(totalStarted, this.monotonic()),
          }),
        ),
      );
    };

    try {
      const now = this.clock.now();
      const strongModel = teachRouteIsStrong(this.router);
      const prepareStarted = this.monotonic();
      let prepared: Awaited<ReturnType<TeachingRepository["prepareTurn"]>>;
      try {
        prepared = await this.guard(() =>
          this.teaching.prepareTurn({
            userId: input.userId,
            sessionId: input.sessionId,
            clientTurnId: input.clientTurnId,
            message: input.advance ? null : (input.message ?? null),
            now,
            strongModel,
          }),
        );
      } finally {
        spans.prepareMs = elapsedMs(prepareStarted, this.monotonic());
      }
      if (prepared.kind === "replay") {
        outcome = "replay";
        emit();
        return prepared.response;
      }
      if (prepared.kind === "failed") {
        outcome = "error";
        errorCategory = prepared.code;
        emit();
        throw new HttpException(
          { code: prepared.code, message: prepared.message },
          prepared.status,
        );
      }
      if (prepared.kind === "pending") {
        try {
          const response = await this.waitForTurn(input);
          outcome = "replay";
          emit();
          return response;
        } catch (error) {
          outcome = "error";
          errorCategory = classify(error);
          emit();
          throw error;
        }
      }

      ready = true;
      const committed = await this.invoke(prepared.snapshot, input.correlationId, now, spans);
      const response = await this.teaching.commitTurn(committed.turn);
      if (spans.commitStarted !== null) {
        spans.commitMs = elapsedMs(spans.commitStarted, this.monotonic());
      }
      if (committed.recoveredIssues.length > 0) {
        errorCategory = "teacher_schema_rejection";
        httpStatus = null;
        schemaIssues = committed.recoveredIssues.map((issue) => ({
          path: issue.path,
          code: issue.code,
        }));
      }
      outcome = "success";
      emit();
      return response;
    } catch (error) {
      if (emitted) {
        throw error;
      }
      if (ready) {
        const failure = aiFailure(error);
        if (spans.commitStarted === null) {
          spans.commitStarted = this.monotonic();
        }
        try {
          await this.teaching.failTurn({
            userId: input.userId,
            sessionId: input.sessionId,
            clientTurnId: input.clientTurnId,
            status: failure.status,
            code: failure.code,
            message: failure.message,
          });
        } finally {
          if (spans.commitStarted !== null) {
            spans.commitMs = elapsedMs(spans.commitStarted, this.monotonic());
          }
        }
        const category = classify(error);
        outcome = category === "timeout" ? "timeout" : "error";
        errorCategory = category;
        if (!(error instanceof TeachingRuleError) && !isProviderFailure(error)) {
          this.logger.error(error instanceof Error ? error.name : "teach failed");
        }
        emit();
        throw new HttpException({ code: failure.code, message: failure.message }, failure.status);
      }
      if (spans.prepareMs === null) {
        spans.prepareMs = elapsedMs(totalStarted, this.monotonic());
      }
      errorCategory = classify(error);
      outcome = errorCategory === "timeout" ? "timeout" : "error";
      emit();
      throw error;
    }
  }

  private async invoke(
    snapshot: PreparedTeachingTurn,
    correlationId: string,
    now: Date,
    spans: TurnSpans,
  ): Promise<{
    turn: CommitTeachingTurn;
    recoveredIssues: ReadonlyArray<{ path: string; code: string }>;
  }> {
    const promptStarted = this.monotonic();
    let prompt: ReturnType<typeof renderTeachPrompt>;
    let route: ReturnType<ModelRouter["resolve"]>;
    let context: ReturnType<typeof buildTeacherContext>;
    try {
      const assembled = assemblePrompt(snapshot);
      prompt = assembled.prompt;
      context = assembled.context;
      route = this.router.resolve("teach");
      assertInputSize({
        model: {
          provider: route.provider,
          model: route.model,
          maxOutputTokens: route.maxOutputTokens,
          temperature: route.temperature,
          timeoutMs: route.timeoutMs,
          maxInputChars: route.maxInputChars,
        },
        system: prompt.system,
        user: prompt.user,
        schemaName: "TeacherResult",
      });
      spans.providerName = route.provider;
      spans.modelName = route.model;
    } finally {
      spans.promptMs = elapsedMs(promptStarted, this.monotonic());
    }
    const providerStarted = this.monotonic();
    let response: Awaited<ReturnType<typeof completeTeach>>;
    try {
      response = await completeTeach({
        router: this.router,
        provider: this.provider,
        system: prompt.system,
        user: prompt.user,
      });
    } catch (error) {
      spans.providerMs = elapsedMs(providerStarted, this.monotonic());
      throw error;
    }
    spans.providerMs = elapsedMs(providerStarted, this.monotonic());
    spans.commitStarted = this.monotonic();
    if (response.model.length > 0) {
      spans.modelName = response.model;
    }
    const adaptive = {
      decision: context.learning.adaptive.decision,
      strategy: context.learning.adaptive.strategy,
      reason: context.learning.adaptive.reason,
    };
    const normalized = normalizeTeacherTurn(decodeTeacherJson(response.json), {
      allowedConceptSlugs: allowedConceptSlugs(snapshot),
      state: snapshot.state,
      mode: snapshot.mode,
      hintCount: snapshot.marks.hintCount,
      incorrectEvaluations: snapshot.marks.incorrectEvaluations,
      review: snapshot.reviewSession
        ? { active: true, focusValid: snapshot.reviewConceptSlug !== null }
        : undefined,
      lesson: {
        hasRemainingCheckQuestion: hasRemainingCheckQuestion(
          snapshot.lesson.blocks,
          new Set(snapshot.marks.usedCheckPositions),
        ),
        hasHarderCheck: lessonHasHarderCheck(snapshot.lesson.blocks),
        recapSummarized: snapshot.marks.recapSummarized,
        homeworkPersisted: snapshot.marks.homeworkPersisted,
      },
      allowCache: context.allowCache,
      studentName: context.student.name,
      locale: snapshot.locale,
      explanationStyle: snapshot.explanationStyle,
    });
    // Personalized teaching turns are not written to explanation_cache.
    const usage = recordAiUsage({
      userId: snapshot.userId,
      task: "teach",
      provider: route.provider,
      model: response.model.length > 0 ? response.model : route.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      inputMicrosPerMillion: route.inputMicrosPerMillion,
      outputMicrosPerMillion: route.outputMicrosPerMillion,
      cached: false,
      latencyMs: response.latencyMs > 0 ? response.latencyMs : (spans.providerMs ?? 0),
      correlationId,
      sessionId: snapshot.sessionId,
      createdAt: now,
    });
    const accepted = normalized.accepted;
    return {
      turn: {
        userId: snapshot.userId,
        sessionId: snapshot.sessionId,
        clientTurnId: snapshot.clientTurnId,
        expectedState: snapshot.state,
        speech: accepted.speech,
        understanding: accepted.understanding,
        state: accepted.state,
        skillUpdates: accepted.skillUpdates,
        misconception: accepted.misconception,
        memoryNotes: accepted.memoryNotes,
        homework: accepted.homework,
        reviewConceptSlug: snapshot.reviewConceptSlug,
        adaptive,
        usage: {
          provider: usage.provider,
          model: usage.model,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          costMicros: usage.estimatedCostMicros,
          latencyMs: usage.latencyMs,
          correlationId: usage.correlationId,
        },
        now,
      },
      recoveredIssues: normalized.recoveredIssues,
    };
  }

  private async waitForTurn(input: {
    userId: string;
    sessionId: string;
    clientTurnId: string;
  }): Promise<TeachingTurnResponse> {
    const deadline = Date.now() + WAIT_MS;
    while (Date.now() < deadline) {
      const claim = await this.teaching.readClaim(
        input.userId,
        input.sessionId,
        input.clientTurnId,
      );
      if (claim.kind === "replay" && claim.response !== undefined) {
        return claim.response;
      }
      if (
        claim.kind === "failed" &&
        claim.status !== undefined &&
        claim.code !== undefined &&
        claim.message !== undefined
      ) {
        throw new HttpException({ code: claim.code, message: claim.message }, claim.status);
      }
      if (claim.kind === "missing") {
        break;
      }
      await delay(50);
    }
    throw new HttpException(
      { code: "TURN_IN_PROGRESS", message: "A teaching turn is already in progress." },
      409,
    );
  }

  private async guard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof TeachingRuleError) {
        throw new HttpException({ code: error.code, message: error.message }, error.status);
      }
      throw error;
    }
  }
}

interface TurnSpans {
  prepareMs: number | null;
  promptMs: number | null;
  providerMs: number | null;
  commitMs: number | null;
  commitStarted: number | null;
  providerName: string | null;
  modelName: string | null;
}

function assemblePrompt(snapshot: PreparedTeachingTurn): {
  prompt: ReturnType<typeof renderTeachPrompt>;
  context: ReturnType<typeof buildTeacherContext>;
} {
  const block = currentTeachingBlock(
    snapshot.lesson.blocks,
    snapshot.state,
    snapshot.marks.usedCheckPositions,
  );
  const context = buildTeacherContext({
    student: {
      name: snapshot.studentName,
      locale: snapshot.locale,
      timezone: snapshot.timeZone,
      explanationStyle: snapshot.explanationStyle,
      challengeLevel: snapshot.challengeLevel,
    },
    lesson: {
      slug: snapshot.lesson.slug,
      title: snapshot.lesson.title,
      objective: snapshot.lesson.objective,
      currentBlock: block,
      concepts: snapshot.concepts,
      prerequisites: snapshot.prerequisites,
    },
    learning: {
      misconceptions: snapshot.misconceptions,
      recentEvidence: snapshot.recentEvidence,
      homeworkPrompts: snapshot.homeworkPrompts,
      memory: snapshot.memory,
    },
    session: {
      mode: snapshot.mode,
      state: snapshot.state,
      turnNumber: snapshot.turnCount,
      recentMessages: snapshot.recentMessages,
      summary: snapshot.summary,
    },
    studentMessage: snapshot.studentMessage,
    reviewConceptSlug: snapshot.reviewConceptSlug,
  });
  return { prompt: renderTeachPrompt(context), context };
}

function categoryOf(error: unknown): string {
  if (error instanceof AIProviderError) {
    return error.failureCategory ?? error.code;
  }
  if (error instanceof AiConfigurationError) {
    return "configuration";
  }
  if (error instanceof TeachingModeUnavailableError) {
    return "mode_unavailable";
  }
  if (error instanceof TeachingRuleError) {
    return error.code;
  }
  if (error instanceof HttpException) {
    const body = error.getResponse();
    if (typeof body === "object" && body !== null && "code" in body) {
      const code = (body as { code?: unknown }).code;
      if (typeof code === "string" && code.length > 0 && code.length <= 80) {
        return code;
      }
    }
    return "http_error";
  }
  return "unknown";
}

function allowedConceptSlugs(snapshot: PreparedTeachingTurn): Set<string> {
  if (!snapshot.reviewSession) {
    return new Set([
      ...snapshot.concepts.map((concept) => concept.slug),
      ...snapshot.prerequisites.map((edge) => edge.prerequisiteSlug),
    ]);
  }
  return snapshot.reviewConceptSlug === null ? new Set() : new Set([snapshot.reviewConceptSlug]);
}

function isProviderFailure(error: unknown): boolean {
  return (
    error instanceof AIProviderError ||
    error instanceof AiConfigurationError ||
    error instanceof TeachingModeUnavailableError
  );
}

function aiFailure(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof AIProviderError && error.code === "input_too_large") {
    return { status: 400, code: "VALIDATION", message: "The teaching request is too large." };
  }
  if (error instanceof TeachingRuleError) {
    return { status: error.status, code: error.code, message: error.message };
  }
  if (isProviderFailure(error)) {
    return { status: 503, code: "AI_UNAVAILABLE", message: UNAVAILABLE };
  }
  return { status: 503, code: "AI_UNAVAILABLE", message: UNAVAILABLE };
}

function teachRouteIsStrong(router: ModelRouter): boolean {
  try {
    return router.resolve("teach").strength === "strong";
  } catch {
    return false;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
