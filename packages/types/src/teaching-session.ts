import type { NextAction, TeachingState, Understanding } from "./learning";
import type { Phase1TeachingMode } from "./teacher";

export type PublicLessonBlock =
  | { type: "reading"; position: number; markdown: string }
  | { type: "check_question"; position: number; prompt: string }
  | { type: "recap"; position: number; points: string[]; practicePrompt: string };

export interface TeachingHomeworkView {
  id: string;
  prompt: string;
  status: "assigned" | "done" | "skipped";
  dueAt: string;
  completedAt: string | null;
  lessonSlug: string;
  lessonTitle: string;
  title: string;
}

export interface TeachingMessageView {
  id: string;
  role: "student" | "teacher";
  speech: string;
  createdAt: string;
}

export interface TeachingSessionView {
  id: string;
  lessonSlug: string;
  lessonTitle: string;
  mode: Phase1TeachingMode;
  state: TeachingState;
  turnNumber: number;
  completed: boolean;
  reviewConceptName: string | null;
  block: PublicLessonBlock;
  messages: TeachingMessageView[];
  homework: TeachingHomeworkView | null;
  progress: Array<{ slug: string; mastery: number | null }>;
  nextAction: NextAction;
}

export interface TeachingUpdatedConcept {
  conceptSlug: string;
  understanding: Exclude<Understanding, "unknown">;
  evidence: number;
  mastery: number | null;
}

export interface TeachingTurnResponse {
  session: {
    id: string;
    lessonSlug: string;
    lessonTitle: string;
    mode: Phase1TeachingMode;
    state: TeachingState;
    turnNumber: number;
    completed: boolean;
  };
  teacher: {
    message: string;
    understanding: Understanding;
  };
  learning: {
    updatedConcepts: TeachingUpdatedConcept[];
    mastery: Array<{ slug: string; mastery: number | null }>;
    nextAction: NextAction;
    adaptive?: {
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
  };
  usage: {
    turnConsumed: boolean;
  };
  block: PublicLessonBlock;
  homework: TeachingHomeworkView | null;
}

export interface HomeworkListResponse {
  homework: TeachingHomeworkView[];
}

export interface HomeworkCompletionResponse {
  homework: TeachingHomeworkView;
  learning: {
    updatedConcepts: Array<{
      conceptSlug: string;
      evidence: number;
      mastery: number | null;
    }>;
    nextAction: NextAction;
  };
}

export type TeachingStreamEvent =
  | { type: "teacher.started"; sessionId: string }
  | { type: "teacher.delta"; text: string }
  | { type: "teacher.completed"; turn: TeachingTurnResponse }
  | { type: "teacher.error"; code: string; message: string };

export type TeachingOpenResponse =
  | { kind: "session"; session: TeachingSessionView; nextAction: NextAction }
  | {
      kind: "homework";
      homework: TeachingHomeworkView;
      session: TeachingSessionView | null;
      nextAction: NextAction;
    }
  | { kind: "path_complete"; nextAction: { kind: "path_complete" } };
