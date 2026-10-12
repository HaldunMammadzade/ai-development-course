import type { ExecutionValue } from "@platform/types";
import { z } from "zod";
import { EXECUTION_LIMITS } from "./limits";

export type ExecutionStatus =
  | "completed"
  | "timeout"
  | "memory_limit"
  | "process_limit"
  | "runtime_error"
  | "syntax_error"
  | "runner_error";

export interface ExecutionTestRequest {
  id: string;
  args: ExecutionValue[];
  expected: ExecutionValue;
}

export interface ExecutionRequest {
  language: "javascript";
  entry: string;
  source: string;
  tests: ExecutionTestRequest[];
  timeoutMs: number;
  correlationId: string;
}

export interface ExecutionObservation {
  id: string;
  passed: boolean;
}

export interface ExecutionResult {
  status: ExecutionStatus;
  tests: ExecutionObservation[];
  durationMs: number;
}

export interface CodeExecutionRunner {
  execute(request: ExecutionRequest): Promise<ExecutionResult>;
}

const primitiveSchema = z.union([z.string().max(80), z.number().finite(), z.boolean(), z.null()]);
const valueSchema = z.union([primitiveSchema, z.array(primitiveSchema).max(8)]);

export const executionRequestSchema = z.object({
  language: z.literal("javascript"),
  entry: z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,31}$/),
  source: z.string().min(1).max(4_000),
  tests: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]{1,32}$/),
        args: z.array(valueSchema).max(4),
        expected: valueSchema,
      }),
    )
    .min(1)
    .max(8),
  timeoutMs: z.literal(EXECUTION_LIMITS.timeoutMs),
  correlationId: z.uuid(),
});

const executionResultSchema = z.object({
  status: z.enum([
    "completed",
    "timeout",
    "memory_limit",
    "process_limit",
    "runtime_error",
    "syntax_error",
    "runner_error",
  ]),
  tests: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]{1,32}$/),
        passed: z.boolean(),
      }),
    )
    .max(8),
  durationMs: z.number().int().min(0).max(60_000).optional(),
});

export function parseExecutionResult(value: unknown): ExecutionResult {
  const parsed = executionResultSchema.safeParse(value);
  if (!parsed.success) {
    return { status: "runner_error", tests: [], durationMs: 0 };
  }
  return {
    status: parsed.data.status,
    tests: parsed.data.status === "completed" ? parsed.data.tests : [],
    durationMs: parsed.data.durationMs ?? 0,
  };
}

export function sandboxPayload(request: ExecutionRequest): string {
  return JSON.stringify({
    entry: request.entry,
    source: request.source,
    tests: request.tests.map((test) => ({
      id: test.id,
      args: test.args,
      expected: test.expected,
    })),
    timeoutMs: request.timeoutMs,
  });
}
