import type { CodeReviewResult } from "@platform/types";
import { z } from "zod";
import { moduleSchemaRejection } from "../provider/errors";

const UNDERSTANDING = ["unknown", "incorrect", "partial", "correct"] as const;
const ISSUE_TYPES = ["logic", "syntax", "concept", "style", "edge_case"] as const;

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/i);

export const codeReviewResultSchema = z.object({
  summary: z.string().trim().min(1).max(500),
  understanding: z.enum(UNDERSTANDING),
  feedback: z.string().trim().min(1).max(1_500),
  hint: z.string().trim().min(1).max(600).optional(),
  strengths: z.array(z.string().trim().min(1).max(240)).max(3),
  issues: z
    .array(
      z.object({
        conceptSlug: slugSchema.optional(),
        type: z.enum(ISSUE_TYPES),
        description: z.string().trim().min(1).max(400),
      }),
    )
    .max(3),
  nextQuestion: z.string().trim().min(1).max(500).optional(),
  suggestedConcepts: z.array(slugSchema).max(3).optional(),
});

export function parseCodeReviewResult(value: unknown): CodeReviewResult {
  const parsed = codeReviewResultSchema.safeParse(value);
  if (!parsed.success) {
    throw moduleSchemaRejection(
      parsed.error.issues.slice(0, 8).map((issue) => ({
        path: issue.path
          .filter(
            (part): part is string | number => typeof part === "string" || typeof part === "number",
          )
          .map(String)
          .join("."),
        code: issue.code,
      })),
    );
  }
  return parsed.data;
}
