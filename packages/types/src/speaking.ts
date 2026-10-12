export type SpeakingMode = "lesson" | "interview";

export type SpeakingSessionStatus = "active" | "completed" | "abandoned";

export type SpeakingFeedbackUnderstanding =
  "unknown" | "incorrect" | "partial" | "correct" | "unclear";

export interface SpeakingPractice {
  title: string;
  description: string;
  questionCount: number;
  activeSessionId: string | null;
}

export interface SpeakingPracticeResponse {
  practice: SpeakingPractice;
}

export interface SpeakingQuestionView {
  title: string;
  prompt: string;
  position: number;
  total: number;
}

export interface SpeakingFeedback {
  transcript: string;
  speech: string;
  feedback: string;
  understanding: SpeakingFeedbackUnderstanding;
  strengths: string[];
  issues: string[];
}

export interface SpeakingSessionView {
  id: string;
  mode: SpeakingMode;
  status: SpeakingSessionStatus;
  question: SpeakingQuestionView | null;
  feedback: SpeakingFeedback | null;
  nextAction: string | null;
}

export interface SpeakingSessionResponse {
  session: SpeakingSessionView;
}
