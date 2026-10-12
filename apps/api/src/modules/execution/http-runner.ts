import {
  parseExecutionResult,
  type CodeExecutionRunner,
  type ExecutionRequest,
  type ExecutionResult,
} from "@platform/execution";

export class HttpCodeExecutionRunner implements CodeExecutionRunner {
  constructor(
    private readonly runnerUrl: string,
    private readonly runnerToken: string,
  ) {}

  async execute(request: ExecutionRequest): Promise<ExecutionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), request.timeoutMs + 4_000);
    try {
      const response = await fetch(new URL("/execute", this.runnerUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.runnerToken}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => null);
      const parsed = parseExecutionResult(body);
      if (!response.ok && parsed.status === "completed") {
        return { status: "runner_error", tests: [], durationMs: 0 };
      }
      return parsed;
    } catch {
      return { status: "runner_error", tests: [], durationMs: 0 };
    } finally {
      clearTimeout(timer);
    }
  }
}
