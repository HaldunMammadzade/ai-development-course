import { PrismaPg } from "@prisma/adapter-pg";
import {
  EmailAlreadyExistsError,
  OnboardingUnavailableError,
  type CreateUserInput,
  type IdentityRecord,
  type IdentityRepository,
  type InsertSessionInput,
  type InsertTokenInput,
  type LearningCatalogSource,
  type NextActionContext,
  type OnboardingCounts,
  type RegisterStudentInput,
  type AuthRateConsumption,
  type ConsumeAuthRateInput,
  type ResetPasswordInput,
  type StoredPreferences,
  type StoredSession,
  type StoredToken,
  type StudentAccount,
  type TokenConsumeResult,
  type UpdateSessionActivityInput,
  type UserStatus,
} from "./identity";
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { readAchievementFacts } from "./achievements";
import {
  ensureStudentOnboarding,
  readLearningCatalogSource,
  readNextActionContext,
  readOnboardingCounts,
  readStudentAccount,
  toPrismaLocale,
} from "./student-onboarding";

type SessionRow = Prisma.SessionGetPayload<{
  include: { user: { select: { status: true } } };
}>;

export function createIdentityRepository(databaseUrl: string): IdentityRepository {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  return new PrismaIdentityRepository(prisma);
}

class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createUser(input: CreateUserInput): Promise<IdentityRecord> {
    try {
      const user = await this.prisma.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          studentPreferences: {
            create: {
              explanationStyle: "clear",
              challengeLevel: "adaptive",
            },
          },
        },
      });
      return toUser(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new EmailAlreadyExistsError();
      }
      throw error;
    }
  }

  async registerStudent(input: RegisterStudentInput): Promise<IdentityRecord> {
    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            email: input.email,
            passwordHash: input.passwordHash,
            name: input.name,
            locale: toPrismaLocale(input.locale),
            timezone: input.timezone,
          },
        });
        await ensureStudentOnboarding(tx, created.id, input.now);
        await tx.emailVerificationToken.create({
          data: {
            userId: created.id,
            tokenHash: input.verificationTokenHash,
            expiresAt: input.verificationExpiresAt,
          },
        });
        return created;
      });
      return toUser(user);
    } catch (error) {
      if (error instanceof OnboardingUnavailableError) {
        throw error;
      }
      if (error instanceof EmailAlreadyExistsError || isUniqueViolation(error)) {
        throw new EmailAlreadyExistsError();
      }
      throw error;
    }
  }

  async ensureStudentOnboarding(userId: string, now: Date): Promise<void> {
    await this.prisma.$transaction((tx) => ensureStudentOnboarding(tx, userId, now));
  }

  async findUserByEmail(email: string): Promise<IdentityRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    return user === null ? null : toUser(user);
  }

  async findUserById(id: string): Promise<IdentityRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    return user === null ? null : toUser(user);
  }

  async accountRole(userId: string): Promise<"user" | "admin"> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === "admin" ? "admin" : "user";
  }

  async findStudentAccount(userId: string): Promise<StudentAccount | null> {
    return readStudentAccount(this.prisma, userId);
  }

  async loadNextActionContext(userId: string): Promise<NextActionContext> {
    return readNextActionContext(this.prisma, userId);
  }

  async loadLearningCatalog(userId: string): Promise<LearningCatalogSource> {
    return readLearningCatalogSource(this.prisma, userId);
  }

  async loadAchievementFacts(userId: string) {
    return readAchievementFacts(this.prisma, userId);
  }

  async countOnboarding(userId: string): Promise<OnboardingCounts> {
    return readOnboardingCounts(this.prisma, userId);
  }

  async updateUserStatus(userId: string, status: UserStatus): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { status } });
  }

  async deleteUsersByEmailPrefix(prefix: string): Promise<void> {
    await this.prisma.user.deleteMany({ where: { email: { startsWith: prefix } } });
  }

  async findPreferences(userId: string): Promise<StoredPreferences | null> {
    const preferences = await this.prisma.studentPreferences.findUnique({ where: { userId } });
    if (preferences === null) {
      return null;
    }
    return {
      userId: preferences.userId,
      explanationStyle: preferences.explanationStyle,
      challengeLevel: preferences.challengeLevel,
    };
  }

  async insertSession(input: InsertSessionInput): Promise<StoredSession> {
    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        createdAt: input.createdAt,
        lastUsedAt: input.createdAt,
      },
      include: { user: { select: { status: true } } },
    });
    return toSession(session);
  }

  async findSessionByTokenHash(tokenHash: string): Promise<StoredSession | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash },
      include: { user: { select: { status: true } } },
    });
    return session === null ? null : toSession(session);
  }

  async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt },
    });
  }

  async revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    await this.prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt },
    });
  }

  async updateSessionActivity(input: UpdateSessionActivityInput): Promise<StoredSession> {
    const session = await this.prisma.session.update({
      where: { id: input.sessionId },
      data: {
        lastUsedAt: input.lastUsedAt,
        expiresAt: input.expiresAt,
      },
      include: { user: { select: { status: true } } },
    });
    return toSession(session);
  }

  async insertEmailVerificationToken(input: InsertTokenInput): Promise<StoredToken> {
    return this.prisma.emailVerificationToken.create({ data: input });
  }

  async emailVerificationTokenHashes(userId: string): Promise<string[]> {
    const rows = await this.prisma.emailVerificationToken.findMany({
      where: { userId },
      select: { tokenHash: true },
    });
    return rows.map((row) => row.tokenHash);
  }

  async consumeEmailVerificationToken(tokenHash: string, now: Date): Promise<TokenConsumeResult> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.emailVerificationToken.findUnique({ where: { tokenHash } });
      const decision = tokenDecision(token, now);
      if (token === null || decision.status !== "consumed") {
        return decision;
      }
      const consumed = await tx.emailVerificationToken.updateMany({
        where: { id: token.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        return { status: "used" };
      }
      await tx.user.update({
        where: { id: token.userId },
        data: { emailVerifiedAt: now },
      });
      return { status: "consumed", userId: token.userId };
    });
  }

  async insertPasswordResetToken(input: InsertTokenInput): Promise<StoredToken> {
    return this.prisma.passwordResetToken.create({ data: input });
  }

  async resetPassword(input: ResetPasswordInput): Promise<TokenConsumeResult> {
    return this.prisma.$transaction(async (tx) => {
      const token = await tx.passwordResetToken.findUnique({
        where: { tokenHash: input.tokenHash },
      });
      const decision = tokenDecision(token, input.now);
      if (token === null || decision.status !== "consumed") {
        return decision;
      }
      const consumed = await tx.passwordResetToken.updateMany({
        where: { id: token.id, consumedAt: null, expiresAt: { gt: input.now } },
        data: { consumedAt: input.now },
      });
      if (consumed.count !== 1) {
        return { status: "used" };
      }
      await tx.user.update({
        where: { id: token.userId },
        data: { passwordHash: input.passwordHash },
      });
      await tx.session.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: input.now },
      });
      return { status: "consumed", userId: token.userId };
    });
  }

  async consumeAuthRate(input: ConsumeAuthRateInput): Promise<AuthRateConsumption> {
    const row = await this.prisma.authRateBucket.upsert({
      where: {
        action_subjectHash_windowStart: {
          action: input.action,
          subjectHash: input.subjectHash,
          windowStart: input.windowStart,
        },
      },
      create: {
        action: input.action,
        subjectHash: input.subjectHash,
        windowStart: input.windowStart,
        hits: 1,
      },
      update: { hits: { increment: 1 } },
    });
    return { hits: row.hits, allowed: row.hits <= input.limit };
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

function toUser(user: {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  locale: string;
  timezone: string;
  emailVerifiedAt: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): IdentityRecord {
  return {
    id: user.id,
    email: user.email,
    passwordHash: user.passwordHash,
    name: user.name,
    locale: toLocale(user.locale),
    timezone: user.timezone,
    emailVerifiedAt: user.emailVerifiedAt,
    status: toStatus(user.status),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toLocale(locale: string): IdentityRecord["locale"] {
  if (locale === "az_AZ" || locale === "az-AZ") {
    return "az-AZ";
  }
  if (locale === "en" || locale === "tr" || locale === "ru") {
    return locale;
  }
  throw new Error("Unexpected locale.");
}

function toSession(session: SessionRow): StoredSession {
  return {
    id: session.id,
    userId: session.userId,
    tokenHash: session.tokenHash,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    lastUsedAt: session.lastUsedAt,
    revokedAt: session.revokedAt,
    userStatus: toStatus(session.user.status),
  };
}

function toStatus(status: string): UserStatus {
  if (status === "active" || status === "disabled") {
    return status;
  }
  throw new Error("Unexpected user status.");
}

function tokenDecision(
  token: { consumedAt: Date | null; expiresAt: Date; userId: string } | null,
  now: Date,
): TokenConsumeResult {
  if (token === null) {
    return { status: "missing" };
  }
  if (token.consumedAt !== null) {
    return { status: "used" };
  }
  if (token.expiresAt.getTime() <= now.getTime()) {
    return { status: "expired" };
  }
  return { status: "consumed", userId: token.userId };
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
