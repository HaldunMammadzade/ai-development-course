import { z } from "zod";

const windowField = z.enum(["today", "7d", "30d"]);

export const adminWindowSchema = z.strictObject({
  window: windowField.default("7d"),
});

export const adminStudentListSchema = z.strictObject({
  q: z.string().trim().max(80).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.uuid().optional(),
});

export const adminStudentParamsSchema = z.strictObject({
  userId: z.uuid(),
});
