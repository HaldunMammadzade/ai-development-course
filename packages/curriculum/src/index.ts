export { FRONTEND_PATH_SLUG } from "./paths";
export { CURRICULUM_FORMAT_VERSION } from "./version";
export { frontendExercises } from "./frontend-exercises";
export { frontendCurriculum } from "./frontend-seed";
export { frontendProjects } from "./frontend-project";
export { frontendInterviews } from "./frontend-interview";
export { SPEAKING_TITLE, frontendSpeakingQuestions } from "./frontend-speaking";
export type { SpeakingQuestionSeed } from "./frontend-speaking";
export {
  SPEAKING_AI_CALLS_PER_DAY,
  SPEAKING_ATTEMPTS_PER_10_MIN,
  SPEAKING_ATTEMPTS_PER_DAY,
  SPEAKING_EVIDENCE,
  SPEAKING_MAX_EVENTS_PER_ATTEMPT,
  SPEAKING_MAX_EVENTS_PER_SESSION,
  SPEAKING_TRANSCRIPT_MAX,
  SPEAKING_TRANSCRIPT_MIN,
  SPEAKING_TRANSCRIPTIONS_PER_DAY,
  SPEAKING_WINDOW_MS,
  speakingEvidence,
  speakingHiddenLiterals,
  transcriptQuality,
} from "./speaking-score";
export type { InterviewQuestionSeed, InterviewSeed } from "./frontend-interview";
export {
  ANSWER_CODE_MAX,
  ANSWER_TEXT_MAX,
  ANSWER_TOTAL_MAX,
  CODE_EXECUTION_SHARE,
  CODE_REASONING_SHARE,
  FOLLOW_UP_SHARE,
  INTERVIEW_WEEK_MS,
  LEARNING_EVIDENCE_CAP,
  LEARNING_EVIDENCE_FLOOR,
  MAX_ACTIVE_INTERVIEWS,
  MAX_AI_CALLS_PER_INTERVIEW,
  MAX_COMPLETED_PER_DAY,
  MAX_FOLLOW_UPS_PER_QUESTION,
  MAX_INTERVIEWS_PER_WEEK,
  MAX_LEARNING_EVENTS,
  VERBAL_EVIDENCE,
  blendFollowUp,
  codeEvidence,
  decideInterviewStep,
  finalInterviewScore,
  interviewBand,
  interviewHiddenLiterals,
  learningEvidence,
  verbalEvidence,
} from "./interview-score";
export {
  evaluateProjectMilestone,
  javascriptRequest,
  projectHiddenLiterals,
  PROJECT_FAILURE_EVIDENCE,
  PROJECT_PASS_SCORE,
} from "./project-checks";
export {
  milestoneWorkflow,
  projectBrief,
  projectDifficultyBand,
  projectPortfolio,
  projectSelectionRank,
  selectProjects,
} from "./project-learning";
export type { ProjectSelectionInput } from "./project-learning";
export type {
  ProjectEvaluation,
  ProjectScriptObservation,
  ProjectScriptRequest,
} from "./project-checks";
export {
  eligibleReviewLesson,
  getDirectPrerequisites,
  getLessonThatTeachesConcept,
  hasRemainingCheckQuestion,
  isConceptTaughtInPath,
  isLessonUnlocked,
  lessonHasHarderCheck,
  recapPracticePrompt,
} from "./graph";
export type { PathLesson, PrerequisiteEdge } from "./graph";
export {
  evaluateExercise,
  exerciseMasteryUpdate,
  EXERCISE_ATTEMPT_LIMIT,
  EXERCISE_ATTEMPT_WINDOW_MS,
  EXERCISE_PASS_SCORE,
} from "./exercise-validator";
export type { ExerciseEvaluation } from "./exercise-validator";
export {
  calculateMastery,
  clampCheckEvidence,
  confidenceLevel,
  evidenceWeight,
  HOMEWORK_DONE_EVIDENCE,
  homeworkDoneUpdate,
  isWeak,
  masteryBand,
  selectSkillUpdates,
} from "./mastery";
export type {
  AcceptedSkillUpdate,
  MasteryEvent,
  MasteryProjection,
  ProposedSkillUpdate,
} from "./mastery";
export {
  assessStrongModelQuota,
  assessTeacherQuota,
  assessTeachingBurst,
  AUTH_RATE_LIMITS,
  authRateAllowed,
  authRateWindowStart,
  TEACHING_BURST_LIMIT,
  TEACHING_BURST_WINDOW_MS,
} from "./quota";
export type { AuthRateAction } from "./quota";
export type { TeacherQuotaUsage } from "./quota";
export { selectTeacherMemory, MAX_TEACHER_MEMORY } from "./memory-selection";
export type { MemoryCandidate, SelectedMemory } from "./memory-selection";
export { completedTeachingEvents, teachingErrorEvent } from "./teaching-stream";
export { presentLearningCatalog } from "./learning-catalog";
export { GIT_MODULE_SLUG, gitExercises, gitLessons } from "./git-workflow";
export { TESTING_MODULE_SLUG, testingExercises, testingLessons } from "./testing-fundamentals";
export type { CatalogContext, CatalogLessonSource, CatalogModuleSource } from "./learning-catalog";
export {
  classifyStoredEvidence,
  decideAdaptive,
  prerequisiteIsWeak,
  reviewDue,
  selectExercise,
} from "./adaptive";
export type {
  AdaptiveChoice,
  AdaptiveConceptState,
  AdaptiveDecision,
  AdaptiveEvidence,
  AdaptiveEvidenceSource,
  AdaptiveExercise,
  AdaptiveReason,
  TeachingStrategy,
} from "./adaptive";
export {
  ASSESSMENT_CONTEXT,
  ASSESSMENT_ITEM_LIMIT,
  acceptedAssessmentAnswer,
  assessmentItemById,
  assessmentItems,
  placeAssessment,
  projectAssessmentMastery,
  scoreAssessmentAnswer,
  selectAssessmentItem,
  startLabel,
} from "./assessment";
export type {
  AssessmentAnswerMark,
  AssessmentDomain,
  AssessmentItem,
  AssessmentKind,
  PlacementLesson,
  PlacementResult,
} from "./assessment";
export { getNextAction } from "./next-action";
export { buildPersonalizedPath, lessonIsCredited } from "./personalized-path";
export { buildSkillGraph, skillState, skillStateFromEvidence } from "./skill-graph";
export {
  REVISION_QUEUE_LIMIT,
  REVISION_SUCCESS_EVIDENCE,
  buildRevision,
  revisionIntervalDays,
  revisionScheduleState,
  selectRevisionExercise,
  summarizeSuccesses,
} from "./revision";
export { buildAchievements } from "./achievements";
export type {
  AchievementFacts,
  AchievementLessonFact,
  AchievementModuleFact,
  AchievementPassFact,
  AchievementProjectFact,
} from "./achievements";
export type {
  RevisionConceptInput,
  RevisionEvent,
  RevisionExercise,
  RevisionScheduleState,
  RevisionSuccessSummary,
} from "./revision";
export type { SkillGraphConceptInput } from "./skill-graph";
export type {
  HomeworkCandidate,
  LessonCandidate,
  MasterySnapshot,
  OpenSessionCandidate,
} from "./next-action";
export {
  advanceTeachingProgress,
  currentTeachingBlock,
  initialTeachingProgress,
  publicLessonBlock,
  teachingTurnNeedsAnswer,
} from "./teaching-flow";
export type { TeachingProgressMarks } from "./teaching-flow";
export { isOpenTeachingState, resolveTeachingTransition } from "./teaching-state";
export type {
  TeachingLessonContext,
  TeachingTransitionInput,
  TeachingTransitionResult,
} from "./teaching-state";
export {
  MASTERY_DECAY_DAYS,
  MASTERY_WINDOW,
  MAX_SKILL_UPDATES,
  UNLOCK_MASTERY,
  WEAK_MASTERY_BELOW,
  HOMEWORK_DUE_MS,
  TEACHING_SESSION_IDLE_MS,
  isDueOnOrBeforeStudentToday,
  studentCalendarDay,
  studentDayAge,
  studentDayInterval,
} from "./time";
