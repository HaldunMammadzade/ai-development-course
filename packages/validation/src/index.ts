import type { ApiErrorBody } from "@platform/types";
import { z } from "zod";

export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});

export function parseApiErrorBody(value: unknown): ApiErrorBody {
  return apiErrorBodySchema.parse(value);
}

export {
  CurriculumValidationError,
  curriculumDocumentSchema,
  validateCurriculum,
} from "./curriculum";
export {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  emailSchema,
  isIanaTimeZone,
  localeSchema,
  loginRequestSchema,
  loginSchema,
  nameSchema,
  passwordResetConfirmSchema,
  passwordResetRequestSchema,
  passwordSchema,
  registerRequestSchema,
  registrationSchema,
  timezoneSchema,
  verifyEmailRequestSchema,
} from "./identity";
export type { LoginInput, RegisterRequestInput, RegistrationInput } from "./identity";
export {
  EXERCISE_MAX_RULES,
  EXERCISE_SUBMISSION_MAX_CHARS,
  codeReviewRequestSchema,
  exerciseAttemptRequestSchema,
  exerciseRuleSchema,
  exerciseRulesSchema,
  executionConfigSchema,
  executionValueSchema,
  isSafeAuthoredRegex,
} from "./exercise";
export type { CodeReviewRequest, ExerciseAttemptRequest } from "./exercise";
export {
  PROJECT_FILE_MAX_CHARS,
  PROJECT_PLAN_MAX_CHARS,
  PROJECT_SUBMISSION_MAX_CHARS,
  isProjectFiles,
  projectAttemptRequestSchema,
  projectPlanRequestSchema,
  projectCheckSchema,
  projectChecksSchema,
  projectFilesSchema,
  projectSeedSchema,
} from "./project";
export type { ProjectAttemptRequest, ProjectCheck, ProjectPlanRequest, ProjectSeed } from "./project";
export {
  ANSWER_CODE_MAX,
  ANSWER_TEXT_MAX,
  ANSWER_TOTAL_MAX,
  interviewAnswerRequestSchema,
  interviewSeedSchema,
  interviewSessionRequestSchema,
} from "./interview";
export type { InterviewAnswerRequest, InterviewSeedInput } from "./interview";
export {
  AUDIO_MAX_BYTES,
  AUDIO_MAX_MS,
  AUDIO_MEDIA_TYPES,
  AUDIO_UNPROVEN_MAX_BYTES,
  AudioValidationError,
  inspectAudio,
} from "./audio";
export type { AudioMediaType } from "./audio";
export { billingCheckoutSchema, billingEmptySchema, paymentEventSchema } from "./billing";
export { adminStudentListSchema, adminStudentParamsSchema, adminWindowSchema } from "./admin";
export { assessmentAnswerSchema } from "./assessment";
export type { AssessmentAnswerInput } from "./assessment";
export { speakingAbandonSchema, speakingStartSchema, speakingTextSchema } from "./speaking";
export type { SpeakingStartInput, SpeakingTextInput } from "./speaking";
export {
  TEACHING_STUDENT_MESSAGE_MAX_CHARS,
  openTeachingSessionSchema,
  teachingTurnSchema,
} from "./teaching";
export type { OpenTeachingSessionInput, TeachingTurnInput } from "./teaching";
