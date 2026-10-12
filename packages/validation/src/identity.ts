import { z } from "zod";
import { COMMON_PASSWORDS } from "./common-passwords";

const localeValues = ["az-AZ", "en", "tr", "ru"] as const;

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export const emailSchema = z.string().trim().toLowerCase().max(254).email("Email is invalid.");

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`)
  .refine((value) => !COMMON_PASSWORDS.has(value.toLowerCase()), {
    message: "Password is too common.",
  });

export const registrationSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const localeSchema = z.enum(localeValues);

export function isIanaTimeZone(value: string): boolean {
  if (value.length === 0 || value.length > 100) {
    return false;
  }
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(isIanaTimeZone, { message: "Timezone is not a valid IANA name." });

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Name is required.")
  .max(80, "Name must be at most 80 characters.");

export const registerRequestSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  name: nameSchema,
  locale: localeSchema.optional(),
  timezone: timezoneSchema.optional(),
});

export const loginRequestSchema = z.strictObject({
  email: emailSchema,
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export const verifyEmailRequestSchema = z.strictObject({
  token: z.string().trim().min(1, "Token is required.").max(200),
});

export const passwordResetRequestSchema = z.strictObject({
  email: emailSchema,
});

export const passwordResetConfirmSchema = z.strictObject({
  token: z.string().trim().min(1, "Token is required.").max(200),
  password: passwordSchema,
});

export type RegistrationInput = z.infer<typeof registrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterRequestInput = z.infer<typeof registerRequestSchema>;
