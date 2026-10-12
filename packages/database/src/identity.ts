import type { AchievementFacts } from "@platform/curriculum";
import type { TeachingState } from "@platform/types";

export type UserStatus = "active" | "disabled";

export type AccountRole = "user" | "admin";

export type Locale = "az-AZ" | "en" | "tr" | "ru";

export type ExplanationStyle = "clear" | "step_by_step" | "example_first" | "analogy" | "concise";

export type ChallengeLevel = "adaptive" | "gentle" | "standard" | "demanding";

export interface IdentityRecord {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
  locale: Locale;
  timezone: string;
  emailVerifiedAt: Date | null;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUserInput {
  email: string;
  passwordHash: string;
}

export interface StoredSession {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  lastUsedAt: Date;
  revokedAt: Date | null;
  userStatus: UserStatus;
}

export interface InsertSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface UpdateSessionActivityInput {
  sessionId: string;
  lastUsedAt: Date;
  expiresAt: Date;
}

export interface StoredPreferences {
  userId: string;
  explanationStyle: ExplanationStyle;
  challengeLevel: ChallengeLevel;
}

export interface StoredToken {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
  consumedAt: Date | null;
}

export interface InsertTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export type TokenConsumeResult =
  | { status: "consumed"; userId: string }
  | { status: "missing" }
  | { status: "expired" }
  | { status: "used" };

export interface ResetPasswordInput {
  tokenHash: string;
  passwordHash: string;
  now: Date;
}

export interface RegisterStudentInput {
  email: string;
  passwordHash: string;
  name: string;
  locale: Locale;
  timezone: string;
  verificationTokenHash: string;
  verificationExpiresAt: Date;
  now: Date;
}

export interface StoredPlanAssignment {
  code: "free" | "starter" | "pro" | "premium";
  dailyTeacherTurns: number;
  monthlyTeacherTurns: number;
  status: string;
}

export interface StoredEnrollment {
  pathSlug: string;
  pathTitle: string;
  status: "active" | "paused" | "completed";
}

export interface StudentAccount {
  user: IdentityRecord;
  preferences: StoredPreferences | null;
  plan: StoredPlanAssignment | null;
  enrollment: StoredEnrollment | null;
}

export interface OnboardingCounts {
  plans: number;
  activeEnrollments: number;
  enrollments: number;
  preferences: number;
  pathSlugs: string[];
}

export interface NextActionContext {
  timeZone: string;
  homework: Array<{
    id: string;
    lessonId: string;
    title: string;
    status: "assigned" | "done" | "skipped";
    dueAt: Date;
  }>;
  sessions: Array<{
    id: string;
    lessonId: string;
    title: string;
    state: TeachingState;
    endedAt: Date | null;
    lastActivityAt: Date;
  }>;
  lessons: Array<{
    id: string;
    slug: string;
    title: string;
    modulePosition: number;
    lessonPosition: number;
    status: "draft" | "published";
    primaryConceptSlugs: string[];
    supportingConceptSlugs: string[];
    progress: "not_started" | "in_progress" | "completed" | null;
  }>;
  prerequisites: Array<{ conceptSlug: string; prerequisiteSlug: string }>;
  mastery: Array<{
    conceptSlug: string;
    score: number;
    evidenceCount: number;
    lastEvidenceAt?: Date | null;
  }>;
}

export interface LearningCatalogSource {
  path: {
    slug: string;
    title: string;
    description: string;
    status: "draft" | "published";
  } | null;
  modules: Array<{
    slug: string;
    title: string;
    description: string;
    position: number;
    lessons: Array<{
      id: string;
      slug: string;
      title: string;
      objective: string;
      estimatedMinutes: number;
      position: number;
      status: "draft" | "published";
      primaryConceptSlugs: string[];
      supportingConceptSlugs: string[];
    }>;
  }>;
  concepts: Array<{ slug: string; name: string; summary?: string }>;
  context: NextActionContext;
  evidence?: Array<{
    conceptSlug: string;
    source:
      | "lesson_check"
      | "exercise"
      | "quiz"
      | "code_review"
      | "interview"
      | "homework"
      | "project"
      | "speaking";
  }>;
  revisionSuccesses?: Array<{
    conceptSlug: string;
    successCount: number;
    lastSuccessAt: Date;
  }>;
  revisionExercises?: Array<{
    slug: string;
    position: number;
    conceptSlug: string;
    lessonSlug: string;
    modulePosition: number;
    lessonPosition: number;
  }>;
  activity?: Array<{
    id: string;
    source:
      | "lesson_check"
      | "exercise"
      | "quiz"
      | "code_review"
      | "interview"
      | "homework"
      | "project"
      | "speaking";
    conceptName: string;
    createdAt: Date;
  }>;
}

export type AuthRateAction = "register" | "login" | "password_reset";

export interface ConsumeAuthRateInput {
  action: AuthRateAction;
  subjectHash: string;
  windowStart: Date;
  limit: number;
}

export interface AuthRateConsumption {
  hits: number;
  allowed: boolean;
}

export interface IdentityRepository {
  createUser(input: CreateUserInput): Promise<IdentityRecord>;
  registerStudent(input: RegisterStudentInput): Promise<IdentityRecord>;
  ensureStudentOnboarding(userId: string, now: Date): Promise<void>;
  findUserByEmail(email: string): Promise<IdentityRecord | null>;
  findUserById(id: string): Promise<IdentityRecord | null>;
  accountRole(userId: string): Promise<AccountRole>;
  findPreferences(userId: string): Promise<StoredPreferences | null>;
  findStudentAccount(userId: string): Promise<StudentAccount | null>;
  loadNextActionContext(userId: string): Promise<NextActionContext>;
  loadLearningCatalog(userId: string): Promise<LearningCatalogSource>;
  loadAchievementFacts(userId: string): Promise<AchievementFacts>;
  countOnboarding(userId: string): Promise<OnboardingCounts>;
  updateUserStatus(userId: string, status: UserStatus): Promise<void>;
  deleteUsersByEmailPrefix(prefix: string): Promise<void>;
  insertSession(input: InsertSessionInput): Promise<StoredSession>;
  findSessionByTokenHash(tokenHash: string): Promise<StoredSession | null>;
  revokeSession(sessionId: string, revokedAt: Date): Promise<void>;
  revokeSessionByTokenHash(tokenHash: string, revokedAt: Date): Promise<void>;
  updateSessionActivity(input: UpdateSessionActivityInput): Promise<StoredSession>;
  insertEmailVerificationToken(input: InsertTokenInput): Promise<StoredToken>;
  emailVerificationTokenHashes(userId: string): Promise<string[]>;
  consumeEmailVerificationToken(tokenHash: string, now: Date): Promise<TokenConsumeResult>;
  insertPasswordResetToken(input: InsertTokenInput): Promise<StoredToken>;
  resetPassword(input: ResetPasswordInput): Promise<TokenConsumeResult>;
  consumeAuthRate(input: ConsumeAuthRateInput): Promise<AuthRateConsumption>;
  disconnect(): Promise<void>;
}

export class EmailAlreadyExistsError extends Error {
  constructor() {
    super("An account with this email already exists.");
    this.name = "EmailAlreadyExistsError";
  }
}

export class OnboardingUnavailableError extends Error {
  constructor() {
    super("Student onboarding is unavailable.");
    this.name = "OnboardingUnavailableError";
  }
}
