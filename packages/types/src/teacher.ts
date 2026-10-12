import type {
  ChallengeLevel,
  Difficulty,
  ExplanationStyle,
  LessonBlock,
  Locale,
  TeachingState,
  Understanding,
} from "./learning";

export const TEACHING_MODES = [
  "explain",
  "socratic",
  "practice",
  "debug",
  "challenge",
  "interview",
  "project",
  "revision",
] as const;

export type TeachingMode = (typeof TEACHING_MODES)[number];

export const PHASE_1_TEACHING_MODES = ["explain", "socratic"] as const;

export type Phase1TeachingMode = (typeof PHASE_1_TEACHING_MODES)[number];

export const AI_TASKS = [
  "teach",
  "review",
  "code_review",
  "project_review",
  "classify",
  "summarize",
  "interview",
] as const;

export type AiTask = (typeof AI_TASKS)[number];

export type TeacherMemoryCategory = "learning" | "mistake" | "preference";

export type CacheDifficulty = Extract<Difficulty, "beginner" | "intermediate" | "advanced">;

export interface TeacherSkillProposal {
  conceptSlug: string;
  evidence: number;
  understanding: Exclude<Understanding, "unknown">;
}

export interface TeacherMemoryProposal {
  category: TeacherMemoryCategory;
  conceptSlug?: string;
  content: string;
  importance: 1 | 2 | 3;
}

export interface TeacherMisconceptionProposal {
  code: string;
  description: string;
  conceptSlug: string;
  confidence?: number;
}

export interface TeacherCacheProposal {
  conceptSlug: string;
  difficulty: CacheDifficulty;
  speech: string;
}

/** Structured proposal from the model. The server still has to accept it. */
export interface TeacherResult {
  speech: string;
  understanding: Understanding;
  misconception: TeacherMisconceptionProposal | null;
  skillUpdates: TeacherSkillProposal[];
  memoryNotes: TeacherMemoryProposal[];
  suggestedState: TeachingState | null;
  homework: string | null;
  cacheableExplanation: TeacherCacheProposal | null;
}

export interface AcceptedSkillUpdate {
  conceptSlug: string;
  understanding: Exclude<Understanding, "unknown">;
  evidence: number;
  weight: number;
}

export interface AcceptedMemoryNote {
  category: TeacherMemoryCategory;
  conceptSlug: string | null;
  content: string;
  importance: 1 | 2 | 3;
}

export interface AcceptedTeacherTurn {
  speech: string;
  understanding: Understanding;
  misconception: {
    code: string;
    description: string;
    conceptSlug: string;
  } | null;
  skillUpdates: AcceptedSkillUpdate[];
  memoryNotes: AcceptedMemoryNote[];
  state: TeachingState;
  suggestionAccepted: boolean;
  homework: string | null;
  cacheableExplanation: {
    conceptSlug: string;
    difficulty: CacheDifficulty;
    locale: Locale;
    style: ExplanationStyle;
    speech: string;
  } | null;
}

export interface TeacherContext {
  locale: Locale;
  timezone: string;
  mode: TeachingMode;
  state: TeachingState;
  glossaryReminder: string;
  lesson: {
    slug: string;
    title: string;
    objective: string;
    currentBlock: LessonBlock;
    primaryConcepts: Array<{ slug: string; name: string }>;
    supportingConcepts: Array<{ slug: string; name: string }>;
    directPrerequisites: Array<{ slug: string; name: string }>;
    reviewFocus?: { slug: string; name: string };
  };
  student: {
    name: string;
    explanationStyle: ExplanationStyle;
    challengeLevel: ChallengeLevel;
  };
  learning: {
    mastery: Array<{ slug: string; name: string; mastery: number | null }>;
    misconceptions: Array<{ code: string; description: string; conceptSlug: string }>;
    adaptive: {
      conceptSlug: string;
      decision:
        | "CONTINUE"
        | "REEXPLAIN"
        | "HINT"
        | "RETRY"
        | "REVIEW"
        | "CHALLENGE"
        | "REMEDIATE_PREREQUISITE";
      strategy:
        | "EXPLAIN"
        | "SOCRATIC"
        | "EXAMPLE"
        | "ANALOGY"
        | "GUIDED_RETRY"
        | "TARGETED_REVIEW"
        | "CHALLENGE";
      reason: string;
    };
    openHomework: string | null;
    memory: Array<{
      category: "learning" | "mistake" | "preference";
      conceptSlug: string | null;
      content: string;
    }>;
  };
  session: {
    mode: TeachingMode;
    state: TeachingState;
    turnNumber: number;
    recentMessages: Array<{ role: "student" | "teacher"; speech: string }>;
    summary: string | null;
  };
  studentMessage: string;
  allowCache: boolean;
}
