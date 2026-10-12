import type { CodeExecutionRunner, ExecutionRequest, ExecutionResult } from "./protocol";

let scriptedRuns = 0;
let scriptedRequest: ExecutionRequest | null = null;

export function scriptedExecutionCount(): number {
  return scriptedRuns;
}

export function lastScriptedRequest(): ExecutionRequest | null {
  return scriptedRequest;
}

export function resetScriptedExecutionCount(): void {
  scriptedRuns = 0;
  scriptedRequest = null;
}

export class FakeCodeExecutionRunner implements CodeExecutionRunner {
  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    scriptedRuns += 1;
    scriptedRequest = request;
    return scriptedObservation(request);
  }
}

export function scriptedObservation(request: ExecutionRequest): ExecutionResult {
  const source = request.source;
  if (source.includes("while (true)") || source.includes("while(true)")) {
    return { status: "timeout", tests: [], durationMs: request.timeoutMs };
  }
  if (source.includes(":::syntax")) {
    return { status: "syntax_error", tests: [], durationMs: 1 };
  }
  if (source.includes(":::memory")) {
    return { status: "memory_limit", tests: [], durationMs: 1 };
  }
  if (source.includes(":::process")) {
    return { status: "process_limit", tests: [], durationMs: 1 };
  }
  if (source.includes("throw ")) {
    return { status: "runtime_error", tests: [], durationMs: 1 };
  }
  if (source.includes(":::runner")) {
    return { status: "runner_error", tests: [], durationMs: 1 };
  }
  const signal = passSignal(source);
  return {
    status: "completed",
    durationMs: 1,
    tests: request.tests.map((test, index) => ({
      id: test.id,
      passed: signal === "all" || (signal === "partial" && index === 0),
    })),
  };
}

function passSignal(source: string): "all" | "partial" | "none" {
  if (
    source.includes("return a + b") ||
    source.includes("n % 2 === 0") ||
    source.includes('.split("").reverse().join("")')
  ) {
    return "all";
  }
  if (source.includes("return a - b")) {
    return "partial";
  }
  if (
    source.includes('return "Salam, " + name') ||
    source.includes("return 'Salam, ' + name") ||
    source.includes("return `Salam, ${name}`")
  ) {
    return "all";
  }
  if (source.includes('return "Salam"')) {
    return "partial";
  }
  return "none";
}
