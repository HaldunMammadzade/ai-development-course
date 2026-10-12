import type { ExecutionConfig } from "@platform/types";
import { describe, expect, it } from "vitest";
import { EXECUTION_MESSAGES } from "./limits";
import { parseExecutionResult } from "./protocol";
import { sandboxFailureFeedback } from "./sandbox-feedback";
import { scoreExecution } from "./score";

const config: ExecutionConfig = {
  entry: "add",
  tests: [
    { id: "add-a", args: [2, 3], expected: 5, points: 34 },
    { id: "add-b", args: [-2, 5], expected: 3, points: 33 },
    { id: "add-c", args: [0, 0], expected: 0, points: 33 },
  ],
};

describe("scoreExecution", () => {
  it("scores a complete pass from observations and ignores a runner-supplied score", () => {
    const parsed = parseExecutionResult({
      status: "completed",
      score: 0,
      passed: false,
      tests: [
        { id: "add-a", passed: true },
        { id: "add-b", passed: true },
        { id: "add-c", passed: true },
      ],
    });
    expect(parsed.status).toBe("completed");
    expect(scoreExecution(config, parsed)).toMatchObject({
      score: 100,
      passed: true,
      feedback: "3/3 yoxlama keçdi.",
    });
  });

  it("scores a partial result without treating a forged score as authoritative", () => {
    const parsed = parseExecutionResult({
      status: "completed",
      score: 100,
      passed: true,
      tests: [
        { id: "add-a", passed: true },
        { id: "add-b", passed: false },
        { id: "add-c", passed: false },
      ],
    });
    const scored = scoreExecution(config, parsed);
    expect(scored.score).toBe(34);
    expect(scored.passed).toBe(false);
    expect(scored.feedback).toBe(
      sandboxFailureFeedback({ status: "completed", passedCount: 1, totalCount: 3 }).feedback,
    );
    expect(scored.feedback).toContain("1/3 yoxlama keçdi.");
    expect(scored.feedback).toContain("tələb olunan davranışa uyğun gəlmir");
    expect(scored.feedback).not.toContain("kənar");
    expect(scored.feedback).not.toContain("tip");
    expect(scored.passedRules).toEqual([]);
    expect(scored.failedRules).toEqual([]);
    expect(JSON.stringify(scored)).not.toContain("add-a");
    expect(JSON.stringify(scored)).not.toContain("expected");
  });

  it("keeps hidden inputs, expected values, and test ids out of a failed result", () => {
    const hidden: ExecutionConfig = {
      entry: "reverseString",
      tests: [{ id: "rev-c", args: ["Qx7"], expected: "7xQ", points: 100 }],
    };
    const scored = scoreExecution(hidden, {
      status: "completed",
      tests: [{ id: "rev-c", passed: false }],
      durationMs: 1,
    });
    const body = JSON.stringify(scored);
    expect(scored.passed).toBe(false);
    expect(scored.score).toBe(0);
    expect(scored.feedback).toContain("0/1 yoxlama keçdi.");
    expect(body).not.toContain("rev-c");
    expect(body).not.toContain("Qx7");
    expect(body).not.toContain("7xQ");
    expect(body).not.toContain("reverseString");
  });

  it("uses the generic behavior message when a completed run does not say why a check failed", () => {
    const scored = scoreExecution(config, {
      status: "completed",
      tests: [],
      durationMs: 1,
    });
    expect(
      sandboxFailureFeedback({ status: "completed", passedCount: 0, totalCount: 3 }),
    ).toMatchObject({
      kind: "behavior_mismatch",
    });
    expect(scored.feedback).toBe(
      sandboxFailureFeedback({ status: "completed", passedCount: 0, totalCount: 3 }).feedback,
    );
    expect(scored.feedback).not.toContain("add-a");
  });

  it("scores a total miss as zero", () => {
    const scored = scoreExecution(config, {
      status: "completed",
      tests: [
        { id: "add-a", passed: false },
        { id: "add-b", passed: false },
        { id: "add-c", passed: false },
      ],
      durationMs: 1,
    });
    expect(scored.score).toBe(0);
    expect(scored.passed).toBe(false);
  });

  it("maps limit and error statuses to safe feedback", () => {
    const timeout = scoreExecution(config, { status: "timeout", tests: [], durationMs: 2000 });
    expect(timeout.score).toBe(0);
    expect(timeout.passed).toBe(false);
    expect(timeout.feedback.startsWith(EXECUTION_MESSAGES.timeout)).toBe(true);
    expect(timeout.feedback).toContain("Yoxlamalar işləmədi.");
    expect(sandboxFailureFeedback({ status: "timeout", passedCount: 0, totalCount: 3 }).kind).toBe(
      "execution_stopped",
    );

    const syntax = scoreExecution(config, { status: "syntax_error", tests: [], durationMs: 1 });
    expect(syntax.feedback.startsWith(EXECUTION_MESSAGES.syntax_error)).toBe(true);
    expect(syntax.feedback).toContain("sintaksisi düzəlt");

    const runtime = scoreExecution(config, { status: "runtime_error", tests: [], durationMs: 1 });
    expect(runtime.feedback.startsWith(EXECUTION_MESSAGES.runtime_error)).toBe(true);
    expect(runtime.feedback).toContain("nəticə vermədən dayandı");

    const runner = scoreExecution(config, {
      status: "runner_error",
      tests: [{ id: "add-a", passed: false }],
      durationMs: 1,
    });
    expect(runner.feedback).toBe(runtime.feedback);
    expect(JSON.stringify(runner)).not.toContain("add-a");

    const memory = scoreExecution(config, { status: "memory_limit", tests: [], durationMs: 1 });
    expect(memory.score).toBe(0);
    expect(memory.feedback.startsWith(EXECUTION_MESSAGES.memory_limit)).toBe(true);
    expect(
      scoreExecution(config, {
        status: "process_limit",
        tests: [],
        durationMs: 1,
      }).feedback.startsWith(EXECUTION_MESSAGES.process_limit),
    ).toBe(true);
  });

  it("rejects a result that is not the observation schema", () => {
    expect(
      parseExecutionResult({ status: "completed", tests: [{ id: "add-a", passed: "yes" }] }).status,
    ).toBe("runner_error");
  });
});
