import type { Difficulty } from "./learning";

export const PROJECT_FILE_NAMES = ["index.html", "style.css", "script.js"] as const;

export type ProjectFileName = (typeof PROJECT_FILE_NAMES)[number];

export type ProjectFiles = Record<ProjectFileName, string>;

export type ProjectMilestoneStatus = "passed" | "current" | "locked";

export type ProjectMilestoneWorkflow = "TODO" | "IN_PROGRESS" | "SUBMITTED" | "FAILED" | "PASSED";

export type ProjectDifficultyBand = "FOUNDATION" | "INTERMEDIATE" | "ADVANCED";

export interface ProjectBrief {
  goal: string;
  required: string[];
  recommended: string[];
  optional: string[];
}

export interface ProjectPlanReview {
  summary: string;
  strengths: string[];
  risks: string[];
  suggestions: string[];
  questions: string[];
}

export interface ProjectPlanView {
  body: string;
  updatedAt: string;
  review: ProjectPlanReview | null;
}

export interface ProjectPlanResponse {
  plan: ProjectPlanView;
}

export interface ProjectPortfolio {
  title: string;
  problem: string;
  technologies: string[];
  features: string[];
  skills: string[];
  completedAt: string;
}

export interface ProjectConceptView {
  slug: string;
  name: string;
}

export interface ProjectSummary {
  slug: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  completed: boolean;
  passedMilestones: number;
  totalMilestones: number;
  band: ProjectDifficultyBand;
}

export interface ProjectListResponse {
  projects: ProjectSummary[];
}

export interface ProjectMilestoneView {
  slug: string;
  position: number;
  title: string;
  status: ProjectMilestoneStatus;
  workflow: ProjectMilestoneWorkflow;
  objective?: string;
  instructions?: string;
  concepts?: ProjectConceptView[];
  files?: ProjectFiles;
}

export interface ProjectDetail {
  slug: string;
  title: string;
  description: string;
  objective: string;
  difficulty: Difficulty;
  estimatedMinutes: number;
  completed: boolean;
  completedAt: string | null;
  currentMilestone: string;
  band: ProjectDifficultyBand;
  brief: ProjectBrief;
  plan: ProjectPlanView | null;
  portfolio: ProjectPortfolio | null;
  concepts: ProjectConceptView[];
  milestones: ProjectMilestoneView[];
}

export interface ProjectDetailResponse {
  project: ProjectDetail;
}

export interface ProjectAttemptView {
  id: string;
  milestoneSlug: string;
  status: "passed" | "failed";
  score: number;
  passed: boolean;
  feedback: string;
  passedChecks: string[];
  failedChecks: string[];
  files: ProjectFiles;
  attemptNumber: number;
  createdAt: string;
}

export interface ProjectAttemptListResponse {
  attempts: ProjectAttemptView[];
}
