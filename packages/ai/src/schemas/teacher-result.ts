import type { TeacherResult, TeachingState, Understanding } from "@platform/types";
import { z } from "zod";
import { AIProviderError, type AiSchemaIssue } from "../provider/errors";

const TEACHING_STATES = [
  "created",
  "prior_check",
  "objective",
  "explain",
  "comprehension_check",
  "adapt",
  "exercise",
  "evaluate",
  "hint",
  "raise_difficulty",
  "summarize",
  "homework",
  "completed",
  "abandoned",
] as const satisfies readonly TeachingState[];

const UNDERSTANDING = [
  "unknown",
  "incorrect",
  "partial",
  "correct",
] as const satisfies readonly Understanding[];

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i);

const speechSchema = z.string().trim().min(1).max(4_000);

export const teacherResultSchema = z.strictObject({
  speech: speechSchema,
  understanding: z.enum(UNDERSTANDING),
  misconception: z
    .strictObject({
      code: slugSchema,
      description: z.string().trim().min(1).max(280),
      conceptSlug: slugSchema,
      confidence: z.number().min(0).max(1).optional(),
    })
    .nullable(),
  skillUpdates: z
    .array(
      z.strictObject({
        conceptSlug: slugSchema,
        evidence: z.number().int().min(0).max(100),
        understanding: z.enum(["incorrect", "partial", "correct"]),
      }),
    )
    .max(3),
  memoryNotes: z
    .array(
      z.strictObject({
        category: z.enum(["learning", "mistake", "preference"]),
        conceptSlug: slugSchema.optional(),
        content: z.string().trim().min(1).max(280),
        importance: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      }),
    )
    .max(2),
  suggestedState: z.enum(TEACHING_STATES).nullable(),
  homework: z.string().trim().min(1).max(280).nullable(),
  cacheableExplanation: z
    .strictObject({
      conceptSlug: slugSchema,
      difficulty: z.enum(["beginner", "intermediate", "advanced"]),
      speech: speechSchema,
    })
    .nullable(),
});

const DROPPED_KEYS = new Set([
  "weight",
  "userId",
  "lessonId",
  "mastery",
  "score",
  "permissions",
  "password",
  "passwordHash",
  "token",
  "apiKey",
  "sessionToken",
  "secret",
  "plan",
  "lessonCompleted",
  "unlockLesson",
  "nextLessonId",
]);

export function stripModelSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripModelSecrets(item));
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (DROPPED_KEYS.has(key)) {
      continue;
    }
    next[key] = stripModelSecrets(item);
  }
  return next;
}

export function parseTeacherResult(value: unknown): TeacherResult {
  const parsed = teacherResultSchema.safeParse(value);
  if (!parsed.success) {
    throw new AIProviderError("invalid_response", {
      failureCategory: "teacher_schema_rejection",
      schemaIssues: parsed.error.issues.slice(0, 8).map((issue) => ({
        path: issue.path
          .filter(
            (part): part is string | number => typeof part === "string" || typeof part === "number",
          )
          .map(String)
          .join("."),
        code: issue.code,
      })),
    });
  }
  return parsed.data;
}

export function readTeacherResult(value: unknown): {
  result: TeacherResult;
  recoveredIssues: readonly AiSchemaIssue[];
} {
  try {
    return { result: parseTeacherResult(value), recoveredIssues: [] };
  } catch (error) {
    if (!isSuggestedStateEnumMiss(error, value)) {
      throw error;
    }
    return {
      result: parseTeacherResult(omitSuggestedState(value as Record<string, unknown>)),
      recoveredIssues: error.schemaIssues,
    };
  }
}

export function decodeTeacherJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new AIProviderError("malformed_json", { failureCategory: "malformed_json" });
  }
}

function isSuggestedStateEnumMiss(error: unknown, value: unknown): error is AIProviderError {
  return (
    error instanceof AIProviderError &&
    error.failureCategory === "teacher_schema_rejection" &&
    error.schemaIssues.length > 0 &&
    error.schemaIssues.every(
      (issue) => issue.path === "suggestedState" && issue.code === "invalid_value",
    ) &&
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function omitSuggestedState(value: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (key !== "suggestedState") {
      next[key] = item;
    }
  }
  next.suggestedState = null;
  return next;
}

export function parseTeacherResultJson(text: string): TeacherResult {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new AIProviderError("malformed_json", { failureCategory: "malformed_json" });
  }
  return parseTeacherResult(value);
}
