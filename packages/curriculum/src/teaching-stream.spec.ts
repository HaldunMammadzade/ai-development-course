import type { TeachingTurnResponse } from "@platform/types";
import { describe, expect, it } from "vitest";
import { completedTeachingEvents, teachingErrorEvent } from "./teaching-stream";

const turn = {
  session: {
    id: "session-1",
    lessonSlug: "how-the-web-delivers-a-page",
    lessonTitle: "Brauzer səhifəni necə alır",
    mode: "explain",
    state: "prior_check",
    turnNumber: 1,
    completed: false,
  },
  teacher: { message: "Sorğu serverə gedir.", understanding: "unknown" },
  learning: {
    updatedConcepts: [],
    mastery: [],
    nextAction: {
      kind: "continue_lesson",
      sessionId: "session-1",
      lessonId: "lesson-1",
      title: "Brauzer səhifəni necə alır",
    },
  },
  usage: { turnConsumed: true },
  block: { type: "reading", position: 1, markdown: "..." },
  homework: null,
} satisfies TeachingTurnResponse;

describe("teaching stream contract", () => {
  it("wraps a finished JSON turn as started then completed", () => {
    expect(completedTeachingEvents(turn).map((event) => event.type)).toEqual([
      "teacher.started",
      "teacher.completed",
    ]);
  });

  it("keeps an error event free of provider detail", () => {
    expect(teachingErrorEvent("AI_UNAVAILABLE", "The teacher is temporarily unavailable.")).toEqual(
      {
        type: "teacher.error",
        code: "AI_UNAVAILABLE",
        message: "The teacher is temporarily unavailable.",
      },
    );
  });
});
