import type { ProjectPlanReview } from "@platform/types";
import {
  moduleLeakRejection,
  moduleSchemaRejection,
  moduleSolutionRejection,
} from "../provider/errors";

const LEAK = /postgresql:\/\/|DATABASE_URL|sk-/i;
const SOLUTION = /<!DOCTYPE|<\/html>|function\s+greet\s*\(/i;
const ITEM_MAX = 240;

export function normalizeProjectPlanReview(
  value: unknown,
  forbiddenLiterals: readonly string[],
): ProjectPlanReview {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw moduleSchemaRejection();
  }
  const source = value as Record<string, unknown>;
  const summary = readText(source.summary, 500);
  const review: ProjectPlanReview = {
    summary,
    strengths: readList(source.strengths, "strengths", 4),
    risks: readList(source.risks, "risks", 4),
    suggestions: readList(source.suggestions, "suggestions", 4),
    questions: readList(source.questions, "questions", 3),
  };
  const body = JSON.stringify(review);
  if (LEAK.test(body)) {
    throw moduleLeakRejection();
  }
  if (SOLUTION.test(body)) {
    throw moduleSolutionRejection();
  }
  if (forbiddenLiterals.some((item) => item.length > 0 && body.includes(item))) {
    throw moduleLeakRejection();
  }
  return review;
}

function readText(value: unknown, max: number): string {
  if (typeof value !== "string") {
    throw moduleSchemaRejection([{ path: "summary", code: "invalid_type" }]);
  }
  const text = value.trim().slice(0, max);
  if (text.length === 0) {
    throw moduleSchemaRejection([{ path: "summary", code: "too_small" }]);
  }
  return text;
}

function readList(value: unknown, path: string, max: number): string[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw moduleSchemaRejection([{ path, code: "invalid_type" }]);
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, max)
    .map((item) => item.slice(0, ITEM_MAX));
}
