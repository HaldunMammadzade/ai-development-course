import { PROJECT_FILE_NAMES, type ProjectFiles } from "@platform/types";
import { z } from "zod";
import { executionValueSchema } from "./exercise";

export const PROJECT_FILE_MAX_CHARS = 4_000;
export const PROJECT_SUBMISSION_MAX_CHARS = 8_000;

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const conceptSlugSchema = z.string().regex(/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/);
const feedbackSchema = z.string().trim().min(1).max(240);
const labelSchema = z.string().trim().min(1).max(80);
const pointsSchema = z.number().int().min(1).max(100);
const tagSchema = z.string().regex(/^[a-z][a-z0-9]*$/);
const attributeSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);
const textFile = z
  .string()
  .max(PROJECT_FILE_MAX_CHARS)
  .refine((value) => !value.includes("\u0000"), {
    message: "Binary content is not allowed.",
  });

export const projectFilesSchema = z
  .strictObject({
    "index.html": textFile,
    "style.css": textFile,
    "script.js": textFile,
  })
  .refine(
    (files) =>
      PROJECT_FILE_NAMES.reduce((total, name) => total + files[name].length, 0) <=
      PROJECT_SUBMISSION_MAX_CHARS,
    { message: "The submission is too large." },
  );

export const PROJECT_PLAN_MAX_CHARS = 2_000;

export const projectPlanRequestSchema = z.strictObject({
  body: z
    .string()
    .trim()
    .min(20)
    .max(PROJECT_PLAN_MAX_CHARS)
    .refine((value) => !value.includes("\u0000"), {
      message: "Binary content is not allowed.",
    }),
});

export const projectAttemptRequestSchema = z.strictObject({
  clientAttemptId: z.uuid(),
  files: projectFilesSchema,
});

export type ProjectAttemptRequest = z.infer<typeof projectAttemptRequestSchema>;
export type ProjectPlanRequest = z.infer<typeof projectPlanRequestSchema>;

const scored = {
  points: pointsSchema,
  label: labelSchema,
  feedback: feedbackSchema,
};

export const projectCheckSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("html_element_exists"),
    tag: tagSchema,
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
    type: z.literal("contains_text"),
    file: z.enum(PROJECT_FILE_NAMES),
    text: z.string().min(1).max(200),
    ...scored,
  }),
  z.object({
    type: z.literal("forbidden_text"),
    file: z.enum(PROJECT_FILE_NAMES),
    text: z.string().min(1).max(200),
    ...scored,
  }),
  z.object({
    type: z.literal("css_declaration"),
    selector: z.string().min(1).max(40),
    property: z.string().regex(/^[a-z-]+$/),
    ...scored,
  }),
  z.object({
    type: z.literal("javascript_call"),
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
      .max(8),
    label: labelSchema,
    feedback: feedbackSchema,
  }),
]);

export const projectChecksSchema = z.array(projectCheckSchema).min(1).max(8);

export type ProjectCheck = z.infer<typeof projectCheckSchema>;

export const projectSeedSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(600),
  objective: z.string().trim().min(1).max(600),
  difficulty: z.enum(["beginner", "easy", "intermediate", "advanced", "expert"]),
  estimatedMinutes: z.number().int().min(10).max(240),
  status: z.enum(["draft", "published"]),
  requiredConcepts: z.array(conceptSlugSchema).min(1).max(8),
  milestones: z
    .array(
      z.object({
        slug: slugSchema,
        position: z.number().int().min(1).max(8),
        title: z.string().trim().min(1).max(120),
        objective: z.string().trim().min(1).max(400),
        instructions: z.string().trim().min(1).max(800),
        conceptSlug: conceptSlugSchema,
        starterFiles: projectFilesSchema,
        checks: projectChecksSchema,
      }),
    )
    .min(1)
    .max(8),
});

export type ProjectSeed = z.infer<typeof projectSeedSchema>;

export function isProjectFiles(value: unknown): value is ProjectFiles {
  return projectFilesSchema.safeParse(value).success;
}
