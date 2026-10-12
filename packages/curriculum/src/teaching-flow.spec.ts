import type { LessonBlock } from "@platform/types";
import { describe, expect, it } from "vitest";
import { hasRemainingCheckQuestion, lessonHasHarderCheck } from "./graph";
import { resolveTeachingTransition } from "./teaching-state";
import {
  advanceTeachingProgress,
  currentTeachingBlock,
  initialTeachingProgress,
  publicLessonBlock,
  teachingTurnNeedsAnswer,
} from "./teaching-flow";

const blocks: LessonBlock[] = [
  { type: "reading", position: 1, markdown: "HTTP sorğusu", conceptSlugs: ["web.http"] },
  {
    type: "check_question",
    position: 2,
    prompt: "Nə baş verir?",
    rubric: ["Sorğu gedir"],
    conceptSlugs: ["web.http"],
    difficulty: "beginner",
  },
  { type: "recap", position: 3, points: ["Sorğu"], practicePrompt: "İzah et." },
];

describe("teaching flow helpers", () => {
  it("shows the reading, then the check, then the recap", () => {
    expect(currentTeachingBlock(blocks, "explain", []).type).toBe("reading");
    expect(currentTeachingBlock(blocks, "evaluate", []).type).toBe("check_question");
    expect(currentTeachingBlock(blocks, "summarize", []).type).toBe("recap");
    const focused: LessonBlock[] = [
      ...blocks,
      {
        type: "check_question",
        position: 4,
        prompt: "Brauzer nə edir?",
        rubric: ["Gizli"],
        conceptSlugs: ["web.browser"],
        difficulty: "beginner",
      },
      { type: "reading", position: 5, markdown: "Brauzer", conceptSlugs: ["web.browser"] },
    ];
    expect(currentTeachingBlock(focused, "comprehension_check", [], "web.browser").type).toBe(
      "check_question",
    );
    expect(
      currentTeachingBlock(focused, "comprehension_check", [], "web.browser"),
    ).toMatchObject({ prompt: "Brauzer nə edir?" });
    expect(currentTeachingBlock(focused, "review_completed", [], "web.browser").type).not.toBe(
      "recap",
    );
    expect(publicLessonBlock(currentTeachingBlock(focused, "comprehension_check", [], "web.browser"))).not.toHaveProperty(
      "rubric",
    );
    const check = blocks.find((block) => block.type === "check_question");
    expect(check).toBeDefined();
    if (check !== undefined) {
      expect(publicLessonBlock(check)).toEqual({
        type: "check_question",
        position: 2,
        prompt: "Nə baş verir?",
      });
    }
  });

  it("requires an answer only on check states", () => {
    expect(teachingTurnNeedsAnswer("evaluate")).toBe(true);
    expect(teachingTurnNeedsAnswer("explain")).toBe(false);
  });

  it("counts hints and then adapts without trusting a completed suggestion", () => {
    const lesson = {
      hasRemainingCheckQuestion: hasRemainingCheckQuestion(blocks, new Set()),
      hasHarderCheck: lessonHasHarderCheck(blocks),
      recapSummarized: false,
      homeworkPersisted: false,
    };
    const hinted = resolveTeachingTransition({
      state: "evaluate",
      mode: "explain",
      understanding: "incorrect",
      suggestedState: "completed",
      hintCount: 0,
      incorrectEvaluations: 0,
      lesson,
    });
    expect(hinted.state).toBe("hint");
    const marks = advanceTeachingProgress({
      marks: initialTeachingProgress(),
      from: "evaluate",
      to: hinted.state,
      understanding: "incorrect",
      checkPosition: 2,
    });
    expect(marks.hintCount).toBe(1);
    expect(marks.incorrectEvaluations).toBe(1);
    const adapted = resolveTeachingTransition({
      state: "evaluate",
      mode: "explain",
      understanding: "incorrect",
      suggestedState: "hint",
      hintCount: marks.hintCount,
      incorrectEvaluations: marks.incorrectEvaluations,
      lesson,
    });
    expect(adapted.state).toBe("adapt");
  });
});
