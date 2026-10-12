export interface ExerciseEvaluation {
  score: number;
  passed: boolean;
  feedback: string;
  passedRules: Array<{ feedback: string }>;
  failedRules: Array<{ feedback: string }>;
}
