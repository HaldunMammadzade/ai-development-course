import { z } from "zod";

export const TEACHING_STUDENT_MESSAGE_MAX_CHARS = 2_000;

export const openTeachingSessionSchema = z.strictObject({
  mode: z.enum(["explain", "socratic"]).optional(),
});

export const teachingTurnSchema = z
  .strictObject({
    clientTurnId: z.uuid(),
    message: z.string().trim().min(1).max(TEACHING_STUDENT_MESSAGE_MAX_CHARS).optional(),
    advance: z.literal(true).optional(),
  })
  .superRefine((value, context) => {
    const hasMessage = value.message !== undefined;
    const hasAdvance = value.advance === true;
    if (hasMessage === hasAdvance) {
      context.addIssue({
        code: "custom",
        message: "Send either a student message or advance.",
        path: ["message"],
      });
    }
  });

export type OpenTeachingSessionInput = z.infer<typeof openTeachingSessionSchema>;
export type TeachingTurnInput = z.infer<typeof teachingTurnSchema>;
