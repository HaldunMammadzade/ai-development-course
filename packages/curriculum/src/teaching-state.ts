import type { TeachingState, Understanding } from "@platform/types";

export interface TeachingLessonContext {
  hasRemainingCheckQuestion: boolean;
  hasHarderCheck: boolean;
  recapSummarized: boolean;
  homeworkPersisted: boolean;
}

export interface TeachingReviewContext {
  active: boolean;
  focusValid: boolean;
}

export interface TeachingTransitionInput {
  state: TeachingState;
  mode: "explain" | "socratic";
  understanding: Understanding;
  suggestedState?: TeachingState;
  abandon?: boolean;
  hintCount: number;
  incorrectEvaluations: number;
  lesson: TeachingLessonContext;
  review?: TeachingReviewContext;
}

export interface TeachingTransitionResult {
  state: TeachingState;
  forced: boolean;
  suggestionAccepted: boolean;
}

const OPEN_STATES: readonly TeachingState[] = [
  "created",
  "prior_check",
  "objective",
  "explain",
  "comprehension_check",
  "adapt",
  "exercise",
  "evaluate",
  "hint",
  "raise_difficulty",
  "summarize",
  "homework",
];

export function isOpenTeachingState(state: TeachingState): boolean {
  return OPEN_STATES.includes(state);
}

export function resolveTeachingTransition(
  input: TeachingTransitionInput,
): TeachingTransitionResult {
  if (
    input.state === "completed" ||
    input.state === "abandoned" ||
    input.state === "review_completed"
  ) {
    return { state: input.state, forced: true, suggestionAccepted: false };
  }
  if (input.abandon === true) {
    return {
      state: "abandoned",
      forced: true,
      suggestionAccepted: input.suggestedState === "abandoned",
    };
  }

  return capReview(input, resolveOpenTransition(input));
}

function resolveOpenTransition(input: TeachingTransitionInput): TeachingTransitionResult {
  const forced = forcedTarget(input);
  if (forced !== null) {
    return {
      state: forced,
      forced: true,
      suggestionAccepted: input.suggestedState === forced,
    };
  }
  const choices = choiceTargets(input);
  if (input.suggestedState !== undefined && choices.includes(input.suggestedState)) {
    return { state: input.suggestedState, forced: false, suggestionAccepted: true };
  }
  return {
    state: defaultChoice(input),
    forced: false,
    suggestionAccepted: false,
  };
}

const LESSON_EXIT = new Set<TeachingState>([
  "exercise",
  "evaluate",
  "raise_difficulty",
  "summarize",
  "homework",
  "completed",
]);

function capReview(
  input: TeachingTransitionInput,
  result: TeachingTransitionResult,
): TeachingTransitionResult {
  if (input.review?.active !== true || !LESSON_EXIT.has(result.state)) {
    return result;
  }
  const correctCheck =
    input.state === "comprehension_check" && input.understanding === "correct";
  const pastCheck =
    input.state === "exercise" ||
    input.state === "evaluate" ||
    input.state === "raise_difficulty" ||
    input.state === "summarize" ||
    input.state === "homework" ||
    result.state === "summarize" ||
    result.state === "homework" ||
    result.state === "completed";
  if (input.review.focusValid && (correctCheck || pastCheck)) {
    return { state: "review_completed", forced: true, suggestionAccepted: false };
  }
  return { state: input.state, forced: true, suggestionAccepted: false };
}

function forcedTarget(input: TeachingTransitionInput): TeachingState | null {
  switch (input.state) {
    case "created":
      return "prior_check";
    case "prior_check":
      return canSkipExplain(input) ? null : "objective";
    case "objective":
      return "explain";
    case "explain":
      return "comprehension_check";
    case "comprehension_check":
      return comprehensionTarget(input);
    case "adapt":
      return "comprehension_check";
    case "exercise":
      return input.lesson.hasRemainingCheckQuestion ? "evaluate" : "summarize";
    case "evaluate":
      return evaluateTarget(input);
    case "hint":
      return "evaluate";
    case "raise_difficulty":
      return "evaluate";
    case "summarize":
      return "homework";
    case "homework":
      return input.lesson.recapSummarized && input.lesson.homeworkPersisted
        ? "completed"
        : "homework";
    case "completed":
    case "review_completed":
    case "abandoned":
      return input.state;
    default:
      return input.state;
  }
}

function choiceTargets(input: TeachingTransitionInput): TeachingState[] {
  if (input.state === "prior_check" && canSkipExplain(input)) {
    return ["comprehension_check", "objective", "abandoned"];
  }
  if (
    input.state === "evaluate" &&
    input.understanding === "correct" &&
    input.lesson.hasHarderCheck
  ) {
    return ["summarize", "raise_difficulty", "abandoned"];
  }
  return ["abandoned"];
}

function defaultChoice(input: TeachingTransitionInput): TeachingState {
  if (input.state === "prior_check") {
    return "comprehension_check";
  }
  return "summarize";
}

function canSkipExplain(input: TeachingTransitionInput): boolean {
  return input.mode === "socratic" && input.understanding === "correct";
}

function comprehensionTarget(input: TeachingTransitionInput): TeachingState {
  if (input.understanding === "unknown") {
    return "comprehension_check";
  }
  if (input.understanding === "incorrect" || input.understanding === "partial") {
    return "adapt";
  }
  return input.lesson.hasRemainingCheckQuestion ? "exercise" : "summarize";
}

function evaluateTarget(input: TeachingTransitionInput): TeachingState | null {
  if (input.understanding === "unknown") {
    return "evaluate";
  }
  if (input.understanding === "incorrect" || input.understanding === "partial") {
    const failuresAfterThis = input.incorrectEvaluations + 1;
    if (input.hintCount >= 2 || failuresAfterThis >= 2) {
      return "adapt";
    }
    return "hint";
  }
  if (input.lesson.hasHarderCheck) {
    return null;
  }
  return "summarize";
}
