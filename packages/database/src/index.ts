import path from "node:path";

export function getPrismaSchemaPath(): string {
  return path.resolve(__dirname, "../prisma/schema.prisma");
}

export { createAiRepository } from "./ai-repository";
export { createPlatformPrisma, type PrismaClient } from "./platform-prisma";
export { createTeachingRepository, TeachingRuleError } from "./teaching-repository";
export type {
  CommitTeachingTurn,
  PreparedTeachingTurn,
  TeachingClaim,
  TeachingRepository,
} from "./teaching-repository";
export type {
  AiRepository,
  ExplanationCacheKey,
  NewAiUsage,
  StoredExplanation,
} from "./ai-repository";
export { createIdentityRepository } from "./prisma-identity-repository";
export { createAdminAnalytics, AdminQueryError } from "./admin-analytics";
export type { AdminAnalytics, StudentDetail } from "./admin-analytics";
export { adminWindowRange, buildFunnel, conversionRate, rankLessons } from "./admin-window";
export type { AdminWindow } from "./admin-window";
export { createCurriculumRepository } from "./curriculum-repository";
export { createExerciseRepository, ExerciseRuleError } from "./exercise-repository";
export { createProjectRepository, ProjectRuleError } from "./project-repository";
export { createInterviewRepository, InterviewRuleError } from "./interview-repository";
export { createSpeakingRepository, SpeakingRuleError } from "./speaking-repository";
export { createBillingRepository, BillingRuleError } from "./billing-repository";
export { createJobRepository } from "./jobs";
export type { ClaimedJob, JobRepository } from "./jobs";
export { runOperationalCleanup } from "./maintenance";
export type { CleanupCounts } from "./maintenance";
export type {
  BillingRepository,
  CheckoutView,
  PublicPlanPrice,
  SubscriptionView,
  VerifiedPaymentEvent,
} from "./billing-repository";
export {
  parseEntitlements,
  subscriptionGrantsAccess,
  entitlementRank,
  FREE_ENTITLEMENTS,
} from "./entitlement";
export type {
  SpeakingBegin,
  SpeakingRepository,
  SpeakingTurnContext,
  SpeakingUsageWrite,
  TranscriptionUsageWrite,
} from "./speaking-repository";
export type {
  InterviewBegin,
  InterviewFinish,
  InterviewRepository,
  InterviewTurnContext,
} from "./interview-repository";
export type {
  NewProjectAttempt,
  OpenedProject,
  ProjectExecutionPreparation,
  ProjectRepository,
  ProjectReviewPreparation,
  ProjectReviewTarget,
} from "./project-repository";
export type {
  ExecutionPreparation,
  ExerciseRepository,
  NewExerciseAttempt,
  ReviewPreparation,
  ReviewTarget,
  StoredExercise,
} from "./exercise-repository";
export { createAssessmentRepository, AssessmentRuleError } from "./assessment-repository";
export type {
  AssessmentAvailability,
  AssessmentGraph,
  AssessmentRepository,
  StoredAssessmentAnswer,
} from "./assessment-repository";
export { createProgressRepository } from "./progress-repository";
export { EmailAlreadyExistsError, OnboardingUnavailableError } from "./identity";
export { seedCurriculumDatabase } from "./curriculum-seed";
export type {
  CurriculumRepository,
  StoredLearningPath,
  StoredLesson,
  StoredLessonBlock,
  StoredModule,
} from "./curriculum-repository";
export type { NewLearningEvent, ProgressRepository, WeakConceptRow } from "./progress-repository";
export type {
  AccountRole,
  AuthRateAction,
  AuthRateConsumption,
  ConsumeAuthRateInput,
  CreateUserInput,
  IdentityRecord,
  IdentityRepository,
  Locale,
  InsertSessionInput,
  InsertTokenInput,
  LearningCatalogSource,
  NextActionContext,
  OnboardingCounts,
  RegisterStudentInput,
  ResetPasswordInput,
  StoredEnrollment,
  StoredPlanAssignment,
  StoredPreferences,
  StoredSession,
  StoredToken,
  StudentAccount,
  TokenConsumeResult,
  UpdateSessionActivityInput,
  UserStatus,
} from "./identity";
