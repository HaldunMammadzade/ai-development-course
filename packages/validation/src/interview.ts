import { z } from "zod";
import { executionConfigSchema } from "./exercise";

export const ANSWER_TEXT_MAX = 6_000;
export const ANSWER_CODE_MAX = 8_000;
export const ANSWER_TOTAL_MAX = 10_000;

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const conceptSlugSchema = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
const text = z
  .string()
  .max(ANSWER_TEXT_MAX)
  .refine((value) => !value.includes("\u0000"), { message: "Binary content is not allowed." });
const code = z
  .string()
  .max(ANSWER_CODE_MAX)
  .refine((value) => !value.includes("\u0000"), { message: "Binary content is not allowed." });

export const interviewAnswerRequestSchema = z
  .strictObject({
    clientAnswerId: z.uuid(),
    text,
    code: code.optional(),
  })
  .refine((value) => value.text.length + (value.code?.length ?? 0) <= ANSWER_TOTAL_MAX, {
    message: "The answer is too large.",
  });

export const interviewSessionRequestSchema = z.strictObject({});

export type InterviewAnswerRequest = z.infer<typeof interviewAnswerRequestSchema>;

const questionSeedSchema = z.strictObject({
  slug: slugSchema,
  title: z.string().min(1).max(120),
  prompt: z.string().min(1).max(2_000),
  type: z.enum(["verbal", "code"]),
  conceptSlug: conceptSlugSchema,
  difficulty: z.enum(["beginner", "easy", "intermediate", "advanced", "expert"]),
  position: z.number().int().positive(),
  published: z.boolean(),
  criteria: z.string().min(1).max(200),
  weight: z.number().int().min(0).max(5),
  parentSlug: slugSchema.optional(),
  starterCode: z.string().max(2_000).optional(),
  execution: executionConfigSchema.optional(),
});

export const interviewSeedSchema = z
  .strictObject({
    slug: slugSchema,
    title: z.string().min(1).max(160),
    description: z.string().min(1).max(500),
    objective: z.string().min(1).max(500),
    difficulty: z.enum(["beginner", "easy", "intermediate", "advanced", "expert"]),
    estimatedMinutes: z.number().int().positive().max(180),
    published: z.boolean(),
    requirementSlugs: z.array(conceptSlugSchema).min(1),
    questions: z.array(questionSeedSchema).min(1),
  })
  .superRefine((interview, context) => {
    const slugs = new Set(interview.questions.map((question) => question.slug));
    const positions = new Set(interview.questions.map((question) => question.position));
    if (positions.size !== interview.questions.length) {
      context.addIssue({ code: "custom", message: "Duplicate question positions." });
    }
    for (const question of interview.questions) {
      if (question.parentSlug !== undefined && !slugs.has(question.parentSlug)) {
        context.addIssue({ code: "custom", message: "Follow-up parent is missing." });
      }
      if (question.type === "code" && question.execution === undefined) {
        context.addIssue({ code: "custom", message: "A code question needs execution." });
      }
      if (question.type === "verbal" && question.execution !== undefined) {
        context.addIssue({ code: "custom", message: "A verbal question has no execution." });
      }
    }
  });

export type InterviewSeedInput = z.infer<typeof interviewSeedSchema>;
