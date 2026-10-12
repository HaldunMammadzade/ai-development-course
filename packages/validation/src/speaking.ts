import { z } from "zod";

const SPEAKING_TRANSCRIPT_MAX = 6_000;

export const speakingStartSchema = z.strictObject({
  mode: z.enum(["lesson", "interview"]),
});

export const speakingTextSchema = z
  .strictObject({
    clientAttemptId: z.uuid(),
    text: z.string().min(1).max(SPEAKING_TRANSCRIPT_MAX),
  })
  .refine((value) => !value.text.includes("\0"), "A speaking answer cannot contain a null byte.");

export const speakingAbandonSchema = z.strictObject({});

export type SpeakingStartInput = z.infer<typeof speakingStartSchema>;
export type SpeakingTextInput = z.infer<typeof speakingTextSchema>;
