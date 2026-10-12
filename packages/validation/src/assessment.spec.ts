import { describe, expect, it } from "vitest";
import { assessmentAnswerSchema } from "./assessment";

describe("assessment answer schema", () => {
  it("rejects a client path, completion, mastery, or start lesson", () => {
    const parsed = assessmentAnswerSchema.safeParse({
      itemId: "request",
      answer: "option-a",
      clientAttemptId: "00000000-0000-4000-8000-000000000000",
      path: ["components-and-props"],
      completion: true,
      mastery: 100,
      startLessonSlug: "components-and-props",
    });
    expect(parsed.success).toBe(false);
  });
});
