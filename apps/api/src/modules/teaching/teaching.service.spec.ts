import { describe, expect, it } from "vitest";
import { TeachingService } from "./teaching.service";

describe("TeachingService", () => {
  it("ignores a model suggestion that is not a legal transition", () => {
    const service = new TeachingService();
    expect(
      service.resolve({
        state: "explain",
        mode: "explain",
        understanding: "unknown",
        suggestedState: "completed",
        hintCount: 0,
        incorrectEvaluations: 0,
        lesson: {
          hasRemainingCheckQuestion: true,
          hasHarderCheck: false,
          recapSummarized: false,
          homeworkPersisted: false,
        },
      }).state,
    ).toBe("comprehension_check");
  });
});
