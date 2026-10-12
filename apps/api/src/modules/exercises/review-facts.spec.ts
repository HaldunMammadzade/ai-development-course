import { EXECUTION_MESSAGES, sandboxFailureFeedback } from "@platform/execution";
import { describe, expect, it } from "vitest";
import { reviewExecutionFacts } from "./review-facts";

const behavior = sandboxFailureFeedback({
  status: "completed",
  passedCount: 1,
  totalCount: 3,
}).feedback;

describe("reviewExecutionFacts", () => {
  it("keeps a stored timeout when the learner sentence looks like a completed miss", () => {
    expect(
      reviewExecutionFacts({
        passedRules: [{ executionStatus: "timeout" }],
        feedback: behavior,
        passed: false,
        testCount: 3,
      }),
    ).toEqual({ status: "timeout", passedTests: 0, totalTests: 3 });
  });

  it("keeps syntax, runtime, memory, and process statuses from the stored result", () => {
    for (const status of [
      "syntax_error",
      "runtime_error",
      "memory_limit",
      "process_limit",
    ] as const) {
      expect(
        reviewExecutionFacts({
          passedRules: [{ executionStatus: status }],
          feedback: "unrelated learner text",
          passed: false,
          testCount: 3,
        })?.status,
      ).toBe(status);
    }
  });

  it("keeps a completed failure distinct from an execution stop", () => {
    expect(
      reviewExecutionFacts({
        passedRules: [{ executionStatus: "completed" }],
        feedback: behavior,
        passed: false,
        testCount: 3,
      }),
    ).toEqual({ status: "completed", passedTests: 1, totalTests: 3 });
  });

  it("keeps a successful run completed with every check counted", () => {
    expect(
      reviewExecutionFacts({
        passedRules: [{ executionStatus: "completed" }],
        feedback: "3/3 yoxlama keçdi.",
        passed: true,
        testCount: 3,
      }),
    ).toEqual({ status: "completed", passedTests: 3, totalTests: 3 });
  });

  it("reads a legacy one-line status and the current longer sentence", () => {
    expect(
      reviewExecutionFacts({
        passedRules: [],
        feedback: EXECUTION_MESSAGES.syntax_error,
        passed: false,
        testCount: 3,
      })?.status,
    ).toBe("syntax_error");
    expect(
      reviewExecutionFacts({
        passedRules: [],
        feedback: sandboxFailureFeedback({ status: "timeout", passedCount: 0, totalCount: 3 })
          .feedback,
        passed: false,
        testCount: 3,
      })?.status,
    ).toBe("timeout");
    expect(
      reviewExecutionFacts({
        passedRules: [],
        feedback: "1/3 yoxlama keçdi. Bəzi yoxlamalar uğursuz oldu.",
        passed: false,
        testCount: 3,
      }),
    ).toEqual({ status: "completed", passedTests: 1, totalTests: 3 });
  });

  it("does not classify unknown or malformed results as runtime errors", () => {
    expect(
      reviewExecutionFacts({
        passedRules: [],
        feedback: "Cavab boşdur.",
        passed: false,
        testCount: 3,
      }),
    ).toBeNull();
    expect(
      reviewExecutionFacts({
        passedRules: [{ executionStatus: "exploded" }],
        feedback: EXECUTION_MESSAGES.runtime_error,
        passed: false,
        testCount: 3,
      }),
    ).toBeNull();
    expect(
      reviewExecutionFacts({
        passedRules: [{ executionStatus: "timeout" }, { executionStatus: "syntax_error" }],
        feedback: EXECUTION_MESSAGES.timeout,
        passed: false,
        testCount: 3,
      }),
    ).toBeNull();
  });
});
