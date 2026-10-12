import type { Difficulty, ExerciseLanguage, ExerciseType } from "./learning";

export interface ExerciseOptionView {
  id: string;
  label: string;
}

export interface ExerciseView {
  id: string;
  slug: string;
  lessonSlug: string;
  title: string;
  prompt: string;
  instructions: string;
  type: ExerciseType;
  language: ExerciseLanguage | null;
  difficulty: Difficulty;
  starterCode: string | null;
  options: ExerciseOptionView[];
  executionAvailable: boolean;
}

export interface ExerciseListResponse {
  exercises: ExerciseView[];
}

export type ExerciseAttemptStatus = "passed" | "failed";

export interface ExerciseRuleSummary {
  feedback: string;
}

export interface ExerciseAttemptView {
  id: string;
  exerciseId: string;
  status: ExerciseAttemptStatus;
  score: number;
  passed: boolean;
  feedback: string;
  passedRules: ExerciseRuleSummary[];
  failedRules: ExerciseRuleSummary[];
  attemptNumber: number;
  submission: string;
  createdAt: string;
}

export interface ExerciseAttemptListResponse {
  attempts: ExerciseAttemptView[];
}
