import type { ExecutionConfig } from "@platform/types";
import type { ExerciseEvaluation } from "./evaluation";
import type { ExecutionResult } from "./protocol";
import { sandboxFailureFeedback } from "./sandbox-feedback";

const PASS_SCORE = 70;

export function scoreExecution(
  config: ExecutionConfig,
  result: ExecutionResult,
): ExerciseEvaluation {
  if (result.status !== "completed") {
    return {
      score: 0,
      passed: false,
      feedback: sandboxFailureFeedback({
        status: result.status,
        passedCount: 0,
        totalCount: config.tests.length,
      }).feedback,
      passedRules: [],
      failedRules: [],
    };
  }

  const passedById = new Map(result.tests.map((test) => [test.id, test.passed]));
  let total = 0;
  let earned = 0;
  let passedCount = 0;
  for (const test of config.tests) {
    total += test.points;
    if (passedById.get(test.id) === true) {
      earned += test.points;
      passedCount += 1;
    }
  }
  const score = total === 0 ? 0 : clamp(Math.round((earned / total) * 100), 0, 100);
  const passed = score >= PASS_SCORE;
  const summary = `${passedCount}/${config.tests.length} yoxlama keçdi.`;
  const feedback =
    passedCount === config.tests.length
      ? summary
      : sandboxFailureFeedback({
          status: "completed",
          passedCount,
          totalCount: config.tests.length,
        }).feedback;
  return { score, passed, feedback, passedRules: [], failedRules: [] };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
