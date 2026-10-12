import { randomUUID } from "node:crypto";
import {
  EmailAlreadyExistsError,
  type AuthRateConsumption,
  type ConsumeAuthRateInput,
  type CreateUserInput,
  type IdentityRecord,
  type IdentityRepository,
  type InsertSessionInput,
  type InsertTokenInput,
  type LearningCatalogSource,
  type NextActionContext,
  type OnboardingCounts,
  type RegisterStudentInput,
  type ResetPasswordInput,
  type StoredEnrollment,
  type StoredPlanAssignment,
  type StoredPreferences,
  type StoredSession,
  type StoredToken,
  type StudentAccount,
  type TokenConsumeResult,
  type UpdateSessionActivityInput,
  type UserStatus,
} from "@platform/database";

export class MemoryIdentityRepository implements IdentityRepository {
  private readonly users = new Map<string, IdentityRecord>();
  private readonly sessions = new Map<string, StoredSession>();
  private readonly preferences = new Map<string, StoredPreferences>();
  private readonly emailVerifications = new Map<string, StoredToken>();
  private readonly passwordResets = new Map<string, StoredToken>();
  private readonly plans = new Map<string, StoredPlanAssignment>();
  private readonly enrollments = new Map<string, StoredEnrollment>();
  private readonly authRates = new Map<string, number>();

  async createUser(input: CreateUserInput): Promise<IdentityRecord> {
    for (const existing of this.users.values()) {
      if (existing.email === input.email) {
        throw new EmailAlreadyExistsError();
      }
    }

    const now = new Date();
    const user: IdentityRecord = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      name: null,
      locale: "az-AZ",
      timezone: "UTC",
      emailVerifiedAt: null,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    this.preferences.set(user.id, {
      userId: user.id,
      explanationStyle: "clear",
      challengeLevel: "adaptive",
    });
    return user;
  }

  async findUserByEmail(email: string): Promise<IdentityRecord | null> {
    for (const user of this.users.values()) {
      if (user.email === email) {
        return user;
      }
    }
    return null;
  }

  async findUserById(id: string): Promise<IdentityRecord | null> {
    return this.users.get(id) ?? null;
  }

  async findPreferences(userId: string): Promise<StoredPreferences | null> {
    return this.preferences.get(userId) ?? null;
  }

  async insertSession(input: InsertSessionInput): Promise<StoredSession> {
    const user = this.users.get(input.userId);
    if (user === undefined) {
      throw new Error("Cannot create a session for an unknown user.");
    }
    const session: StoredSession = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: input.createdAt,
      lastUsedAt: input.createdAt,
      revokedAt: null,
      userStatus: user.status,
    };
    this.sessions.set(session.id, session);
    return session;
  }

  async findSessionByTokenHash(tokenHash: string): Promise<StoredSession | null> {
    for (const session of this.sessions.values()) {
      if (session.tokenHash === tokenHash) {
        const user = this.users.get(session.userId);
        return user === undefined ? session : { ...session, userStatus: user.status };
      }
    }
    return null;
  }

  async revokeSession(sessionId: string, revokedAt: Date): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session === undefined) {
      return;
    }
    session.revokedAt = revokedAt;
  }

  async updateSessionActivity(input: UpdateSessionActivityInput): Promise<StoredSession> {
    const session = this.sessions.get(input.sessionId);
    if (session === undefined) {
      throw new Error("Session was not found.");
    }
    session.lastUsedAt = input.lastUsedAt;
    session.expiresAt = input.expiresAt;
    return session;
  }

  async insertEmailVerificationToken(input: InsertTokenInput): Promise<StoredToken> {
    return this.insertToken(this.emailVerifications, input);
  }

  async consumeEmailVerificationToken(tokenHash: string, now: Date): Promise<TokenConsumeResult> {
    const result = this.consumeToken(this.emailVerifications, tokenHash, now);
    if (result.status === "consumed") {
      const user = this.users.get(result.userId);
      if (user !== undefined) {
        user.emailVerifiedAt = now;
        user.updatedAt = now;
      }
    }
    return result;
  }

  async insertPasswordResetToken(input: InsertTokenInput): Promise<StoredToken> {
    return this.insertToken(this.passwordResets, input);
  }

  async resetPassword(input: ResetPasswordInput): Promise<TokenConsumeResult> {
    const result = this.consumeToken(this.passwordResets, input.tokenHash, input.now);
    if (result.status !== "consumed") {
      return result;
    }
    const user = this.users.get(result.userId);
    if (user !== undefined) {
      user.passwordHash = input.passwordHash;
      user.updatedAt = input.now;
    }
    for (const session of this.sessions.values()) {
      if (session.userId === result.userId && session.revokedAt === null) {
        session.revokedAt = input.now;
      }
    }
    return result;
  }

  async registerStudent(input: RegisterStudentInput): Promise<IdentityRecord> {
    this.assertEmailAvailable(input.email);
    const user: IdentityRecord = {
      id: randomUUID(),
      email: input.email,
      passwordHash: input.passwordHash,
      name: input.name,
      locale: input.locale,
      timezone: input.timezone,
      emailVerifiedAt: null,
      status: "active",
      createdAt: input.now,
      updatedAt: input.now,
    };
    this.users.set(user.id, user);
    await this.ensureStudentOnboarding(user.id, input.now);
    await this.insertEmailVerificationToken({
      userId: user.id,
      tokenHash: input.verificationTokenHash,
      expiresAt: input.verificationExpiresAt,
    });
    return user;
  }

  async ensureStudentOnboarding(userId: string, now: Date): Promise<void> {
    if (!this.users.has(userId)) {
      return;
    }
    if (!this.preferences.has(userId)) {
      this.preferences.set(userId, {
        userId,
        explanationStyle: "clear",
        challengeLevel: "adaptive",
      });
    }
    if (!this.plans.has(userId)) {
      this.plans.set(userId, {
        code: "free",
        dailyTeacherTurns: 40,
        monthlyTeacherTurns: 600,
        status: "active",
      });
    }
    if (!this.enrollments.has(userId)) {
      this.enrollments.set(userId, {
        pathSlug: "frontend",
        pathTitle: "Frontend",
        status: "active",
      });
    }
    void now;
  }

  async findStudentAccount(userId: string): Promise<StudentAccount | null> {
    const user = this.users.get(userId);
    if (user === undefined) {
      return null;
    }
    return {
      user,
      preferences: this.preferences.get(userId) ?? null,
      plan: this.plans.get(userId) ?? null,
      enrollment: this.enrollments.get(userId) ?? null,
    };
  }

  async loadNextActionContext(userId: string): Promise<NextActionContext> {
    const user = this.users.get(userId);
    return {
      timeZone: user?.timezone ?? "UTC",
      homework: [],
      sessions: [],
      lessons: [],
      prerequisites: [],
      mastery: [],
    };
  }

  async loadAchievementFacts() {
    return {
      modules: [],
      events: [],
      assessment: null,
      projects: [],
      passes: [],
      interviewPublished: false,
      interviewCompletedAt: null,
    };
  }

  async loadLearningCatalog(userId: string): Promise<LearningCatalogSource> {
    return {
      path: null,
      modules: [],
      concepts: [],
      context: await this.loadNextActionContext(userId),
    };
  }

  async countOnboarding(userId: string): Promise<OnboardingCounts> {
    const enrollment = this.enrollments.get(userId);
    return {
      plans: this.plans.has(userId) ? 1 : 0,
      activeEnrollments: enrollment?.status === "active" ? 1 : 0,
      enrollments: enrollment === undefined ? 0 : 1,
      preferences: this.preferences.has(userId) ? 1 : 0,
      pathSlugs: enrollment === undefined ? [] : [enrollment.pathSlug],
    };
  }

  async updateUserStatus(userId: string, status: UserStatus): Promise<void> {
    const user = this.users.get(userId);
    if (user !== undefined) {
      user.status = status;
    }
  }

  async deleteUsersByEmailPrefix(prefix: string): Promise<void> {
    for (const user of this.users.values()) {
      if (user.email.startsWith(prefix)) {
        this.users.delete(user.id);
        this.preferences.delete(user.id);
        this.plans.delete(user.id);
        this.enrollments.delete(user.id);
      }
    }
  }

  async revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void> {
    for (const session of this.sessions.values()) {
      if (session.tokenHash === tokenHash && session.revokedAt === null) {
        session.revokedAt = revokedAt;
      }
    }
  }

  async emailVerificationTokenHashes(userId: string): Promise<string[]> {
    return [...this.emailVerifications.values()]
      .filter((token) => token.userId === userId)
      .map((token) => token.tokenHash);
  }

  async accountRole(): Promise<"user" | "admin"> {
    return "user";
  }

  async consumeAuthRate(input: ConsumeAuthRateInput): Promise<AuthRateConsumption> {
    const key = `${input.action}:${input.subjectHash}:${input.windowStart.toISOString()}`;
    const hits = (this.authRates.get(key) ?? 0) + 1;
    this.authRates.set(key, hits);
    return { hits, allowed: hits <= input.limit };
  }

  async disconnect(): Promise<void> {
    return undefined;
  }

  disableUser(userId: string): void {
    const user = this.users.get(userId);
    if (user !== undefined) {
      user.status = "disabled";
    }
  }

  private assertEmailAvailable(email: string): void {
    for (const existing of this.users.values()) {
      if (existing.email === email) {
        throw new EmailAlreadyExistsError();
      }
    }
  }

  private insertToken(store: Map<string, StoredToken>, input: InsertTokenInput): StoredToken {
    const token: StoredToken = {
      id: randomUUID(),
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      createdAt: new Date(),
      consumedAt: null,
    };
    store.set(token.id, token);
    return token;
  }

  private consumeToken(
    store: Map<string, StoredToken>,
    tokenHash: string,
    now: Date,
  ): TokenConsumeResult {
    for (const token of store.values()) {
      if (token.tokenHash !== tokenHash) {
        continue;
      }
      if (token.consumedAt !== null) {
        return { status: "used" };
      }
      if (token.expiresAt.getTime() <= now.getTime()) {
        return { status: "expired" };
      }
      token.consumedAt = now;
      return { status: "consumed", userId: token.userId };
    }
    return { status: "missing" };
  }
}
