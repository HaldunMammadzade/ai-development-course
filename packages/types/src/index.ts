export type {
  CodeReviewIssue,
  CodeReviewMode,
  CodeReviewResponse,
  CodeReviewResult,
} from "./code-review";
export type {
  SpeakingFeedback,
  SpeakingFeedbackUnderstanding,
  SpeakingMode,
  SpeakingPractice,
  SpeakingPracticeResponse,
  SpeakingQuestionView,
  SpeakingSessionResponse,
  SpeakingSessionStatus,
  SpeakingSessionView,
} from "./speaking";
export type {
  InterviewBand,
  InterviewDetail,
  InterviewDetailResponse,
  InterviewHistoryItem,
  InterviewListResponse,
  InterviewQuestionType,
  InterviewQuestionView,
  InterviewReportResponse,
  InterviewReportView,
  InterviewSessionResponse,
  InterviewSessionStatus,
  InterviewSessionView,
  InterviewSummary,
  InterviewUnderstanding,
} from "./interview";
export type {
  ProjectAttemptListResponse,
  ProjectAttemptView,
  ProjectBrief,
  ProjectDetail,
  ProjectDetailResponse,
  ProjectDifficultyBand,
  ProjectFileName,
  ProjectFiles,
  ProjectListResponse,
  ProjectMilestoneStatus,
  ProjectMilestoneView,
  ProjectMilestoneWorkflow,
  ProjectPlanResponse,
  ProjectPlanReview,
  ProjectPlanView,
  ProjectPortfolio,
  ProjectSummary,
} from "./project";
export { PROJECT_FILE_NAMES } from "./project";
export { CODE_REVIEW_MODES } from "./code-review";
export type {
  ExerciseAttemptListResponse,
  ExerciseAttemptStatus,
  ExerciseAttemptView,
  ExerciseListResponse,
  ExerciseOptionView,
  ExerciseRuleSummary,
  ExerciseView,
} from "./exercise";
export type { CurrentUser, RegisteredStudent, SignedInStudent } from "./account";
export type {
  PublicLessonBlock,
  HomeworkCompletionResponse,
  HomeworkListResponse,
  TeachingHomeworkView,
  TeachingMessageView,
  TeachingStreamEvent,
  TeachingOpenResponse,
  TeachingSessionView,
  TeachingTurnResponse,
  TeachingUpdatedConcept,
} from "./teaching-session";

export { AI_TASKS, PHASE_1_TEACHING_MODES, TEACHING_MODES } from "./teacher";
export type {
  AcceptedMemoryNote,
  AcceptedSkillUpdate,
  AcceptedTeacherTurn,
  AiTask,
  CacheDifficulty,
  Phase1TeachingMode,
  TeacherCacheProposal,
  TeacherContext,
  TeacherMemoryCategory,
  TeacherMemoryProposal,
  TeacherMisconceptionProposal,
  TeacherResult,
  TeacherSkillProposal,
  TeachingMode,
} from "./teacher";

export type {
  LearningActivityItem,
  LearningActivitySource,
  LearningCatalog,
  LearningCatalogConcept,
  LearningCatalogLesson,
  LearningCatalogModule,
  LessonAvailability,
  PathConceptMark,
  PersonalizedPath,
  PersonalizedPathConcept,
  PersonalizedPathStep,
  SkillGraph,
  SkillGraphConcept,
  SkillGraphFocus,
  SkillGraphModule,
  SkillGraphRelation,
  SkillState,
  RevisionIndicator,
  RevisionQueue,
  RevisionQueueItem,
} from "./learning-catalog";

export type {
  Achievement,
  AchievementCategory,
  AchievementList,
  AchievementState,
} from "./achievements";

export type {
  AssessmentConceptNote,
  AssessmentItemKind,
  AssessmentItemView,
  AssessmentPreviousView,
  AssessmentResultView,
  AssessmentStatus,
  AssessmentView,
} from "./assessment";
export type {
  ChallengeLevel,
  CheckQuestionBlock,
  ConceptDefinition,
  ConceptPrerequisite,
  ConceptRole,
  ConfidenceLevel,
  CurriculumDocument,
  Difficulty,
  EventSource,
  ExerciseDefinition,
  ExecutionConfig,
  ExecutionTestDefinition,
  ExecutionValue,
  ExerciseLanguage,
  ExerciseOptionDefinition,
  ExerciseRule,
  ExerciseType,
  ExplanationStyle,
  LearningPathDefinition,
  LessonBlock,
  LessonConceptLink,
  LessonDefinition,
  LessonSummary,
  Locale,
  MasteryBand,
  ModuleDefinition,
  NextAction,
  PathTrack,
  PublishStatus,
  ReadingBlock,
  RecapBlock,
  SkillMastery,
  TeachingState,
  Understanding,
} from "./learning";

export interface HealthResponse {
  status: "ok";
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
