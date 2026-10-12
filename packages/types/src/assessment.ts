export type AssessmentStatus = "not_required" | "in_progress" | "completed" | "skipped";

export type AssessmentItemKind = "mcq" | "short" | "code";

export interface AssessmentItemView {
  id: string;
  kind: AssessmentItemKind;
  prompt: string;
  options: Array<{ id: string; label: string }>;
}

export interface AssessmentPreviousView {
  prompt: string;
  submission: string;
  passed: boolean;
}

export interface AssessmentConceptNote {
  name: string;
  weak: boolean;
}

export interface AssessmentResultView {
  label: string;
  lesson: { slug: string; title: string; moduleTitle: string } | null;
  known: Array<{ name: string }>;
  gaps: AssessmentConceptNote[];
}

export interface AssessmentView {
  status: AssessmentStatus;
  answered: number;
  limit: number;
  item: AssessmentItemView | null;
  previous: AssessmentPreviousView | null;
  result: AssessmentResultView | null;
}
