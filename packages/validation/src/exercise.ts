import { z } from "zod";

export const EXERCISE_SUBMISSION_MAX_CHARS = 4_000;
export const EXERCISE_MAX_RULES = 8;

const slugSchema = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
const feedbackSchema = z.string().trim().min(1).max(240);
const pointsSchema = z.number().int().min(1).max(100);
const tagSchema = z.string().regex(/^[a-z][a-z0-9]*$/);
const attributeSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);

const scored = {
  points: pointsSchema,
  feedback: feedbackSchema,
};

export function isSafeAuthoredRegex(pattern: string): boolean {
  if (pattern.length < 1 || pattern.length > 64) {
    return false;
  }
  if (/\\[1-9]|\(\?[=!<]/.test(pattern)) {
    return false;
  }
  if (/[+*]\)[+*?]/.test(pattern) || /\([^)]*[+*][^)]*\)[+*]/.test(pattern)) {
    return false;
  }
  try {
    new RegExp(pattern, "u");
    return true;
  } catch {
    return false;
  }
}

export const exerciseRuleSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("required_text"), text: z.string().min(1).max(200), ...scored }),
  z.object({ type: z.literal("contains_text"), text: z.string().min(1).max(200), ...scored }),
  z.object({ type: z.literal("not_contains_text"), text: z.string().min(1).max(200), ...scored }),
  z.object({ type: z.literal("exact_text"), text: z.string().min(1).max(500), ...scored }),
  z
    .object({ type: z.literal("regex"), pattern: z.string().min(1).max(64), ...scored })
    .refine((rule) => isSafeAuthoredRegex(rule.pattern), { message: "regex is not allowed" }),
  z.object({
    type: z.literal("minimum_length"),
    length: z.number().int().min(1).max(EXERCISE_SUBMISSION_MAX_CHARS),
    ...scored,
  }),
  z.object({
    type: z.literal("maximum_length"),
    length: z.number().int().min(1).max(EXERCISE_SUBMISSION_MAX_CHARS),
    ...scored,
  }),
  z.object({ type: z.literal("html_element_exists"), tag: tagSchema, ...scored }),
  z.object({
    type: z.literal("html_attribute_exists"),
    tag: tagSchema,
    attribute: attributeSchema,
    ...scored,
  }),
  z.object({
    type: z.literal("html_attribute_equals"),
    tag: tagSchema,
    attribute: attributeSchema,
    value: z.string().min(1).max(200),
    ...scored,
  }),
  z.object({
    type: z.literal("ordered_tokens"),
    tokens: z.array(z.string().min(1).max(80)).min(2).max(6),
    ...scored,
  }),
  z.object({ type: z.literal("choice_equals"), optionId: slugSchema, ...scored }),
  z.object({ type: z.literal("execution_only"), ...scored }),
]);

const executionPrimitiveSchema = z.union([
  z.string().max(80),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

export const executionValueSchema = z.union([
  executionPrimitiveSchema,
  z.array(executionPrimitiveSchema).max(8),
]);

export const executionConfigSchema = z.object({
  entry: z.string().regex(/^[A-Za-z][A-Za-z0-9]{0,31}$/),
  tests: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]{1,32}$/),
        args: z.array(executionValueSchema).max(4),
        expected: executionValueSchema,
        points: pointsSchema,
      }),
    )
    .min(1)
    .max(EXERCISE_MAX_RULES),
});

export const exerciseRulesSchema = z.array(exerciseRuleSchema).min(1).max(EXERCISE_MAX_RULES);

export const exerciseAttemptRequestSchema = z.strictObject({
  clientAttemptId: z.uuid(),
  submission: z.string().max(EXERCISE_SUBMISSION_MAX_CHARS),
});

export type ExerciseAttemptRequest = z.infer<typeof exerciseAttemptRequestSchema>;

export const codeReviewRequestSchema = z.strictObject({
  attemptId: z.uuid(),
  clientReviewId: z.uuid(),
  mode: z.enum(["explain", "hint", "review"]),
});

export type CodeReviewRequest = z.infer<typeof codeReviewRequestSchema>;
