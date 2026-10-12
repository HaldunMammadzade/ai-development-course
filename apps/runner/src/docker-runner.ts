import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  EXECUTION_LIMITS,
  parseExecutionResult,
  sandboxPayload,
  type ExecutionRequest,
  type ExecutionResult,
} from "@platform/execution";
import { hostProcessEnv, sandboxDockerArgs } from "./docker-args";

const slots = { active: 0 };

export async function executeInDocker(request: ExecutionRequest): Promise<ExecutionResult> {
  if (slots.active >= EXECUTION_LIMITS.maxConcurrent) {
    return { status: "runner_error", tests: [], durationMs: 0 };
  }
  slots.active += 1;
  const started = Date.now();
  const name = `exec-${randomUUID()}`;
  try {
    const outcome = await runContainer(name, sandboxPayload(request), request.timeoutMs);
    if (outcome.timedOut) {
      return { status: "timeout", tests: [], durationMs: Date.now() - started };
    }
    if (outcome.killedForSize) {
      return { status: "runtime_error", tests: [], durationMs: Date.now() - started };
    }
    if (outcome.exitCode === 137) {
      return { status: "memory_limit", tests: [], durationMs: Date.now() - started };
    }
    const parsed = parseExecutionResult(lastResult(outcome.stdout));
    if (parsed.status === "runner_error" && outcome.exitCode !== 0) {
      if (outcome.stderr.includes("cannot allocate memory") || outcome.stderr.includes("fork")) {
        return { status: "process_limit", tests: [], durationMs: Date.now() - started };
      }
    }
    return { ...parsed, durationMs: parsed.durationMs || Date.now() - started };
  } catch {
    return { status: "runner_error", tests: [], durationMs: Date.now() - started };
  } finally {
    slots.active -= 1;
    await removeContainer(name);
  }
}

export async function removeContainer(name: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const child = spawn("docker", ["rm", "-f", name], {
      stdio: "ignore",
      env: hostProcessEnv(process.env),
    });
    child.on("error", () => resolve());
    child.on("close", () => resolve());
  });
}

function runContainer(
  name: string,
  stdin: string,
  timeoutMs: number,
): Promise<{
  timedOut: boolean;
  killedForSize: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
}> {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", sandboxDockerArgs(name), {
      stdio: ["pipe", "pipe", "pipe"],
      env: hostProcessEnv(process.env),
    });
    let timedOut = false;
    let killedForSize = false;
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const next = consumeStdout(stdout, chunk, EXECUTION_LIMITS.maxStdoutBytes);
      stdout = next.text;
      if (next.overflow && !killedForSize) {
        killedForSize = true;
        child.kill("SIGKILL");
      }
    });
    child.stderr.on("data", (chunk: string) => {
      if (stderr.length < 4_096) {
        stderr += chunk.slice(0, 4_096 - stderr.length);
      }
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ timedOut, killedForSize, exitCode, stdout, stderr });
    });
    child.stdin.write(stdin);
    child.stdin.end();
  });
}

export function consumeStdout(
  current: string,
  chunk: string,
  max: number,
): { text: string; overflow: boolean } {
  if (current.length >= max) {
    return { text: current, overflow: true };
  }
  return { text: current + chunk.slice(0, max - current.length), overflow: false };
}

export function lastResult(stdout: string): unknown {
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.length <= EXECUTION_LIMITS.maxResultBytes);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line === undefined || !line.startsWith("{")) {
      continue;
    }
    try {
      return JSON.parse(line) as unknown;
    } catch {
      continue;
    }
  }
  return null;
}
