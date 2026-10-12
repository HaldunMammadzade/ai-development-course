import { emailSchema, nameSchema, passwordSchema } from "@platform/validation";
import { copy } from "@/lib/copy";

export interface RegistrationFields {
  name: string;
  email: string;
  password: string;
}

export interface RegistrationIssues {
  name?: string;
  email?: string;
  password?: string;
}

export function registrationIssues(input: RegistrationFields): RegistrationIssues {
  const issues: RegistrationIssues = {};
  const name = nameSchema.safeParse(input.name);
  if (!name.success) {
    issues.name = input.name.trim().length === 0 ? copy.errors.name : copy.errors.nameLong;
  }
  const email = emailSchema.safeParse(input.email);
  if (!email.success) {
    issues.email = copy.errors.email;
  }
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) {
    const message = password.error.issues[0]?.message ?? "";
    if (message.includes("too common")) {
      issues.password = copy.errors.passwordCommon;
    } else if (input.password.length > 128) {
      issues.password = copy.errors.passwordLong;
    } else {
      issues.password = copy.errors.passwordShort;
    }
  }
  return issues;
}

export function hasRegistrationIssues(issues: RegistrationIssues): boolean {
  return issues.name !== undefined || issues.email !== undefined || issues.password !== undefined;
}
