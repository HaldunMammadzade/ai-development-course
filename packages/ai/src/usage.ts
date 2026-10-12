import type { AiTask } from "@platform/types";

export interface RecordedAiUsage {
  userId: string | null;
  task: AiTask;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostMicros: bigint;
  cached: boolean;
  latencyMs: number;
  correlationId: string;
  sessionId: string | null;
  createdAt: Date;
}

export function estimateCostMicros(input: {
  inputTokens: number;
  outputTokens: number;
  inputMicrosPerMillion: number;
  outputMicrosPerMillion: number;
}): bigint {
  if (
    !Number.isInteger(input.inputTokens) ||
    !Number.isInteger(input.outputTokens) ||
    input.inputTokens < 0 ||
    input.outputTokens < 0
  ) {
    throw new Error("Token counts must be non-negative integers.");
  }
  const inputCost = BigInt(input.inputTokens) * BigInt(input.inputMicrosPerMillion);
  const outputCost = BigInt(input.outputTokens) * BigInt(input.outputMicrosPerMillion);
  return (inputCost + outputCost) / 1_000_000n;
}

export function recordAiUsage(input: {
  userId: string | null;
  task: AiTask;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  inputMicrosPerMillion: number;
  outputMicrosPerMillion: number;
  cached: boolean;
  latencyMs: number;
  correlationId: string;
  sessionId: string | null;
  createdAt?: Date;
}): RecordedAiUsage {
  return {
    userId: input.userId,
    task: input.task,
    provider: input.provider,
    model: input.model,
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    totalTokens: input.inputTokens + input.outputTokens,
    estimatedCostMicros: estimateCostMicros(input),
    cached: input.cached,
    latencyMs: input.latencyMs,
    correlationId: input.correlationId,
    sessionId: input.sessionId,
    createdAt: input.createdAt ?? new Date(),
  };
}
