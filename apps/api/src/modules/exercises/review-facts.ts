import { EXECUTION_MESSAGES, type ExecutionStatus } from "@platform/execution";

const EXECUTION_STATUSES = [
  "completed",
  "timeout",
  "memory_limit",
  "process_limit",
  "runtime_error",
  "syntax_error",
  "runner_error",
] as const satisfies readonly ExecutionStatus[];

const COMPLETED_SUMMARY = /^(\d+)\/(\d+) yoxlama keçdi/;

const LEGACY_STATUS: ReadonlyArray<readonly [string, ExecutionStatus]> = [
  [EXECUTION_MESSAGES.timeout, "timeout"],
  [EXECUTION_MESSAGES.syntax_error, "syntax_error"],
  [EXECUTION_MESSAGES.memory_limit, "memory_limit"],
  [EXECUTION_MESSAGES.process_limit, "process_limit"],
  [EXECUTION_MESSAGES.runtime_error, "runtime_error"],
];

export interface ReviewExecutionFacts {
  status: ExecutionStatus;
  passedTests: number;
  totalTests: number;
}

export function reviewExecutionFacts(input: {
  passedRules: unknown;
  feedback: string;
  passed: boolean;
  testCount: number;
}): ReviewExecutionFacts | null {
  const stored = readStoredStatus(input.passedRules);
  if (stored === "malformed") {
    return null;
  }
  if (stored !== "absent") {
    return factsForStatus(stored, input);
  }
  return legacyFacts(input);
}

function factsForStatus(
  status: ExecutionStatus,
  input: { feedback: string; passed: boolean; testCount: number },
): ReviewExecutionFacts {
  if (status !== "completed") {
    return { status, passedTests: 0, totalTests: input.testCount };
  }
  const summary = completedSummary(input.feedback);
  if (summary !== null) {
    return { status, ...summary };
  }
  if (input.passed) {
    return { status, passedTests: input.testCount, totalTests: input.testCount };
  }
  return { status, passedTests: 0, totalTests: input.testCount };
}

function legacyFacts(input: { feedback: string; testCount: number }): ReviewExecutionFacts | null {
  const summary = completedSummary(input.feedback);
  if (summary !== null) {
    return { status: "completed", ...summary };
  }
  for (const [message, status] of LEGACY_STATUS) {
    if (input.feedback.startsWith(message)) {
      return { status, passedTests: 0, totalTests: input.testCount };
    }
  }
  return null;
}

function completedSummary(feedback: string): { passedTests: number; totalTests: number } | null {
  const match = COMPLETED_SUMMARY.exec(feedback);
  if (match?.[1] === undefined || match[2] === undefined) {
    return null;
  }
  return { passedTests: Number(match[1]), totalTests: Number(match[2]) };
}

function readStoredStatus(passedRules: unknown): ExecutionStatus | "malformed" | "absent" {
  if (!Array.isArray(passedRules)) {
    return "absent";
  }
  let status: ExecutionStatus | null = null;
  for (const item of passedRules) {
    if (!hasExecutionStatus(item)) {
      continue;
    }
    if (!isExecutionStatus(item.executionStatus)) {
      return "malformed";
    }
    if (status !== null && status !== item.executionStatus) {
      return "malformed";
    }
    status = item.executionStatus;
  }
  return status ?? "absent";
}

function hasExecutionStatus(value: unknown): value is { executionStatus: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "executionStatus" in value
  );
}

function isExecutionStatus(value: unknown): value is ExecutionStatus {
  return typeof value === "string" && (EXECUTION_STATUSES as readonly string[]).includes(value);
}
