import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { EXECUTION_LIMITS, type ExecutionRequest } from "@platform/execution";
import { afterAll, describe, expect, it } from "vitest";
import { hostProcessEnv, sandboxDockerArgs } from "./docker-args";
import { executeInDocker, removeContainer } from "./docker-runner";

const docker = spawnSync("docker", ["version"], { encoding: "utf8", timeout: 8_000 });
const dockerReady = docker.status === 0;

describe.skipIf(!dockerReady)("docker sandbox", () => {
  const names: string[] = [];

  afterAll(() => {
    for (const name of names) {
      spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
    }
    spawnSync("docker", ["ps", "-aq", "--filter", "name=exec-"], { encoding: "utf8" });
  });

  it("builds the sandbox image", () => {
    const built = spawnSync(
      "docker",
      ["build", "-t", EXECUTION_LIMITS.image, path.resolve(process.cwd(), "sandbox")],
      { encoding: "utf8", timeout: 180_000 },
    );
    expect(built.status).toBe(0);
  }, 180_000);

  it("scores a correct function and rejects a wrong one inside the container", async () => {
    const correct = await executeInDocker(
      request("function add(a, b) {\n  return a + b;\n}\n", "add"),
    );
    expect(correct.status).toBe("completed");
    expect(correct.tests.every((test) => test.passed)).toBe(true);

    const wrong = await executeInDocker(request("function add(a, b) {\n  return 0;\n}\n", "add"));
    expect(wrong.status).toBe("completed");
    expect(wrong.tests.every((test) => test.passed)).toBe(false);
  }, 30_000);

  it("reports syntax errors, thrown exceptions, and infinite loops without leaving a container", async () => {
    const syntax = await executeInDocker(request("function add( {", "add"));
    expect(syntax.status).toBe("syntax_error");

    const thrown = await executeInDocker(request('throw new Error("test");', "add"));
    expect(thrown.status).toBe("runtime_error");

    const loop = await executeInDocker(request("while (true) {}", "add"));
    expect(loop.status).toBe("timeout");
    const running = spawnSync(
      "docker",
      ["ps", "-q", "--filter", `ancestor=${EXECUTION_LIMITS.image}`],
      {
        encoding: "utf8",
      },
    );
    expect(running.stdout.trim()).toBe("");
  }, 30_000);

  it("cannot read the host, open the network, see secrets, or use the docker socket", async () => {
    const secret = "host-secret-marker";
    const escaped = await executeInDocker(
      request(
        `function add() {
          try {
            const fs = (function () {}).constructor("return process")().mainModule.require("fs");
            return fs.readFileSync("/definitely/not/on/the/host-secret", "utf8");
          } catch (error) {
            return "blocked";
          }
        }`,
        "add",
        [{ id: "add-a", args: [], expected: secret }],
      ),
    );
    expect(escaped.status === "completed" || escaped.status === "runtime_error").toBe(true);
    expect(escaped.tests.every((test) => test.passed)).toBe(false);

    const network = probe(
      "const net = require('net'); const socket = net.connect(80, '1.1.1.1'); socket.on('connect', () => process.exit(0)); socket.on('error', () => process.exit(2)); setTimeout(() => process.exit(2), 1000);",
    );
    expect(network.code).toBe(2);

    const env = probe("process.stdout.write(process.env.DATABASE_URL || 'empty')", {
      DATABASE_URL: "postgresql://postgres:secret@localhost/platform",
      AI_API_KEY: "sk-secret",
    });
    expect(env.stdout).toBe("empty");
    expect(env.stdout).not.toContain("secret");

    const socket = probe(
      "process.stdout.write(String(require('fs').existsSync('/var/run/docker.sock')))",
    );
    expect(socket.stdout).toBe("false");

    const hostFile = probe(
      "try { require('fs').readFileSync('/etc/platform-host-only'); process.exit(0); } catch (error) { process.exit(3); }",
    );
    expect(hostFile.code).toBe(3);

    const uid = probe("process.stdout.write(String(process.getuid()))");
    expect(uid.stdout).not.toBe("0");

    const rootWrite = probe(
      "try { require('fs').writeFileSync('/etc/sandbox-write', 'x'); process.exit(0); } catch (error) { process.exit(4); }",
    );
    expect(rootWrite.code).toBe(4);
  }, 40_000);

  it("scores a correct function when student logging is large", async () => {
    const flooded = await executeInDocker(
      request(`function add(a, b) { console.log("A".repeat(20000)); return a + b; }`, "add"),
    );
    expect(flooded.status).toBe("completed");
    expect(flooded.tests.every((test) => test.passed)).toBe(true);
  }, 20_000);

  it("allows four concurrent runs, rejects the fifth, and recovers", async () => {
    const slow = "function add() { let i = 0; while (i < 500000000) { i += 1; } return 5; }";
    const holders = [0, 1, 2, 3].map(() => executeInDocker(request(slow, "add")));
    await new Promise((resolve) => setTimeout(resolve, 250));
    const fifth = await executeInDocker(request("function add(a, b) { return a + b; }", "add"));
    expect(fifth.status).toBe("runner_error");
    await Promise.all(holders);
    const recovered = await executeInDocker(request("function add(a, b) { return a + b; }", "add"));
    expect(recovered.status).toBe("completed");
    expect(recovered.tests.every((test) => test.passed)).toBe(true);
  }, 30_000);

  it("cleans up after a memory limit", async () => {
    const oom = await executeInDocker(
      request(
        "function add() { const chunks = []; while (true) { chunks.push(Buffer.alloc(8 * 1024 * 1024)); } }",
        "add",
      ),
    );
    expect(oom.status === "memory_limit" || oom.status === "runtime_error").toBe(true);
    const running = spawnSync(
      "docker",
      ["ps", "-q", "--filter", `ancestor=${EXECUTION_LIMITS.image}`],
      { encoding: "utf8" },
    );
    expect(running.stdout.trim()).toBe("");
  }, 30_000);

  it("removes a container that ignores the harness", async () => {
    const name = `exec-${randomUUID()}`;
    names.push(name);
    const args = sandboxDockerArgs(name);
    const image = args[args.length - 1];
    const child = spawn(
      "docker",
      [...args.slice(0, -1), "--entrypoint", "sleep", image ?? EXECUTION_LIMITS.image, "30"],
      { env: hostProcessEnv(process.env), stdio: "ignore" },
    );
    await new Promise((resolve) => setTimeout(resolve, 700));
    await removeContainer(name);
    const listed = spawnSync("docker", ["ps", "-q", "--filter", `name=${name}`], {
      encoding: "utf8",
    });
    expect(listed.stdout.trim()).toBe("");
    child.kill("SIGKILL");
  }, 20_000);
});

function request(
  source: string,
  entry: string,
  tests: ExecutionRequest["tests"] = [
    { id: "add-a", args: [2, 3], expected: 5 },
    { id: "add-b", args: [-2, 5], expected: 3 },
    { id: "add-c", args: [0, 0], expected: 0 },
  ],
): ExecutionRequest {
  return {
    language: "javascript",
    entry,
    source,
    tests,
    timeoutMs: EXECUTION_LIMITS.timeoutMs,
    correlationId: randomUUID(),
  };
}

function probe(
  script: string,
  extra: NodeJS.ProcessEnv = {},
): { code: number | null; stdout: string } {
  const name = `exec-${randomUUID()}`;
  const args = sandboxDockerArgs(name);
  const image = args[args.length - 1] ?? EXECUTION_LIMITS.image;
  const result = spawnSync(
    "docker",
    [...args.slice(0, -1), "--entrypoint", "node", image, "-e", script],
    {
      encoding: "utf8",
      timeout: 12_000,
      input: "",
      env: { ...hostProcessEnv(process.env), ...extra },
    },
  );
  spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
  return { code: result.status, stdout: result.stdout ?? "" };
}
