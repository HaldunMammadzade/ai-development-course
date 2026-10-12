export type InterviewQuestionType = "verbal" | "code";
export type InterviewSessionStatus = "active" | "completed" | "abandoned";
export type InterviewBand = "weak" | "developing" | "strong";
export type InterviewUnderstanding = "unknown" | "incorrect" | "partial" | "correct";

export interface InterviewSummary {
  slug: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  questionCount: number;
}

export interface InterviewHistoryItem {
  id: string;
  status: InterviewSessionStatus;
  startedAt: string;
  completedAt: string | null;
  finalScore: number | null;
  band: InterviewBand | null;
}

export interface InterviewDetail {
  slug: string;
  title: string;
  description: string;
  objective: string;
  estimatedMinutes: number;
  questionCount: number;
  activeSessionId: string | null;
  history: InterviewHistoryItem[];
}

export interface InterviewQuestionView {
  title: string;
  prompt: string;
  type: InterviewQuestionType;
  position: number;
  total: number;
  followUp: boolean;
  starterCode: string | null;
}

export interface InterviewReportView {
  finalScore: number;
  band: InterviewBand;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  conceptsToReview: string[];
  nextAction: string;
  scoreSource: "server";
}

export interface InterviewSessionView {
  id: string;
  interviewSlug: string;
  interviewTitle: string;
  status: InterviewSessionStatus;
  question: InterviewQuestionView | null;
  speech: string | null;
  report: InterviewReportView | null;
}

export interface InterviewListResponse {
  interviews: InterviewSummary[];
}

export interface InterviewDetailResponse {
  interview: InterviewDetail;
}

export interface InterviewSessionResponse {
  session: InterviewSessionView;
}

export interface InterviewReportResponse {
  report: InterviewReportView;
}
