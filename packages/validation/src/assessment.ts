import { z } from "zod";

export const assessmentAnswerSchema = z
  .object({
    itemId: z.string().min(1).max(80),
    answer: z.string().min(1).max(2000),
    clientAttemptId: z.string().uuid(),
  })
  .strict();

export type AssessmentAnswerInput = z.infer<typeof assessmentAnswerSchema>;
