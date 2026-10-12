import type { TeachingState } from "@platform/types";
import { describe, expect, it } from "vitest";
import {
  isOpenTeachingState,
  resolveTeachingTransition,
  type TeachingLessonContext,
  type TeachingTransitionInput,
} from "./teaching-state";

const lesson: TeachingLessonContext = {
  hasRemainingCheckQuestion: true,
  hasHarderCheck: false,
  recapSummarized: false,
  homeworkPersisted: false,
};

function input(
  overrides: Partial<TeachingTransitionInput> & Pick<TeachingTransitionInput, "state">,
): TeachingTransitionInput {
  return {
    mode: "explain",
    understanding: "unknown",
    hintCount: 0,
    incorrectEvaluations: 0,
    lesson,
    ...overrides,
  };
}

describe("teaching state machine", () => {
  it("walks the forced lesson path", () => {
    expect(resolveTeachingTransition(input({ state: "created" })).state).toBe("prior_check");
    expect(
      resolveTeachingTransition(input({ state: "prior_check", understanding: "incorrect" })).state,
    ).toBe("objective");
    expect(resolveTeachingTransition(input({ state: "objective" })).state).toBe("explain");
    expect(
      resolveTeachingTransition(input({ state: "explain", suggestedState: "explain" })).state,
    ).toBe("comprehension_check");
    expect(
      resolveTeachingTransition(
        input({
          state: "comprehension_check",
          understanding: "correct",
          lesson: { ...lesson, hasRemainingCheckQuestion: true },
        }),
      ).state,
    ).toBe("exercise");
    expect(resolveTeachingTransition(input({ state: "exercise" })).state).toBe("evaluate");
    expect(
      resolveTeachingTransition(input({ state: "evaluate", understanding: "correct" })).state,
    ).toBe("summarize");
    expect(
      resolveTeachingTransition(input({ state: "summarize", suggestedState: "completed" })).state,
    ).toBe("homework");
    expect(
      resolveTeachingTransition(
        input({
          state: "homework",
          lesson: { ...lesson, recapSummarized: true, homeworkPersisted: true },
          suggestedState: "abandoned",
        }),
      ).state,
    ).toBe("completed");
  });

  it("lets a correct Socratic prior check skip explain", () => {
    const correct = input({ state: "prior_check", mode: "socratic", understanding: "correct" });
    expect(resolveTeachingTransition(correct).state).toBe("comprehension_check");
    expect(resolveTeachingTransition({ ...correct, suggestedState: "objective" }).state).toBe(
      "objective",
    );
    expect(resolveTeachingTransition({ ...correct, suggestedState: "explain" }).state).toBe(
      "comprehension_check",
    );
    expect(
      resolveTeachingTransition(
        input({ state: "prior_check", mode: "socratic", understanding: "unknown" }),
      ).state,
    ).toBe("objective");
    expect(
      resolveTeachingTransition(
        input({ state: "prior_check", mode: "explain", understanding: "correct" }),
      ).state,
    ).toBe("objective");
  });

  it("uses the recap fallback when no authored check remains", () => {
    expect(
      resolveTeachingTransition(
        input({
          state: "exercise",
          lesson: { ...lesson, hasRemainingCheckQuestion: false },
          suggestedState: "evaluate",
        }),
      ).state,
    ).toBe("summarize");
    expect(
      resolveTeachingTransition(
        input({
          state: "comprehension_check",
          understanding: "correct",
          lesson: { ...lesson, hasRemainingCheckQuestion: false },
        }),
      ).state,
    ).toBe("summarize");
  });

  it("hints once, then adapts on the second incorrect evaluation", () => {
    expect(
      resolveTeachingTransition(input({ state: "evaluate", understanding: "incorrect" })).state,
    ).toBe("hint");
    expect(
      resolveTeachingTransition(
        input({ state: "evaluate", understanding: "partial", incorrectEvaluations: 1 }),
      ).state,
    ).toBe("adapt");
    expect(
      resolveTeachingTransition(
        input({
          state: "evaluate",
          understanding: "incorrect",
          hintCount: 2,
          suggestedState: "hint",
        }),
      ).state,
    ).toBe("adapt");
    expect(resolveTeachingTransition(input({ state: "hint" })).state).toBe("evaluate");
    expect(resolveTeachingTransition(input({ state: "adapt" })).state).toBe("comprehension_check");
  });

  it("allows raise_difficulty only after a successful evaluation with a harder check", () => {
    const ready = input({
      state: "evaluate",
      understanding: "correct",
      lesson: { ...lesson, hasHarderCheck: true },
    });
    expect(resolveTeachingTransition(ready).state).toBe("summarize");
    expect(resolveTeachingTransition({ ...ready, suggestedState: "raise_difficulty" }).state).toBe(
      "raise_difficulty",
    );
    expect(
      resolveTeachingTransition(
        input({ state: "evaluate", understanding: "correct", suggestedState: "raise_difficulty" }),
      ).state,
    ).toBe("summarize");
    expect(resolveTeachingTransition(input({ state: "raise_difficulty" })).state).toBe("evaluate");
  });

  it("refuses completion until recap and homework are stored", () => {
    expect(
      resolveTeachingTransition(input({ state: "homework", suggestedState: "completed" })).state,
    ).toBe("homework");
    expect(
      resolveTeachingTransition(input({ state: "completed", suggestedState: "abandoned" })).state,
    ).toBe("completed");
    expect(resolveTeachingTransition(input({ state: "abandoned", abandon: true })).state).toBe(
      "abandoned",
    );
  });

  it("abandons from every open state and ignores illegal jumps", () => {
    const open: TeachingState[] = [
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
    for (const state of open) {
      expect(isOpenTeachingState(state)).toBe(true);
      expect(resolveTeachingTransition(input({ state, abandon: true })).state).toBe("abandoned");
      expect(
        resolveTeachingTransition(input({ state, suggestedState: "completed" })).state,
      ).not.toBe("completed");
    }
    expect(
      resolveTeachingTransition(input({ state: "created", suggestedState: "explain" })).state,
    ).toBe("prior_check");
    expect(
      resolveTeachingTransition(
        input({
          state: "comprehension_check",
          understanding: "incorrect",
          suggestedState: "exercise",
        }),
      ).state,
    ).toBe("adapt");
    expect(
      resolveTeachingTransition(
        input({ state: "evaluate", understanding: "incorrect", suggestedState: "summarize" }),
      ).state,
    ).toBe("hint");
  });

  it("finishes a valid review only after a correct comprehension check", () => {
    const review = { active: true, focusValid: true };
    expect(
      resolveTeachingTransition(
        input({
          state: "comprehension_check",
          understanding: "correct",
          suggestedState: "completed",
          review,
        }),
      ).state,
    ).toBe("review_completed");
    expect(
      resolveTeachingTransition(
        input({
          state: "comprehension_check",
          understanding: "incorrect",
          suggestedState: "completed",
          review,
        }),
      ).state,
    ).toBe("adapt");
    expect(
      resolveTeachingTransition(
        input({
          state: "comprehension_check",
          understanding: "partial",
          suggestedState: "completed",
          review,
        }),
      ).state,
    ).toBe("adapt");
    expect(
      resolveTeachingTransition(
        input({
          state: "comprehension_check",
          understanding: "unknown",
          suggestedState: "completed",
          review,
        }),
      ).state,
    ).toBe("comprehension_check");
    expect(
      resolveTeachingTransition(
        input({
          state: "explain",
          suggestedState: "completed",
          review,
        }),
      ).state,
    ).toBe("comprehension_check");
    expect(isOpenTeachingState("review_completed")).toBe(false);
    expect(
      resolveTeachingTransition(
        input({ state: "review_completed", suggestedState: "explain", review }),
      ).state,
    ).toBe("review_completed");
    expect(
      resolveTeachingTransition(
        input({
          state: "summarize",
          suggestedState: "homework",
          review,
        }),
      ).state,
    ).toBe("review_completed");
  });

  it("does not finish a review when the stored focus is missing or stale", () => {
    const stale = { active: true, focusValid: false };
    expect(
      resolveTeachingTransition(
        input({
          state: "comprehension_check",
          understanding: "correct",
          suggestedState: "completed",
          review: stale,
        }),
      ).state,
    ).toBe("comprehension_check");
    expect(
      resolveTeachingTransition(
        input({ state: "summarize", suggestedState: "completed", review: stale }),
      ).state,
    ).not.toBe("completed");
    expect(
      resolveTeachingTransition(
        input({ state: "summarize", suggestedState: "completed", review: stale }),
      ).state,
    ).not.toBe("review_completed");
    expect(
      resolveTeachingTransition(
        input({
          state: "comprehension_check",
          understanding: "correct",
          suggestedState: "completed",
        }),
      ).state,
    ).toBe("exercise");
  });
});
