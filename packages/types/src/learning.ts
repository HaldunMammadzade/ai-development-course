export type Locale = "az-AZ" | "en" | "tr" | "ru";

export type ExplanationStyle = "clear" | "step_by_step" | "example_first" | "analogy" | "concise";

export type ChallengeLevel = "adaptive" | "gentle" | "standard" | "demanding";

export type PublishStatus = "draft" | "published";

export type PathTrack = "frontend" | "backend" | "fullstack" | "skill";

export type ConceptRole = "primary" | "supporting";

export type Difficulty = "beginner" | "easy" | "intermediate" | "advanced" | "expert";

export type TeachingState =
  | "created"
  | "prior_check"
  | "objective"
  | "explain"
  | "comprehension_check"
  | "adapt"
  | "exercise"
  | "evaluate"
  | "hint"
  | "raise_difficulty"
  | "summarize"
  | "homework"
  | "completed"
  | "review_completed"
  | "abandoned";

export type Understanding = "correct" | "partial" | "incorrect" | "unknown";

export type MasteryBand = "weak" | "fragile" | "working" | "strong";

export type ConfidenceLevel = "low" | "medium" | "high";

export type EventSource =
  "lesson_check" | "homework" | "exercise" | "project" | "interview" | "speaking";

export interface ConceptDefinition {
  slug: string;
  name: string;
  domain: string;
  summary: string;
}

export interface ConceptPrerequisite {
  conceptSlug: string;
  prerequisiteSlug: string;
}

export interface LessonConceptLink {
  conceptSlug: string;
  role: ConceptRole;
}

export interface ReadingBlock {
  type: "reading";
  position: number;
  markdown: string;
  conceptSlugs: string[];
}

export interface CheckQuestionBlock {
  type: "check_question";
  position: number;
  prompt: string;
  rubric: string[];
  conceptSlugs: string[];
  difficulty: Difficulty;
  harder?: boolean;
}

export interface RecapBlock {
  type: "recap";
  position: number;
  points: string[];
  practicePrompt: string;
}

export type LessonBlock = ReadingBlock | CheckQuestionBlock | RecapBlock;

export interface LessonDefinition {
  slug: string;
  title: string;
  objective: string;
  position: number;
  estimatedMinutes: number;
  status: PublishStatus;
  concepts: LessonConceptLink[];
  blocks: LessonBlock[];
}

export interface ModuleDefinition {
  slug: string;
  title: string;
  description: string;
  position: number;
  lessons: LessonDefinition[];
}

export interface LearningPathDefinition {
  slug: string;
  title: string;
  description: string;
  track: PathTrack;
  status: PublishStatus;
  position: number;
  modules: ModuleDefinition[];
}

export interface CurriculumDocument {
  concepts: ConceptDefinition[];
  prerequisites: ConceptPrerequisite[];
  paths: LearningPathDefinition[];
  exercises: ExerciseDefinition[];
}

export interface LessonSummary {
  id: string;
  slug: string;
  title: string;
  modulePosition: number;
  lessonPosition: number;
  status: PublishStatus;
  primaryConceptSlugs: string[];
  supportingConceptSlugs: string[];
}

export interface SkillMastery {
  conceptSlug: string;
  score: number;
  evidenceCount: number;
  lastEvidenceAt: Date;
  band: MasteryBand | null;
  confidence: ConfidenceLevel;
}

export type ExerciseType = "multiple_choice" | "code_text";

export type ExerciseLanguage = "html" | "css" | "javascript";

export type ExerciseRule =
  | { type: "required_text"; text: string; points: number; feedback: string }
  | { type: "contains_text"; text: string; points: number; feedback: string }
  | { type: "not_contains_text"; text: string; points: number; feedback: string }
  | { type: "exact_text"; text: string; points: number; feedback: string }
  | { type: "regex"; pattern: string; points: number; feedback: string }
  | { type: "minimum_length"; length: number; points: number; feedback: string }
  | { type: "maximum_length"; length: number; points: number; feedback: string }
  | { type: "html_element_exists"; tag: string; points: number; feedback: string }
  | {
      type: "html_attribute_exists";
      tag: string;
      attribute: string;
      points: number;
      feedback: string;
    }
  | {
      type: "html_attribute_equals";
      tag: string;
      attribute: string;
      value: string;
      points: number;
      feedback: string;
    }
  | { type: "ordered_tokens"; tokens: string[]; points: number; feedback: string }
  | { type: "choice_equals"; optionId: string; points: number; feedback: string }
  | { type: "execution_only"; points: number; feedback: string };

export type ExecutionValue = string | number | boolean | null | ExecutionValue[];

export interface ExecutionTestDefinition {
  id: string;
  args: ExecutionValue[];
  expected: ExecutionValue;
  points: number;
}

export interface ExecutionConfig {
  entry: string;
  tests: ExecutionTestDefinition[];
}

export interface ExerciseOptionDefinition {
  id: string;
  label: string;
}

export interface ExerciseDefinition {
  slug: string;
  lessonSlug: string;
  conceptSlug: string;
  title: string;
  prompt: string;
  instructions: string;
  type: ExerciseType;
  language: ExerciseLanguage | null;
  difficulty: Difficulty;
  position: number;
  starterCode: string | null;
  published: boolean;
  options: ExerciseOptionDefinition[];
  rules: ExerciseRule[];
  execution?: ExecutionConfig | null;
}

export type NextAction =
  | { kind: "do_homework"; homeworkId: string; lessonId: string; title: string }
  | { kind: "continue_lesson"; sessionId: string; lessonId: string; title: string }
  | { kind: "start_lesson"; lessonId: string; title: string }
  | { kind: "review_concept"; conceptSlug: string; lessonId: string; title: string }
  | { kind: "path_complete" };
