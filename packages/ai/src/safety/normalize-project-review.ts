import type { CodeReviewResult } from "@platform/types";
import { moduleSolutionRejection } from "../provider/errors";
import {
  normalizeCodeReviewTurn,
  type CodeReviewNormalization,
  type CodeReviewNormalizationScope,
} from "./normalize-code-review";

const FULL_SOLUTION =
  /<!DOCTYPE|<\/html>|function\s+greet\s*\(|return\s+["'`]Salam,|package\.json|```/i;

export function normalizeProjectReviewOutput(
  value: unknown,
  scope: CodeReviewNormalizationScope,
): CodeReviewResult {
  return normalizeProjectReviewTurn(value, scope).result;
}

export function normalizeProjectReviewTurn(
  value: unknown,
  scope: CodeReviewNormalizationScope,
): CodeReviewNormalization {
  if (containsFullSolution(value)) {
    throw moduleSolutionRejection();
  }
  return normalizeCodeReviewTurn(value, scope);
}

function containsFullSolution(value: unknown): boolean {
  if (typeof value === "string") {
    return FULL_SOLUTION.test(value);
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsFullSolution(item));
  }
  if (typeof value === "object" && value !== null) {
    return Object.values(value).some((item) => containsFullSolution(item));
  }
  return false;
}
