import type { ConfidenceLevel, MasteryBand, NextAction } from "./learning";

export type LessonAvailability = "completed" | "current" | "practice" | "locked";

export interface LearningCatalogLesson {
  slug: string;
  title: string;
  objective: string;
  estimatedMinutes: number;
  availability: LessonAvailability;
}

export interface LearningCatalogModule {
  slug: string;
  title: string;
  description: string;
  lessons: LearningCatalogLesson[];
}

export interface LearningCatalogConcept {
  slug: string;
  name: string;
  moduleTitle: string;
  lessonSlug: string;
  mastery: number | null;
  confidence: ConfidenceLevel | null;
  band: MasteryBand | null;
  reviewDue: boolean;
}

export type LearningActivitySource =
  | "lesson_check"
  | "exercise"
  | "quiz"
  | "code_review"
  | "interview"
  | "homework"
  | "project"
  | "speaking";

export interface LearningActivityItem {
  id: string;
  source: LearningActivitySource;
  conceptName: string;
  createdAt: string;
}

export interface LearningCatalogFocus {
  slug: string;
  name: string;
  decision:
    "CONTINUE" | "REEXPLAIN" | "HINT" | "RETRY" | "REVIEW" | "CHALLENGE" | "REMEDIATE_PREREQUISITE";
  reason: string;
}

export type PathConceptMark = "known" | "current" | "upcoming" | "review";

export interface PersonalizedPathStep {
  slug: string;
  title: string;
  moduleTitle: string;
}

export interface PersonalizedPathConcept {
  slug: string;
  name: string;
  mark: PathConceptMark;
}

export interface PersonalizedPath {
  note: string | null;
  current: PersonalizedPathStep | null;
  next: PersonalizedPathStep[];
  concepts: PersonalizedPathConcept[];
  known: string[];
}

export type SkillState = "unknown" | "weak" | "developing" | "strong";

export type RevisionIndicator = "due" | "overdue" | "recently_reviewed";

export interface RevisionQueueItem {
  slug: string;
  name: string;
  lessonSlug: string;
  lessonTitle: string;
  state: "due" | "overdue";
}

export interface RevisionQueue {
  status: "empty" | "waiting" | "reviewed" | "ready";
  items: RevisionQueueItem[];
}

export interface SkillGraphRelation {
  slug: string;
  name: string;
  state: SkillState;
}

export interface SkillGraphConcept {
  slug: string;
  name: string;
  summary: string;
  moduleSlug: string;
  moduleTitle: string;
  lessonSlug: string;
  lessonTitle: string;
  lessonAvailability: LessonAvailability;
  state: SkillState;
  prerequisites: SkillGraphRelation[];
  dependents: SkillGraphRelation[];
  evidenceSource: LearningActivitySource | null;
  revision: RevisionIndicator | null;
}

export interface SkillGraphModule {
  slug: string;
  title: string;
  conceptSlugs: string[];
  counts: {
    total: number;
    unknown: number;
    weak: number;
    developing: number;
    strong: number;
  };
}

export interface SkillGraphFocus {
  moduleTitle: string;
  lessonTitle: string;
  concepts: Array<{ slug: string; name: string; mark: PathConceptMark }>;
}

export interface SkillGraph {
  focus: SkillGraphFocus | null;
  modules: SkillGraphModule[];
  concepts: SkillGraphConcept[];
}

export interface LearningCatalog {
  path: {
    slug: string;
    title: string;
    description: string;
  } | null;
  modules: LearningCatalogModule[];
  concepts: LearningCatalogConcept[];
  focus: LearningCatalogFocus | null;
  nextAction: NextAction;
  activity: LearningActivityItem[];
  personalized?: PersonalizedPath;
  skill?: SkillGraph;
  revision?: RevisionQueue;
}
