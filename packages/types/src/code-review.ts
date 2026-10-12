export const CODE_REVIEW_MODES = ["explain", "hint", "review"] as const;

export type CodeReviewMode = (typeof CODE_REVIEW_MODES)[number];

export type CodeReviewIssueType = "logic" | "syntax" | "concept" | "style" | "edge_case";

export interface CodeReviewIssue {
  conceptSlug?: string;
  type: CodeReviewIssueType;
  description: string;
}

export interface CodeReviewResult {
  summary: string;
  understanding: "unknown" | "incorrect" | "partial" | "correct";
  feedback: string;
  hint?: string;
  strengths: string[];
  issues: CodeReviewIssue[];
  nextQuestion?: string;
  suggestedConcepts?: string[];
}

export interface CodeReviewResponse {
  review: CodeReviewResult;
}
