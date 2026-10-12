import { AI_TASKS, type AiTask } from "@platform/types";
import type { AIProvider, AIResponse } from "../provider/ai-provider";

export type ModelStrength = "fast" | "strong";

export interface TeachRouteConfig {
  provider: string;
  model: string;
  maxInputChars: number;
  maxOutputTokens: number;
  strength?: ModelStrength;
}

export interface ModelRoute {
  task: "teach" | "code_review" | "project_review" | "interview";
  provider: string;
  model: string;
  strength: ModelStrength;
  maxOutputTokens: number;
  maxInputChars: number;
  temperature: number;
  timeoutMs: number;
  inputMicrosPerMillion: number;
  outputMicrosPerMillion: number;
}

const TEACH_TEMPERATURE = 0.2;
const TEACH_TIMEOUT_MS = 20_000;
const TEACH_INPUT_MICROS_PER_MILLION = 150_000;
const TEACH_OUTPUT_MICROS_PER_MILLION = 600_000;

export class AiConfigurationError extends Error {
  constructor(task: "teach" | "code_review" | "project_review" | "interview" = "teach") {
    super(
      task === "teach"
        ? "The teach model is not configured."
        : task === "project_review"
          ? "The project review model is not configured."
          : task === "interview"
            ? "The interview model is not configured."
            : "The code review model is not configured.",
    );
    this.name = "AiConfigurationError";
  }
}

export class UnknownAiTaskError extends Error {
  constructor() {
    super("Unknown AI task.");
    this.name = "UnknownAiTaskError";
  }
}

export class AiTaskUnavailableError extends Error {
  constructor() {
    super("This AI task is not available.");
    this.name = "AiTaskUnavailableError";
  }
}

const REVIEW_TEMPERATURE = 0.2;

export class ModelRouter {
  constructor(
    private readonly teach: TeachRouteConfig | null,
    private readonly codeReview: TeachRouteConfig | null = null,
    private readonly projectReview: TeachRouteConfig | null = null,
    private readonly interview: TeachRouteConfig | null = null,
  ) {}

  resolve(task: AiTask): ModelRoute {
    if (!isAiTask(task)) {
      throw new UnknownAiTaskError();
    }
    if (
      task !== "teach" &&
      task !== "code_review" &&
      task !== "project_review" &&
      task !== "interview"
    ) {
      throw new AiTaskUnavailableError();
    }
    const selected =
      task === "teach"
        ? this.teach
        : task === "code_review"
          ? this.codeReview
          : task === "project_review"
            ? this.projectReview
            : this.interview;
    if (selected === null || selected.model.length === 0 || selected.provider.length === 0) {
      throw new AiConfigurationError(task);
    }
    return {
      task,
      provider: selected.provider,
      model: selected.model,
      strength: selected.strength ?? "fast",
      maxOutputTokens: selected.maxOutputTokens,
      maxInputChars: selected.maxInputChars,
      temperature: task === "teach" ? TEACH_TEMPERATURE : REVIEW_TEMPERATURE,
      timeoutMs: TEACH_TIMEOUT_MS,
      inputMicrosPerMillion: TEACH_INPUT_MICROS_PER_MILLION,
      outputMicrosPerMillion: TEACH_OUTPUT_MICROS_PER_MILLION,
    };
  }
}

export function createModelRouter(
  config: TeachRouteConfig | null,
  codeReview: TeachRouteConfig | null = null,
  projectReview: TeachRouteConfig | null = null,
  interview: TeachRouteConfig | null = null,
): ModelRouter {
  return new ModelRouter(config, codeReview, projectReview, interview);
}

export function isAiTask(value: string): value is AiTask {
  return (AI_TASKS as readonly string[]).includes(value);
}

export async function completeTeach(input: {
  router: ModelRouter;
  provider: AIProvider;
  system: string;
  user: string;
}): Promise<AIResponse> {
  const route = input.router.resolve("teach");
  return input.provider.complete({
    model: {
      provider: route.provider,
      model: route.model,
      maxOutputTokens: route.maxOutputTokens,
      temperature: route.temperature,
      timeoutMs: route.timeoutMs,
      maxInputChars: route.maxInputChars,
    },
    system: input.system,
    user: input.user,
    schemaName: "TeacherResult",
  });
}

export async function completeProjectPlan(input: {
  router: ModelRouter;
  provider: AIProvider;
  system: string;
  user: string;
}): Promise<AIResponse> {
  const route = input.router.resolve("project_review");
  return input.provider.complete({
    model: {
      provider: route.provider,
      model: route.model,
      maxOutputTokens: route.maxOutputTokens,
      temperature: route.temperature,
      timeoutMs: route.timeoutMs,
      maxInputChars: route.maxInputChars,
    },
    system: input.system,
    user: input.user,
    schemaName: "ProjectPlanReview",
  });
}

export async function completeProjectReview(input: {
  router: ModelRouter;
  provider: AIProvider;
  system: string;
  user: string;
}): Promise<AIResponse> {
  const route = input.router.resolve("project_review");
  return input.provider.complete({
    model: {
      provider: route.provider,
      model: route.model,
      maxOutputTokens: route.maxOutputTokens,
      temperature: route.temperature,
      timeoutMs: route.timeoutMs,
      maxInputChars: route.maxInputChars,
    },
    system: input.system,
    user: input.user,
    schemaName: "ProjectReviewResult",
  });
}

export async function completeCodeReview(input: {
  router: ModelRouter;
  provider: AIProvider;
  system: string;
  user: string;
}): Promise<AIResponse> {
  const route = input.router.resolve("code_review");
  return input.provider.complete({
    model: {
      provider: route.provider,
      model: route.model,
      maxOutputTokens: route.maxOutputTokens,
      temperature: route.temperature,
      timeoutMs: route.timeoutMs,
      maxInputChars: route.maxInputChars,
    },
    system: input.system,
    user: input.user,
    schemaName: "CodeReviewResult",
  });
}

export async function completeInterview(input: {
  router: ModelRouter;
  provider: AIProvider;
  system: string;
  user: string;
}): Promise<AIResponse> {
  const route = input.router.resolve("interview");
  return input.provider.complete({
    model: {
      provider: route.provider,
      model: route.model,
      maxOutputTokens: route.maxOutputTokens,
      temperature: route.temperature,
      timeoutMs: route.timeoutMs,
      maxInputChars: route.maxInputChars,
    },
    system: input.system,
    user: input.user,
    schemaName: "InterviewResult",
  });
}
