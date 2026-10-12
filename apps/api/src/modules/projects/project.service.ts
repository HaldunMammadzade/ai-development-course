import { randomUUID } from "node:crypto";
import { HttpException, Inject, Injectable, Logger } from "@nestjs/common";
import {
  AiConfigurationError,
  AIProviderError,
  completeProjectPlan,
  completeProjectReview,
  normalizeProjectPlanReview,
  normalizeProjectReviewTurn,
  parseCodeReviewResult,
  type CodeReviewSafetyDrop,
  recordAiUsage,
  renderProjectPlanPrompt,
  renderProjectReviewPrompt,
  type AIProvider,
  type ModelRouter,
} from "@platform/ai";
import {
  evaluateProjectMilestone,
  javascriptRequest,
  projectBrief,
  projectHiddenLiterals,
} from "@platform/curriculum";
import {
  ProjectRuleError,
  type OpenedProject,
  type ProjectRepository,
  type ProjectReviewTarget,
} from "@platform/database";
import {
  EXECUTION_LIMITS,
  EXECUTION_MESSAGES,
  type CodeExecutionRunner,
} from "@platform/execution";
import {
  PROJECT_FILE_NAMES,
  type CodeReviewResponse,
  type CodeReviewResult,
  type ProjectAttemptListResponse,
  type ProjectAttemptView,
  type ProjectDetailResponse,
  type ProjectFiles,
  type ProjectListResponse,
  type ProjectPlanResponse,
} from "@platform/types";
import type {
  CodeReviewRequest,
  ProjectAttemptRequest,
  ProjectCheck,
  ProjectPlanRequest,
} from "@platform/validation";
import { PROJECT_FILE_MAX_CHARS, PROJECT_SUBMISSION_MAX_CHARS } from "@platform/validation";
import { aiFailureLogSuffix } from "../ai/ai-failure-log";
import { AI_PROVIDER, MODEL_ROUTER } from "../ai/ai.module";
import { CODE_EXECUTION_RUNNER } from "../execution/execution.tokens";
import { PROJECT_REPOSITORY } from "./project.tokens";

const PROJECT_REVIEW_LIMIT = 10;
const PROJECT_REVIEW_WINDOW_MS = 10 * 60 * 1000;
const PROJECT_REVIEW_WAIT_MS = 20_000;

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projects: ProjectRepository,
    @Inject(CODE_EXECUTION_RUNNER) private readonly runner: CodeExecutionRunner,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
    @Inject(MODEL_ROUTER) private readonly router: ModelRouter,
  ) {}

  async list(userId: string): Promise<ProjectListResponse> {
    return { projects: await this.projects.list(userId) };
  }

  async get(userId: string, projectSlug: string): Promise<ProjectDetailResponse> {
    const opened = await this.projects.open(userId, projectSlug);
    if (opened === null) {
      throw notFound();
    }
    return { project: opened.detail };
  }

  async savePlan(
    userId: string,
    projectSlug: string,
    input: ProjectPlanRequest,
  ): Promise<ProjectPlanResponse> {
    const opened = await this.requireOpen(userId, projectSlug);
    return {
      plan: await this.projects.savePlan({
        userId,
        projectId: opened.id,
        body: input.body,
      }),
    };
  }

  async reviewPlan(userId: string, projectSlug: string): Promise<ProjectPlanResponse> {
    const opened = await this.requireOpen(userId, projectSlug);
    if (opened.detail.plan === null) {
      throw new HttpException(
        { code: "PLAN_REQUIRED", message: "Write a plan before asking for a review." },
        400,
      );
    }
    const recent = await this.projects.countRecentUsage(
      userId,
      "project_plan",
      new Date(Date.now() - PROJECT_REVIEW_WINDOW_MS),
    );
    if (recent >= PROJECT_REVIEW_LIMIT) {
      throw new HttpException(
        { code: "RATE_LIMITED", message: "Too many reviews. Try again later." },
        429,
      );
    }
    const brief = projectBrief(opened.detail.slug) ?? opened.detail.brief;
    const prompt = renderProjectPlanPrompt({
      projectTitle: opened.detail.title,
      objective: opened.detail.objective,
      brief,
      plan: opened.detail.plan.body,
    });
    if (prompt.system.length + prompt.user.length > 12_000) {
      throw tooLarge();
    }
    const correlationId = randomUUID();
    const started = Date.now();
    try {
      const route = this.router.resolve("project_review");
      const response = await completeProjectPlan({
        router: this.router,
        provider: this.ai,
        system: prompt.system,
        user: prompt.user,
      });
      const review = normalizeProjectPlanReview(
        response.json,
        opened.milestones.flatMap((item) => projectHiddenLiterals(item.checks)),
      );
      const usage = recordAiUsage({
        userId,
        task: "project_review",
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
      await this.projects.recordReviewUsage({
        userId,
        provider: usage.provider,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costMicros: usage.estimatedCostMicros,
        latencyMs: usage.latencyMs,
        correlationId,
        taskType: "project_plan",
      });
      const plan = await this.projects.savePlanReview({
        userId,
        projectId: opened.id,
        review,
      });
      this.logger.log(
        `project plan correlation=${correlationId} provider=${usage.provider} model=${usage.model} latencyMs=${usage.latencyMs} status=completed durationMs=${Date.now() - started}`,
      );
      return { plan };
    } catch (error) {
      if (error instanceof AIProviderError && error.code === "input_too_large") {
        throw tooLarge();
      }
      if (isReviewFailure(error)) {
        const code = error instanceof AIProviderError ? error.code : "configuration";
        this.logger.warn(
          `project plan correlation=${correlationId} status=unavailable code=${code} ${aiFailureLogSuffix(error)} durationMs=${Date.now() - started}`,
        );
        throw aiUnavailable();
      }
      throw error;
    }
  }

  async submit(
    userId: string,
    projectSlug: string,
    milestoneSlug: string,
    input: ProjectAttemptRequest,
  ): Promise<ProjectAttemptView> {
    const opened = await this.requireOpen(userId, projectSlug);
    const milestone = writableMilestone(opened, milestoneSlug);
    const script = javascriptRequest(milestone.checks);
    if (script === null || input.files["script.js"].trim().length === 0) {
      return this.persist(
        userId,
        opened,
        milestone,
        input.files,
        input.clientAttemptId,
        evaluateProjectMilestone({
          checks: milestone.checks,
          files: input.files,
          observation: script === null ? null : { status: "completed", tests: [] },
        }),
      );
    }
    const prepared = await this.projects.prepareExecution({
      userId,
      projectId: opened.id,
      milestoneId: milestone.id,
      milestoneSlug: milestone.slug,
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
      const stored = await this.waitForAttempt(
        userId,
        opened.id,
        milestone.id,
        input.clientAttemptId,
      );
      if (stored !== null) {
        return stored;
      }
      throw busy();
    }
    const correlationId = randomUUID();
    try {
      const observation = await this.runner.execute({
        language: "javascript",
        entry: script.entry,
        source: input.files["script.js"],
        tests: script.tests.map((test) => ({
          id: test.id,
          args: test.args,
          expected: test.expected,
        })),
        timeoutMs: EXECUTION_LIMITS.timeoutMs,
        correlationId,
      });
      this.logger.log(
        `project execution correlation=${correlationId} status=${observation.status} durationMs=${observation.durationMs}`,
      );
      if (observation.status === "runner_error") {
        throw unavailable();
      }
      return await this.persist(
        userId,
        opened,
        milestone,
        input.files,
        input.clientAttemptId,
        evaluateProjectMilestone({
          checks: milestone.checks,
          files: input.files,
          observation,
        }),
      );
    } finally {
      await this.projects.releaseExecution({
        userId,
        projectId: opened.id,
        milestoneId: milestone.id,
        clientAttemptId: input.clientAttemptId,
      });
    }
  }

  async history(
    userId: string,
    projectSlug: string,
    milestoneSlug: string,
  ): Promise<ProjectAttemptListResponse> {
    const opened = await this.requireOpen(userId, projectSlug);
    const milestone = writableMilestone(opened, milestoneSlug);
    return {
      attempts: await this.projects.listAttempts(userId, milestone.id, milestone.slug),
    };
  }

  async review(
    userId: string,
    projectSlug: string,
    milestoneSlug: string,
    input: CodeReviewRequest,
  ): Promise<CodeReviewResponse> {
    const opened = await this.requireOpen(userId, projectSlug);
    const milestone = writableMilestone(opened, milestoneSlug);
    const correlationId = randomUUID();
    const started = Date.now();
    const prepared = await this.projects.prepareReview({
      userId,
      projectId: opened.id,
      milestoneId: milestone.id,
      attemptId: input.attemptId,
      clientReviewId: input.clientReviewId,
      mode: input.mode,
      now: new Date(),
      limit: PROJECT_REVIEW_LIMIT,
      windowMs: PROJECT_REVIEW_WINDOW_MS,
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

    const reviewFiles = prepared.target.files;
    const reviewBytes = PROJECT_FILE_NAMES.reduce(
      (total, name) => total + reviewFiles[name].length,
      0,
    );
    if (
      PROJECT_FILE_NAMES.some((name) => reviewFiles[name].length > PROJECT_FILE_MAX_CHARS) ||
      reviewBytes > PROJECT_SUBMISSION_MAX_CHARS
    ) {
      await this.projects.releaseReview(prepared.reviewId).catch(() => undefined);
      throw tooLarge();
    }
    const signal = await this.projects.learningSignal(userId, milestone.conceptId);
    this.logger.log(
      `project review adaptive=${signal?.decision ?? "none"} strategy=${signal?.strategy ?? "none"} reason=${signal?.reason ?? "none"}`,
    );

    try {
      const prompt = renderProjectReviewPrompt({
        mode: input.mode,
        hintLevel: prepared.hintLevel,
        projectTitle: opened.detail.title,
        milestone: {
          title: prepared.target.title,
          objective: prepared.target.objective,
          instructions: prepared.target.instructions,
        },
        concepts: prepared.target.concepts,
        result: {
          status: resultStatus(prepared.target),
          score: prepared.target.score,
          passed: prepared.target.passed,
          feedback: prepared.target.feedback,
          passedNotes: prepared.target.passedChecks,
          missingNotes: prepared.target.failedChecks,
        },
        preferences: {
          locale: prepared.target.locale,
          explanationStyle: prepared.target.explanationStyle,
        },
        files: prepared.target.files,
        brief: projectBrief(opened.detail.slug) ?? opened.detail.brief,
        adaptive:
          signal === null
            ? undefined
            : {
                conceptSlug: signal.conceptSlug,
                decision: signal.decision,
                strategy: signal.strategy,
                reason: signal.reason,
              },
      });
      const route = this.router.resolve("project_review");
      const response = await completeProjectReview({
        router: this.router,
        provider: this.ai,
        system: prompt.system,
        user: prompt.user,
      });
      const normalized = normalizeProjectReviewTurn(response.json, {
        allowedConceptSlugs: new Set(prepared.target.allowedConceptSlugs),
        passed: prepared.target.passed,
        forbiddenLiterals: projectHiddenLiterals(milestone.checks),
      });
      const review = normalized.result;
      const usage = recordAiUsage({
        userId,
        task: "project_review",
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
      await this.projects.recordReviewUsage({
        userId,
        provider: usage.provider,
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costMicros: usage.estimatedCostMicros,
        latencyMs: usage.latencyMs,
        correlationId,
      });
      await this.projects.completeReview(prepared.reviewId, review, new Date());
      this.logger.log(
        `project review correlation=${correlationId} mode=${input.mode} status=completed durationMs=${Date.now() - started}${safetyDropSuffix(normalized.safetyDrops)}`,
      );
      return { review };
    } catch (error) {
      await this.projects.releaseReview(prepared.reviewId).catch(() => undefined);
      if (error instanceof AIProviderError && error.code === "input_too_large") {
        throw tooLarge();
      }
      if (isReviewFailure(error)) {
        const code = error instanceof AIProviderError ? error.code : "configuration";
        this.logger.warn(
          `project review correlation=${correlationId} mode=${input.mode} status=unavailable code=${code} ${aiFailureLogSuffix(error)} durationMs=${Date.now() - started}`,
        );
        throw aiUnavailable();
      }
      throw error;
    }
  }

  private async requireOpen(userId: string, projectSlug: string): Promise<OpenedProject> {
    const opened = await this.projects.open(userId, projectSlug);
    if (opened === null) {
      throw notFound();
    }
    return opened;
  }

  private async persist(
    userId: string,
    opened: { id: string; timeZone: string },
    milestone: { id: string; slug: string; conceptId: string },
    files: ProjectFiles,
    clientAttemptId: string,
    evaluation: ReturnType<typeof evaluateProjectMilestone>,
  ): Promise<ProjectAttemptView> {
    try {
      return await this.projects.submit({
        userId,
        projectId: opened.id,
        milestoneId: milestone.id,
        conceptId: milestone.conceptId,
        milestoneSlug: milestone.slug,
        clientAttemptId,
        files,
        score: evaluation.score,
        passed: evaluation.passed,
        feedback: evaluation.feedback,
        passedChecks: evaluation.passedChecks,
        failedChecks: evaluation.failedChecks,
        now: new Date(),
        timeZone: opened.timeZone,
      });
    } catch (error) {
      if (error instanceof ProjectRuleError) {
        throw new HttpException({ code: error.code, message: error.message }, error.status);
      }
      throw error;
    }
  }

  private async waitForAttempt(
    userId: string,
    projectId: string,
    milestoneId: string,
    clientAttemptId: string,
  ): Promise<ProjectAttemptView | null> {
    const deadline = Date.now() + EXECUTION_LIMITS.timeoutMs + 6_000;
    while (Date.now() < deadline) {
      const stored = await this.projects.findClientAttempt(userId, milestoneId, clientAttemptId);
      if (stored !== null) {
        return stored;
      }
      const pending = await this.projects.executionPending({
        userId,
        projectId,
        milestoneId,
        clientAttemptId,
      });
      if (!pending) {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    return null;
  }

  private async waitForReview(
    userId: string,
    input: CodeReviewRequest,
  ): Promise<CodeReviewResult | null> {
    const deadline = Date.now() + PROJECT_REVIEW_WAIT_MS;
    while (Date.now() < deadline) {
      const row = await this.projects.findReview({
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
}

function writableMilestone(
  opened: OpenedProject,
  milestoneSlug: string,
): {
  id: string;
  slug: string;
  conceptId: string;
  checks: ProjectCheck[];
} {
  const milestone = opened.milestones.find((item) => item.slug === milestoneSlug);
  if (milestone === undefined || milestone.status === "locked") {
    throw notFound();
  }
  return milestone;
}

function resultStatus(target: ProjectReviewTarget): string {
  if (target.feedback === EXECUTION_MESSAGES.timeout) {
    return "timeout";
  }
  if (target.feedback === EXECUTION_MESSAGES.syntax_error) {
    return "syntax_error";
  }
  if (target.feedback === EXECUTION_MESSAGES.memory_limit) {
    return "memory_limit";
  }
  if (target.feedback === EXECUTION_MESSAGES.process_limit) {
    return "process_limit";
  }
  if (target.feedback === EXECUTION_MESSAGES.runtime_error) {
    return "runtime_error";
  }
  return "completed";
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

function safetyDropSuffix(drops: readonly CodeReviewSafetyDrop[]): string {
  if (drops.length === 0) {
    return "";
  }
  return ` safety_drops=${drops.map((drop) => `${drop.path}:${drop.category}:${drop.count}`).join(",")}`;
}

function tooLarge(): HttpException {
  return new HttpException(
    { code: "PROJECT_TOO_LARGE", message: "The project is too large to review." },
    400,
  );
}

function notFound(): HttpException {
  return new HttpException({ code: "NOT_FOUND", message: "That project was not found." }, 404);
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
