import type { LessonBlock, PublicLessonBlock, TeachingState, Understanding } from "@platform/types";

export interface TeachingProgressMarks {
  hintCount: number;
  incorrectEvaluations: number;
  usedCheckPositions: number[];
  recapSummarized: boolean;
  homeworkPersisted: boolean;
}

const ANSWER_STATES = new Set<TeachingState>(["prior_check", "comprehension_check", "evaluate"]);

const RECAP_STATES = new Set<TeachingState>(["summarize", "homework", "completed", "abandoned"]);

const QUESTION_STATES = new Set<TeachingState>([
  "prior_check",
  "comprehension_check",
  "exercise",
  "evaluate",
]);

export function initialTeachingProgress(): TeachingProgressMarks {
  return {
    hintCount: 0,
    incorrectEvaluations: 0,
    usedCheckPositions: [],
    recapSummarized: false,
    homeworkPersisted: false,
  };
}

export function teachingTurnNeedsAnswer(state: TeachingState): boolean {
  return ANSWER_STATES.has(state);
}

export function currentTeachingBlock(
  blocks: readonly LessonBlock[],
  state: TeachingState,
  usedCheckPositions: readonly number[],
  reviewConceptSlug?: string | null,
): LessonBlock {
  const sorted = [...blocks].sort((left, right) => left.position - right.position);
  const fallback = sorted[0];
  if (fallback === undefined) {
    throw new Error("Lesson has no blocks.");
  }
  const reading = sorted.find((block) => block.type === "reading");
  const recap = sorted.find((block) => block.type === "recap");
  const checks = sorted.filter((block) => block.type === "check_question");
  const used = new Set(usedCheckPositions);
  const nextCheck = checks.find((block) => !used.has(block.position)) ?? checks.at(-1);

  if (reviewConceptSlug) {
    const focusedChecks = checks.filter((block) => block.conceptSlugs.includes(reviewConceptSlug));
    const focusedCheck =
      focusedChecks.find((block) => !used.has(block.position)) ?? focusedChecks.at(-1);
    const focusedReading = sorted.find(
      (block) => block.type === "reading" && block.conceptSlugs.includes(reviewConceptSlug),
    );
    if (QUESTION_STATES.has(state)) {
      return focusedCheck ?? focusedReading ?? nextCheck ?? reading ?? fallback;
    }
    return focusedReading ?? reading ?? fallback;
  }

  if (RECAP_STATES.has(state)) {
    return recap ?? fallback;
  }
  if (QUESTION_STATES.has(state)) {
    return nextCheck ?? reading ?? fallback;
  }
  return reading ?? fallback;
}

export function publicLessonBlock(block: LessonBlock): PublicLessonBlock {
  if (block.type === "reading") {
    return { type: "reading", position: block.position, markdown: block.markdown };
  }
  if (block.type === "check_question") {
    return { type: "check_question", position: block.position, prompt: block.prompt };
  }
  return {
    type: "recap",
    position: block.position,
    points: block.points,
    practicePrompt: block.practicePrompt,
  };
}

export function advanceTeachingProgress(input: {
  marks: TeachingProgressMarks;
  from: TeachingState;
  to: TeachingState;
  understanding: Understanding;
  checkPosition: number | null;
}): TeachingProgressMarks {
  const used = new Set(input.marks.usedCheckPositions);
  let hintCount = input.marks.hintCount;
  let incorrectEvaluations = input.marks.incorrectEvaluations;
  if (
    input.from === "evaluate" &&
    (input.understanding === "incorrect" || input.understanding === "partial")
  ) {
    incorrectEvaluations += 1;
  }
  if (input.to === "hint") {
    hintCount += 1;
  }
  if (
    input.from === "evaluate" &&
    input.understanding === "correct" &&
    input.checkPosition !== null
  ) {
    used.add(input.checkPosition);
  }
  if (input.from === "adapt") {
    hintCount = 0;
    incorrectEvaluations = 0;
  }
  return {
    hintCount,
    incorrectEvaluations,
    usedCheckPositions: [...used].sort((left, right) => left - right),
    recapSummarized:
      input.marks.recapSummarized || input.from === "summarize" || input.to === "completed",
    homeworkPersisted: input.marks.homeworkPersisted,
  };
}
