import { BadRequestException } from "@nestjs/common";
import type { ZodType } from "zod";

export function parseRequestBody(schema: ZodType, value: unknown): unknown {
  const parsed = schema.safeParse(value);
  if (parsed.success) {
    return parsed.data;
  }

  throw new BadRequestException({
    code: "VALIDATION",
    message: "Request validation failed.",
    details: {
      issues: parsed.error.issues.map((issue) => ({
        path: issue.path.map((part) => String(part)).join("."),
        message: issue.message,
      })),
    },
  });
}
