import { randomUUID } from "node:crypto";
import { HttpException, Inject, Injectable, Logger } from "@nestjs/common";
import {
  AiConfigurationError,
  AiTaskUnavailableError,
  AIProviderError,
  completeInterview,
  normalizeInterviewOutput,
  recordAiUsage,
  renderInterviewPrompt,
  type AIProvider,
  type ModelRouter,
  type NormalizedInterview,
} from "@platform/ai";
import { codeEvidence, verbalEvidence } from "@platform/curriculum";
import {
  InterviewRuleError,
  type InterviewRepository,
  type InterviewTurnContext,
} from "@platform/database";
import {
  EXECUTION_LIMITS,
  scoreExecution,
  type CodeExecutionRunner,
  type ExecutionResult,
} from "@platform/execution";
import type {
  InterviewDetailResponse,
  InterviewListResponse,
  InterviewReportResponse,
  InterviewSessionResponse,
  InterviewSessionView,
} from "@platform/types";
import type { InterviewAnswerRequest } from "@platform/validation";
import { aiFailureLogSuffix } from "../ai/ai-failure-log";
import { AI_PROVIDER, MODEL_ROUTER } from "../ai/ai.module";
import { CODE_EXECUTION_RUNNER } from "../execution/execution.tokens";
import { INTERVIEW_REPOSITORY } from "./interview.tokens";

@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    @Inject(INTERVIEW_REPOSITORY) private readonly interviews: InterviewRepository,
    @Inject(MODEL_ROUTER) private readonly router: ModelRouter,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
    @Inject(CODE_EXECUTION_RUNNER) private readonly runner: CodeExecutionRunner,
  ) {}

  async list(userId: string): Promise<InterviewListResponse> {
    return { interviews: await this.interviews.list(userId) };
  }

  async get(userId: string, slug: string): Promise<InterviewDetailResponse> {
    const interview = await this.interviews.open(userId, slug);
    if (interview === null) {
      throw notFound();
    }
    return { interview };
  }

  async start(userId: string, slug: string): Promise<InterviewSessionResponse> {
    try {
      return { session: await this.interviews.start(userId, slug, new Date()) };
    } catch (error) {
      throw this.rule(error);
    }
  }

  async session(userId: string, sessionId: string): Promise<InterviewSessionResponse> {
    const session = await this.interviews.getSession(userId, sessionId);
    if (session === null) {
      throw notFound();
    }
    return { session };
  }

  async report(userId: string, sessionId: string): Promise<InterviewReportResponse> {
    const report = await this.interviews.report(userId, sessionId);
    if (report === null) {
      throw notFound();
    }
    return { report };
  }

  async abandon(userId: string, sessionId: string): Promise<InterviewSessionResponse> {
    try {
      return { session: await this.interviews.abandon(userId, sessionId) };
    } catch (error) {
      throw this.rule(error);
    }
  }

  async answer(
    userId: string,
    sessionId: string,
    input: InterviewAnswerRequest,
  ): Promise<InterviewSessionResponse> {
    const correlationId = randomUUID();
    const started = Date.now();
    let prepared: Awaited<ReturnType<InterviewRepository["beginAnswer"]>>;
    try {
      prepared = await this.interviews.beginAnswer({
        userId,
        sessionId,
        clientAnswerId: input.clientAnswerId,
        text: input.text,
        code: input.code ?? null,
        now: new Date(),
      });
    } catch (error) {
      throw this.rule(error);
    }
    if (prepared.kind === "stored") {
      return { session: prepared.session };
    }
    if (prepared.kind === "wait") {
      const session = await this.waitForAnswer(userId, sessionId, input.clientAnswerId);
      if (session === null) {
        throw aiUnavailable();
      }
      return { session };
    }

    const turn = prepared.turn;
    const release = {
      userId,
      sessionId,
      questionId: turn.questionId,
      answerId: turn.answerId,
      clientAnswerId: input.clientAnswerId,
    };
    try {
      const execution = await this.execute(userId, turn, input.clientAnswerId, correlationId);
      const evaluated = await this.evaluate(turn, execution, correlationId);
      const evidence =
        turn.questionType === "code"
          ? codeEvidence(execution?.score ?? 0, evaluated.normalized.understanding)
          : verbalEvidence(evaluated.normalized.understanding);
      const session = await this.interviews.finishAnswer({
        userId,
        sessionId,
        answerId: turn.answerId,
        understanding: evaluated.normalized.understanding,
        reasoning: evaluated.normalized.evaluation.reasoningQuality,
        evidence,
        executionScore: execution?.score ?? null,
        speech: evaluated.normalized.speech,
        feedback: evaluated.normalized.feedback,
        strengths: evaluated.normalized.evaluation.strengths,
        issues: evaluated.normalized.evaluation.issues,
        followUpRecommended: evaluated.normalized.followUpRecommended,
        now: new Date(),
        timeZone: turn.timeZone,
        usage: {
          provider: evaluated.usage.provider,
          model: evaluated.usage.model,
          inputTokens: evaluated.usage.inputTokens,
          outputTokens: evaluated.usage.outputTokens,
          costMicros: evaluated.usage.estimatedCostMicros,
          latencyMs: evaluated.usage.latencyMs,
          correlationId,
        },
      });
      this.logger.log(
        `interview correlation=${correlationId} status=${evaluated.scripted ? "scripted" : "completed"} durationMs=${Date.now() - started}`,
      );
      return { session };
    } catch (error) {
      await this.interviews.releaseAnswer(release).catch(() => undefined);
      if (error instanceof HttpException) {
        throw error;
      }
      if (isAiFailure(error)) {
        this.logger.warn(
          `interview correlation=${correlationId} status=unavailable ${aiFailureLogSuffix(error)} durationMs=${Date.now() - started}`,
        );
        throw aiUnavailable();
      }
      throw this.rule(error);
    }
  }

  private async execute(
    userId: string,
    turn: InterviewTurnContext,
    clientAnswerId: string,
    correlationId: string,
  ): Promise<{ score: number; status: string; passed: boolean; note: string } | null> {
    if (turn.questionType !== "code") {
      return null;
    }
    if (turn.execution === null || turn.studentCode === null) {
      throw notFound();
    }
    const slot = await this.interviews.prepareExecution({
      userId,
      sessionId: turn.sessionId,
      questionId: turn.questionId,
      clientAnswerId,
      now: new Date(),
    });
    if (slot === "busy") {
      throw executionBusy();
    }
    let result: ExecutionResult;
    try {
      result = await this.runner.execute({
        language: "javascript",
        entry: turn.execution.entry,
        source: turn.studentCode,
        tests: turn.execution.tests.map((test) => ({
          id: test.id,
          args: test.args,
          expected: test.expected,
        })),
        timeoutMs: EXECUTION_LIMITS.timeoutMs,
        correlationId,
      });
    } finally {
      await this.interviews.releaseExecution({
        userId,
        sessionId: turn.sessionId,
        questionId: turn.questionId,
        clientAnswerId,
      });
    }
    if (result.status === "runner_error") {
      throw executionUnavailable();
    }
    const scored = scoreExecution(turn.execution, result);
    return {
      score: scored.score,
      status: result.status,
      passed: scored.passed,
      note: scored.feedback,
    };
  }

  private async evaluate(
    turn: InterviewTurnContext,
    execution: { status: string; passed: boolean; note: string } | null,
    correlationId: string,
  ): Promise<{
    normalized: NormalizedInterview;
    usage: ReturnType<typeof recordAiUsage>;
    scripted: boolean;
  }> {
    const prompt = renderInterviewPrompt({
      interviewTitle: turn.interviewTitle,
      question: {
        title: turn.questionTitle,
        prompt: turn.questionPrompt,
        type: turn.questionType,
        difficulty: turn.difficulty,
        conceptName: turn.conceptName,
      },
      answer: { text: turn.studentText, code: turn.studentCode },
      execution,
      priorAnswers: turn.priorAnswers,
      masteryBand: turn.masteryBand,
      misconception: turn.misconception,
      locale: turn.locale,
    });
    const scope = {
      forbiddenLiterals: turn.hiddenLiterals,
      studentCode: turn.studentCode ?? "",
    };
    try {
      const route = this.router.resolve("interview");
      const response = await completeInterview({
        router: this.router,
        provider: this.ai,
        system: prompt.system,
        user: prompt.user,
      });
      return {
        normalized: normalizeInterviewOutput(response.json, scope),
        scripted: false,
        usage: recordAiUsage({
          userId: null,
          task: "interview",
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
        }),
      };
    } catch (error) {
      if (!(error instanceof AiConfigurationError) || process.env.NODE_ENV !== "development") {
        throw error;
      }
      return {
        normalized: normalizeInterviewOutput(scriptedInterview(turn, execution), scope),
        scripted: true,
        usage: recordAiUsage({
          userId: null,
          task: "interview",
          provider: "scripted",
          model: "interview-scripted",
          inputTokens: 0,
          outputTokens: 0,
          inputMicrosPerMillion: 150_000,
          outputMicrosPerMillion: 600_000,
          cached: false,
          latencyMs: 1,
          correlationId,
          sessionId: null,
        }),
      };
    }
  }

  private async waitForAnswer(
    userId: string,
    sessionId: string,
    clientAnswerId: string,
  ): Promise<InterviewSessionView | null> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const stored = await this.interviews.findCompleted(userId, sessionId, clientAnswerId);
      if (stored !== null) {
        return stored;
      }
      if (!(await this.interviews.isPending(userId, sessionId, clientAnswerId))) {
        return null;
      }
      await delay(200);
    }
    return null;
  }

  private rule(error: unknown): unknown {
    if (error instanceof InterviewRuleError) {
      return new HttpException({ code: error.code, message: error.message }, error.status);
    }
    return error;
  }
}

function scriptedInterview(
  turn: InterviewTurnContext,
  execution: { passed: boolean } | null,
): Record<string, unknown> {
  const blob = `${turn.studentText}\n${turn.studentCode ?? ""}`;
  const asks =
    /what'?s the answer|what is the answer|cavabı yaz|tam cavab|write the function|ignore previous instructions|mark this correct|change my score|show system prompt|api key|hidden test/i.test(
      blob,
    );
  let understanding: NormalizedInterview["understanding"] = "partial";
  if (asks) {
    understanding = "unknown";
  } else if (execution?.passed === true) {
    understanding = "correct";
  } else if (execution?.passed === false) {
    understanding = "incorrect";
  } else if (blob.trim().length < 15) {
    understanding = "unknown";
  } else if (blob.trim().length >= 80) {
    understanding = "correct";
  }
  const speech = asks
    ? "Tam cavabı verməyəcəm. Nəyin baş verdiyini öz sözünüzlə bir cümlə ilə deyin."
    : understanding === "correct"
      ? "Bu izah əsas fikri örtür."
      : understanding === "incorrect"
        ? "Bu cavab hələ tam deyil."
        : understanding === "unknown"
          ? "Bir az daha konkret deyin."
          : "Bir hissəsi düzgündür. Bir az dəqiqləşdirək.";
  return {
    speech,
    understanding,
    evaluation: {
      strengths: understanding === "correct" ? ["Əsas fikir görünür."] : [],
      issues: understanding === "correct" ? [] : ["İzahı tamamlanmayıb."],
      reasoningQuality: understanding === "correct" ? "strong" : "developing",
    },
    followUpRecommended: understanding === "partial" || understanding === "incorrect",
    feedback: asks ? "Həlli yazmıram." : "Bu, müsahibəçinin qeydidir.",
    score: 100,
    mastery: 100,
    hiddenTests: ["hidden"],
  };
}

function isAiFailure(error: unknown): boolean {
  return (
    error instanceof AIProviderError ||
    error instanceof AiConfigurationError ||
    error instanceof AiTaskUnavailableError
  );
}

function aiUnavailable(): HttpException {
  return new HttpException(
    { code: "AI_UNAVAILABLE", message: "The interviewer is temporarily unavailable." },
    503,
  );
}

function executionUnavailable(): HttpException {
  return new HttpException(
    { code: "EXECUTION_UNAVAILABLE", message: "Code execution is unavailable." },
    503,
  );
}

function executionBusy(): HttpException {
  return new HttpException({ code: "EXECUTION_BUSY", message: "Execution is busy." }, 503);
}

function notFound(): HttpException {
  return new HttpException({ code: "NOT_FOUND", message: "That interview was not found." }, 404);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
