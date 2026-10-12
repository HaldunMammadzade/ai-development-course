import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { SESSION_COOKIE_NAME } from "@platform/config";
import {
  AUTH_RATE_LIMITS,
  authRateWindowStart,
  getNextAction,
  type AuthRateAction,
} from "@platform/curriculum";
import {
  EmailAlreadyExistsError,
  OnboardingUnavailableError,
  type IdentityRepository,
} from "@platform/database";
import type { CurrentUser, RegisteredStudent, SignedInStudent } from "@platform/types";
import type { Response } from "express";
import { IDENTITY_REPOSITORY } from "../identity/identity.repository";
import {
  IdentityService,
  InvalidEmailError,
  PasswordRejectedError,
  RegistrationRejectedError,
} from "../identity/identity.service";
import { SessionService, type SessionCookie } from "../identity/session.service";
import { readCookie } from "./cookies";
import { EmailService } from "../ops/email.service";

const INVALID_CREDENTIALS = {
  code: "UNAUTHENTICATED",
  message: "Email or password is incorrect.",
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(IdentityService) private readonly identity: IdentityService,
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(IDENTITY_REPOSITORY) private readonly repository: IdentityRepository,
    @Inject(EmailService) private readonly mail: EmailService,
  ) {}

  async register(
    input: {
      email: string;
      password: string;
      name: string;
      locale?: RegisteredStudent["locale"];
      timezone?: string;
    },
    clientIp: string,
    correlationId: string | null,
  ): Promise<{ body: RegisteredStudent; verificationToken: string }> {
    await this.enforceAuthRate("register", clientIp, input.email);
    try {
      const result = await this.identity.registerStudent(input);
      await this.enqueueQuietly(() =>
        this.mail.queueVerification({
          to: result.user.email,
          token: result.verificationToken,
          correlationId,
        }),
      );
      return {
        verificationToken: result.verificationToken,
        body: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          locale: result.user.locale,
          timezone: result.user.timezone,
          emailVerified: false,
        },
      };
    } catch (error) {
      if (error instanceof EmailAlreadyExistsError) {
        throw new ConflictException({
          code: "CONFLICT",
          message: "An account with this email already exists.",
        });
      }
      if (error instanceof OnboardingUnavailableError) {
        throw new ServiceUnavailableException({
          code: "ONBOARDING_UNAVAILABLE",
          message: "Registration is temporarily unavailable.",
        });
      }
      if (
        error instanceof PasswordRejectedError ||
        error instanceof InvalidEmailError ||
        error instanceof RegistrationRejectedError
      ) {
        throw new BadRequestException({
          code: "VALIDATION",
          message: error.message,
        });
      }
      throw error;
    }
  }

  async verifyEmail(token: string): Promise<{ emailVerified: true }> {
    const result = await this.identity.consumeEmailVerification(token);
    if (result.status !== "consumed") {
      throw new BadRequestException({
        code: verificationCode(result.status),
        message: "This verification link is not valid.",
      });
    }
    return { emailVerified: true };
  }

  async login(
    input: { email: string; password: string },
    cookieHeader: string | undefined,
    clientIp: string,
  ): Promise<{ body: SignedInStudent; cookie: SessionCookie }> {
    await this.enforceAuthRate("login", clientIp, input.email);
    const result = await this.identity.authenticate(input.email, input.password);
    if (result.status === "invalid") {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    if (result.status === "unverified") {
      throw new ForbiddenException({
        code: "EMAIL_UNVERIFIED",
        message: "Verify your email before signing in.",
      });
    }

    const presented = readCookie(cookieHeader, SESSION_COOKIE_NAME);
    if (presented !== null) {
      await this.sessions.revokeByToken(presented);
    }
    const created = await this.sessions.createSession(result.user.id);
    return {
      cookie: created.cookie,
      body: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        locale: result.user.locale,
        timezone: result.user.timezone,
        emailVerified: true,
      },
    };
  }

  async logout(cookieHeader: string | undefined): Promise<SessionCookie> {
    const presented = readCookie(cookieHeader, SESSION_COOKIE_NAME);
    if (presented !== null) {
      await this.sessions.revokeByToken(presented);
    }
    return this.sessions.blankCookie();
  }

  async requestPasswordReset(
    email: string,
    clientIp: string,
    correlationId: string | null,
  ): Promise<string | null> {
    await this.enforceAuthRate("password_reset", clientIp, email);
    try {
      const token = await this.identity.requestPasswordReset(email);
      if (token !== null) {
        await this.enqueueQuietly(() =>
          this.mail.queuePasswordReset({ to: email, token, correlationId }),
        );
      }
      return token;
    } catch (error) {
      if (error instanceof InvalidEmailError) {
        throw new BadRequestException({
          code: "VALIDATION",
          message: "Email is invalid.",
        });
      }
      throw error;
    }
  }

  async confirmPasswordReset(token: string, password: string): Promise<{ passwordUpdated: true }> {
    try {
      const result = await this.identity.resetPassword(token, password);
      if (result.status !== "consumed") {
        throw new BadRequestException({
          code: resetCode(result.status),
          message: "This reset link is not valid.",
        });
      }
      return { passwordUpdated: true };
    } catch (error) {
      if (error instanceof PasswordRejectedError) {
        throw new BadRequestException({
          code: "VALIDATION",
          message: error.message,
        });
      }
      throw error;
    }
  }

  async profile(userId: string, now = new Date()): Promise<CurrentUser> {
    const account = await this.repository.findStudentAccount(userId);
    if (account === null || account.user.status !== "active") {
      throw new UnauthorizedException({
        code: "UNAUTHENTICATED",
        message: "Sign in to continue.",
      });
    }
    const context = await this.repository.loadNextActionContext(userId);
    const nextAction = getNextAction({
      now,
      timeZone: context.timeZone,
      homework: context.homework,
      sessions: context.sessions,
      lessons: context.lessons,
      prerequisites: context.prerequisites,
      masteryByConcept: new Map(
        context.mastery.map((row) => [
          row.conceptSlug,
          { score: row.score, evidenceCount: row.evidenceCount },
        ]),
      ),
    });

    return {
      id: account.user.id,
      email: account.user.email,
      name: account.user.name,
      locale: account.user.locale,
      timezone: account.user.timezone,
      emailVerified: account.user.emailVerifiedAt !== null,
      role: await this.repository.accountRole(userId),
      preferences:
        account.preferences === null
          ? null
          : {
              explanationStyle: account.preferences.explanationStyle,
              challengeLevel: account.preferences.challengeLevel,
            },
      plan:
        account.plan === null
          ? null
          : {
              code: account.plan.code,
              dailyTeacherTurns: account.plan.dailyTeacherTurns,
              monthlyTeacherTurns: account.plan.monthlyTeacherTurns,
            },
      enrollment: account.enrollment,
      nextAction,
    };
  }

  writeCookie(response: Response, cookie: SessionCookie): void {
    response.cookie(cookie.name, cookie.value, cookie.options);
  }

  private async enqueueQuietly(action: () => Promise<unknown>): Promise<void> {
    try {
      await action();
    } catch {
      this.logger.warn(
        JSON.stringify({ event: "email_enqueue_failed", code: "EMAIL_UNAVAILABLE" }),
      );
    }
  }

  private async enforceAuthRate(
    action: AuthRateAction,
    clientIp: string,
    account: string,
  ): Promise<void> {
    const limits = AUTH_RATE_LIMITS[action];
    const windowStart = authRateWindowStart(new Date(), limits.windowMs);
    const subjects = [
      { kind: "ip", value: clientIp, limit: limits.ip },
      { kind: "account", value: account.trim().toLowerCase(), limit: limits.account },
    ] as const;
    let allowed = true;
    for (const subject of subjects) {
      const result = await this.repository.consumeAuthRate({
        action,
        subjectHash: createHash("sha256")
          .update(`${action}:${subject.kind}:${subject.value}`)
          .digest("hex"),
        windowStart,
        limit: subject.limit,
      });
      if (!result.allowed) {
        allowed = false;
      }
    }
    if (!allowed) {
      throw new HttpException(
        { code: "RATE_LIMITED", message: "Too many attempts. Try again later." },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}

function verificationCode(status: "missing" | "expired" | "used"): string {
  if (status === "expired") {
    return "VERIFICATION_EXPIRED";
  }
  if (status === "used") {
    return "VERIFICATION_USED";
  }
  return "VERIFICATION_INVALID";
}

function resetCode(status: "missing" | "expired" | "used"): string {
  if (status === "expired") {
    return "PASSWORD_RESET_EXPIRED";
  }
  if (status === "used") {
    return "PASSWORD_RESET_USED";
  }
  return "PASSWORD_RESET_INVALID";
}
