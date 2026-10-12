import { Inject, Injectable } from "@nestjs/common";
import {
  DEFAULT_LOCALE,
  DEFAULT_TIMEZONE,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from "@platform/config";
import {
  type IdentityRecord,
  type IdentityRepository,
  type Locale,
  type UserStatus,
} from "@platform/database";
import {
  emailSchema,
  loginSchema,
  passwordSchema,
  registerRequestSchema,
  registrationSchema,
} from "@platform/validation";
import { IDENTITY_REPOSITORY } from "./identity.repository";
import { PasswordService } from "./password.service";
import { createOpaqueToken, hashOpaqueToken } from "./opaque-token";

export interface PublicIdentity {
  id: string;
  email: string;
  name: string | null;
  locale: Locale;
  timezone: string;
  emailVerifiedAt: Date | null;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type AuthenticationResult =
  | { status: "invalid" }
  | { status: "unverified"; user: PublicIdentity }
  | { status: "ok"; user: PublicIdentity };

export class PasswordRejectedError extends Error {
  constructor() {
    super("Password does not meet the password policy.");
    this.name = "PasswordRejectedError";
  }
}

export class InvalidEmailError extends Error {
  constructor() {
    super("Email is invalid.");
    this.name = "InvalidEmailError";
  }
}

export class RegistrationRejectedError extends Error {
  constructor() {
    super("Registration request is invalid.");
    this.name = "RegistrationRejectedError";
  }
}

@Injectable()
export class IdentityService {
  private dummyPasswordHash: Promise<string> | null = null;

  constructor(
    @Inject(IDENTITY_REPOSITORY) private readonly repository: IdentityRepository,
    @Inject(PasswordService) private readonly passwords: PasswordService,
  ) {}

  async createUser(input: { email: string; password: string }): Promise<PublicIdentity> {
    const parsed = registrationSchema.safeParse(input);
    if (!parsed.success) {
      const passwordRejected = parsed.error.issues.some((issue) => issue.path[0] === "password");
      if (passwordRejected) {
        throw new PasswordRejectedError();
      }
      throw new InvalidEmailError();
    }

    const passwordHash = await this.passwords.hash(parsed.data.password);
    const user = await this.repository.createUser({
      email: parsed.data.email,
      passwordHash,
    });
    return toPublic(user);
  }

  async registerStudent(
    input: {
      email: string;
      password: string;
      name: string;
      locale?: Locale;
      timezone?: string;
    },
    now = new Date(),
  ): Promise<{ user: PublicIdentity; verificationToken: string }> {
    const parsed = registerRequestSchema.safeParse(input);
    if (!parsed.success) {
      const passwordRejected = parsed.error.issues.some((issue) => issue.path[0] === "password");
      if (passwordRejected) {
        throw new PasswordRejectedError();
      }
      const emailInvalid = parsed.error.issues.some((issue) => issue.path[0] === "email");
      if (emailInvalid) {
        throw new InvalidEmailError();
      }
      throw new RegistrationRejectedError();
    }

    const passwordHash = await this.passwords.hash(parsed.data.password);
    const verificationToken = createOpaqueToken();
    const user = await this.repository.registerStudent({
      email: parsed.data.email,
      passwordHash,
      name: parsed.data.name,
      locale: parsed.data.locale ?? DEFAULT_LOCALE,
      timezone: parsed.data.timezone ?? DEFAULT_TIMEZONE,
      verificationTokenHash: hashOpaqueToken(verificationToken),
      verificationExpiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
      now,
    });
    return { user: toPublic(user), verificationToken };
  }

  async findById(id: string): Promise<PublicIdentity | null> {
    const user = await this.repository.findUserById(id);
    return user === null ? null : toPublic(user);
  }

  async findByEmail(email: string): Promise<PublicIdentity | null> {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      return null;
    }
    const user = await this.repository.findUserByEmail(parsed.data);
    return user === null ? null : toPublic(user);
  }

  async verifyCredentials(email: string, password: string): Promise<PublicIdentity | null> {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      await this.passwords.verify(await this.dummyHash(), password);
      return null;
    }

    const user = await this.repository.findUserByEmail(parsed.data.email);
    if (user === null || user.status !== "active") {
      await this.passwords.verify(await this.dummyHash(), password);
      return null;
    }

    const matches = await this.passwords.verify(user.passwordHash, parsed.data.password);
    return matches ? toPublic(user) : null;
  }

  async authenticate(email: string, password: string): Promise<AuthenticationResult> {
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      await this.passwords.verify(await this.dummyHash(), password);
      return { status: "invalid" };
    }

    const user = await this.repository.findUserByEmail(parsed.data.email);
    if (user === null || user.status !== "active") {
      await this.passwords.verify(await this.dummyHash(), password);
      return { status: "invalid" };
    }

    const matches = await this.passwords.verify(user.passwordHash, parsed.data.password);
    if (!matches) {
      return { status: "invalid" };
    }
    if (user.emailVerifiedAt === null) {
      return { status: "unverified", user: toPublic(user) };
    }
    return { status: "ok", user: toPublic(user) };
  }

  async issueEmailVerification(userId: string, now = new Date()): Promise<string> {
    const token = createOpaqueToken();
    await this.repository.insertEmailVerificationToken({
      userId,
      tokenHash: hashOpaqueToken(token),
      expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_TTL_MS),
    });
    return token;
  }

  async consumeEmailVerification(token: string, now = new Date()) {
    return this.repository.consumeEmailVerificationToken(hashOpaqueToken(token), now);
  }

  async requestPasswordReset(email: string, now = new Date()): Promise<string | null> {
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      throw new InvalidEmailError();
    }
    const user = await this.repository.findUserByEmail(parsed.data);
    if (user === null || user.status !== "active") {
      createOpaqueToken();
      return null;
    }
    return this.issuePasswordReset(user.id, now);
  }

  async issuePasswordReset(userId: string, now = new Date()): Promise<string> {
    const token = createOpaqueToken();
    await this.repository.insertPasswordResetToken({
      userId,
      tokenHash: hashOpaqueToken(token),
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
    });
    return token;
  }

  async resetPassword(token: string, password: string, now = new Date()) {
    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) {
      throw new PasswordRejectedError();
    }
    const passwordHash = await this.passwords.hash(parsed.data);
    return this.repository.resetPassword({
      tokenHash: hashOpaqueToken(token),
      passwordHash,
      now,
    });
  }

  private dummyHash(): Promise<string> {
    this.dummyPasswordHash ??= this.passwords.hash("identity-timing-placeholder");
    return this.dummyPasswordHash;
  }
}

function toPublic(user: IdentityRecord): PublicIdentity {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    timezone: user.timezone,
    emailVerifiedAt: user.emailVerifiedAt,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
