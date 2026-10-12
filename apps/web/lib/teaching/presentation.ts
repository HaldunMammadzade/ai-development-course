import { TEACHING_STUDENT_MESSAGE_MAX_CHARS } from "@platform/validation";
import { isOpenTeachingState, teachingTurnNeedsAnswer } from "@platform/curriculum";
import type { NextAction, PublicLessonBlock, TeachingState } from "@platform/types";
import { copy } from "@/lib/copy";

export type ComposerMode = "answer" | "advance" | "homework" | "closed" | "done";

export function composerMode(state: TeachingState): ComposerMode {
  if (state === "abandoned") {
    return "closed";
  }
  if (state === "completed" || state === "review_completed") {
    return "done";
  }
  if (state === "homework") {
    return "homework";
  }
  if (teachingTurnNeedsAnswer(state)) {
    return "answer";
  }
  if (isOpenTeachingState(state)) {
    return "advance";
  }
  return "closed";
}

export function stateLabel(state: TeachingState): string {
  return copy.teacher.phase[state];
}

export function advanceLabel(state: TeachingState): string {
  if (state === "created") {
    return copy.teacher.begin;
  }
  if (state === "homework") {
    return copy.teacher.finishLesson;
  }
  return copy.teacher.advance;
}

export function composerIssue(value: string): "empty" | "too_long" | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return "empty";
  }
  if (trimmed.length > TEACHING_STUDENT_MESSAGE_MAX_CHARS) {
    return "too_long";
  }
  return null;
}

export function lessonBlockText(block: PublicLessonBlock): string {
  if (block.type === "reading") {
    return block.markdown;
  }
  if (block.type === "check_question") {
    return block.prompt;
  }
  return [...block.points, block.practicePrompt].filter((line) => line.length > 0).join("\n");
}

export function actionLabel(action: NextAction): string {
  return copy.actions[action.kind];
}

export const STUDENT_MESSAGE_MAX = TEACHING_STUDENT_MESSAGE_MAX_CHARS;
