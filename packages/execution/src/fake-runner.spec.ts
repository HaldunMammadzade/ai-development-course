import { describe, expect, it } from "vitest";
import { FakeCodeExecutionRunner } from "./fake-runner";
import { sandboxPayload } from "./protocol";
import type { ExecutionRequest } from "./protocol";

const request = (source: string): ExecutionRequest => ({
  language: "javascript",
  entry: "add",
  source,
  tests: [
    { id: "add-a", args: [2, 3], expected: 5 },
    { id: "add-b", args: [-2, 5], expected: 3 },
  ],
  timeoutMs: 2_000,
  correlationId: "00000000-0000-4000-8000-000000000001",
});

describe("FakeCodeExecutionRunner", () => {
  it("does not execute source and only recognizes scripted fixtures", async () => {
    const runner = new FakeCodeExecutionRunner();
    const correct = await runner.execute(request("function add(a, b) {\n  return a + b;\n}\n"));
    const partial = await runner.execute(request("function add(a, b) {\n  return a - b;\n}\n"));
    const wrong = await runner.execute(request("function add(a, b) {\n  return 0;\n}\n"));
    const hostile = await runner.execute(
      request("function add(){ require('child_process').exec('id'); return 1 }"),
    );
    expect(correct.tests.every((test) => test.passed)).toBe(true);
    expect(partial.tests.map((test) => test.passed)).toEqual([true, false]);
    expect(wrong.tests.every((test) => test.passed)).toBe(false);
    expect(hostile.status).toBe("completed");
    expect(hostile.tests.every((test) => test.passed)).toBe(false);
  });

  it("keeps the sandbox payload free of process secrets", () => {
    const payload = sandboxPayload(request("function add(a, b) { return a + b; }"));
    expect(payload).not.toContain("DATABASE_URL");
    expect(payload).not.toContain("correlationId");
    expect(JSON.parse(payload).expected).toBeUndefined();
  });
});
