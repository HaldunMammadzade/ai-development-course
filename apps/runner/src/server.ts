import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import {
  executionRequestSchema,
  type CodeExecutionRunner,
  type ExecutionResult,
} from "@platform/execution";

const MAX_BODY = 32_768;

export function createRunnerServer(runner: CodeExecutionRunner, token: string) {
  return createServer((request, response) => {
    void handle(runner, token, request, response);
  });
}

async function handle(
  runner: CodeExecutionRunner,
  token: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  if (request.method === "GET" && request.url === "/health") {
    send(response, 200, { status: "ok" });
    return;
  }
  if (request.method !== "POST" || request.url !== "/execute") {
    send(response, 404, { status: "runner_error", tests: [], durationMs: 0 });
    return;
  }
  if (!authorized(request.headers.authorization, token)) {
    send(response, 401, { status: "runner_error", tests: [], durationMs: 0 });
    return;
  }
  const body = await readBody(request);
  if (body === null) {
    send(response, 400, { status: "runner_error", tests: [], durationMs: 0 });
    return;
  }
  const parsed = executionRequestSchema.safeParse(body);
  if (!parsed.success) {
    send(response, 400, { status: "runner_error", tests: [], durationMs: 0 });
    return;
  }
  const result = await runner.execute(parsed.data);
  console.log(
    JSON.stringify({
      correlationId: parsed.data.correlationId,
      status: result.status,
      durationMs: result.durationMs,
    }),
  );
  send(response, result.status === "runner_error" ? 503 : 200, publicResult(result));
}

function publicResult(result: ExecutionResult): ExecutionResult {
  return {
    status: result.status,
    tests: result.tests.map((test) => ({ id: test.id, passed: test.passed })),
    durationMs: result.durationMs,
  };
}

function authorized(header: string | undefined, token: string): boolean {
  if (header === undefined || !header.startsWith("Bearer ")) {
    return false;
  }
  const presented = Buffer.from(header.slice("Bearer ".length));
  const expected = Buffer.from(token);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        resolve(null);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown);
      } catch {
        resolve(null);
      }
    });
    request.on("error", () => resolve(null));
  });
}

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}
