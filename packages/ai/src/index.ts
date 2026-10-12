export { admitExplanationCache } from "./cache/explanation-cache";
export type { CacheAdmission, ExplanationCacheEntry } from "./cache/explanation-cache";
export { buildTeacherContext } from "./context/teacher-context";
export type { TeacherContextSource } from "./context/teacher-context";
export {
  GLOSSARY_REMINDER,
  MAX_HOMEWORK_CHARS,
  MAX_MESSAGE_CHARS,
  MAX_MISCONCEPTIONS,
  MAX_RECENT_MESSAGES,
  MAX_STUDENT_MESSAGE_CHARS,
  MAX_SUMMARY_CHARS,
} from "./context/limits";
export { isPhase1TeachingMode, isTeachingMode } from "./modes";
export { TEACHER_SYSTEM_PROMPT, TEACHER_SYSTEM_PROMPT_VERSION } from "./prompts/teacher/v1/system";
export {
  TEACHER_TEACH_PROMPT_VERSION,
  TeachingModeUnavailableError,
  renderTeachPrompt,
} from "./prompts/teacher/v1/teach";
export type { TeachPrompt } from "./prompts/teacher/v1/teach";
export { assertInputSize } from "./provider/ai-provider";
export type {
  AIModel,
  AIModelConfig,
  AIProvider,
  AIRequest,
  AIResponse,
  AIUsage,
} from "./provider/ai-provider";
export { AIProviderError, providerErrorCode } from "./provider/errors";
export type { AIProviderErrorCode } from "./provider/errors";
export { FakeAiProvider } from "./provider/fake-ai-provider";
export {
  DisabledAiProvider,
  OpenAiCompatibleProvider,
} from "./provider/openai-compatible.provider";
export type { OpenAiCompatibleOptions } from "./provider/openai-compatible.provider";
export {
  AiConfigurationError,
  AiTaskUnavailableError,
  ModelRouter,
  UnknownAiTaskError,
  completeCodeReview,
  completeInterview,
  completeProjectPlan,
  completeProjectReview,
  completeTeach,
  createModelRouter,
  isAiTask,
} from "./router/model-router";
export {
  CODE_REVIEW_PROMPT_VERSION,
  CODE_REVIEW_SYSTEM_PROMPT,
} from "./prompts/code-review/v1/system";
export { renderCodeReviewPrompt } from "./prompts/code-review/v1/review";
export {
  PROJECT_REVIEW_PROMPT_VERSION,
  PROJECT_REVIEW_SYSTEM_PROMPT,
} from "./prompts/project-review/v1/system";
export { renderProjectPlanPrompt } from "./prompts/project-plan/v1/review";
export type { ProjectPlanPrompt, ProjectPlanPromptInput } from "./prompts/project-plan/v1/review";
export {
  PROJECT_PLAN_PROMPT_VERSION,
  PROJECT_PLAN_SYSTEM_PROMPT,
} from "./prompts/project-plan/v1/system";
export { renderProjectReviewPrompt } from "./prompts/project-review/v1/review";
export type {
  ProjectReviewPrompt,
  ProjectReviewPromptInput,
} from "./prompts/project-review/v1/review";
export { normalizeProjectPlanReview } from "./safety/normalize-project-plan";
export {
  normalizeProjectReviewOutput,
  normalizeProjectReviewTurn,
} from "./safety/normalize-project-review";
export { normalizeInterviewOutput } from "./safety/normalize-interview";
export { normalizeSpeakingOutput } from "./safety/normalize-speaking";
export type { NormalizedSpeaking, SpeakingNormalizationScope } from "./safety/normalize-speaking";
export { SPEAKING_PROMPT_VERSION, SPEAKING_SYSTEM_PROMPT } from "./prompts/speaking/v1/system";
export { renderSpeakingPrompt } from "./prompts/speaking/v1/speaking";
export type { SpeakingPrompt, SpeakingPromptInput } from "./prompts/speaking/v1/speaking";
export {
  DisabledSpeechToTextProvider,
  FakeSpeechToTextProvider,
  SpeechUnavailableError,
} from "./speech/speech-to-text";
export type { SpeechAudio, SpeechToTextProvider, SpeechTranscript } from "./speech/speech-to-text";
export { HttpSpeechToTextProvider } from "./speech/http-speech";
export type { HttpSpeechConfig } from "./speech/http-speech";
export type {
  InterviewNormalizationScope,
  NormalizedInterview,
} from "./safety/normalize-interview";
export { INTERVIEW_PROMPT_VERSION, INTERVIEW_SYSTEM_PROMPT } from "./prompts/interview/v1/system";
export { renderInterviewPrompt } from "./prompts/interview/v1/interview";
export type { InterviewPrompt, InterviewPromptInput } from "./prompts/interview/v1/interview";
export type { CodeReviewPrompt, CodeReviewPromptInput } from "./prompts/code-review/v1/review";
export { normalizeCodeReviewOutput, normalizeCodeReviewTurn } from "./safety/normalize-code-review";
export type {
  CodeReviewNormalization,
  CodeReviewNormalizationScope,
  CodeReviewSafetyDrop,
} from "./safety/normalize-code-review";
export { parseCodeReviewResult } from "./schemas/code-review-result";
export type { ModelRoute, ModelStrength, TeachRouteConfig } from "./router/model-router";
export {
  normalizeTeacherOutput,
  normalizeTeacherTurn,
  serverSkillWeight,
} from "./safety/normalize-teacher-result";
export type { TeacherNormalizationScope } from "./safety/normalize-teacher-result";
export {
  decodeTeacherJson,
  parseTeacherResult,
  parseTeacherResultJson,
  readTeacherResult,
  stripModelSecrets,
  teacherResultSchema,
} from "./schemas/teacher-result";
export { estimateCostMicros, recordAiUsage } from "./usage";
export type { RecordedAiUsage } from "./usage";
