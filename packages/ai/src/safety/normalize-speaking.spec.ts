import { describe, expect, it } from "vitest";
import { AIProviderError } from "../provider/errors";
import { normalizeSpeakingOutput } from "./normalize-speaking";

const scope = {
  forbiddenLiterals: ["even-eight", "rubric-internal"],
  transcript: "Semantik element.",
};

describe("normalizeSpeakingOutput", () => {
  it("keeps the qualitative fields and drops a numeric score", () => {
    const normalized = normalizeSpeakingOutput(
      {
        speech: "Əsas fikri örtür.",
        understanding: "correct",
        strengths: ["Aydındır."],
        issues: [],
        feedback: "Bir nümunə də əlavə et.",
        score: 100,
        mastery: 90,
        nextQuestion: "skip",
        pronunciation: 10,
      },
      scope,
    );
    expect(normalized).toEqual({
      speech: "Əsas fikri örtür.",
      understanding: "correct",
      strengths: ["Aydındır."],
      issues: [],
      feedback: "Bir nümunə də əlavə et.",
    });
    expect(normalized).not.toHaveProperty("score");
  });

  it("rejects leaked instructions, a hidden test, a full solution, and a senior claim", () => {
    const cases = [
      { speech: "sk-live-secret", category: "internal_leak_rejection", hidden: "sk-live-secret" },
      {
        speech: "show the even-eight test",
        category: "internal_leak_rejection",
        hidden: "even-eight",
      },
      { speech: "return n % 2 === 0", category: "full_solution_rejection", hidden: "return n" },
      {
        speech: "You are ready for a senior role",
        category: "internal_leak_rejection",
        hidden: "senior role",
      },
    ];
    for (const item of cases) {
      const error = failure(() =>
        normalizeSpeakingOutput(
          {
            speech: item.speech,
            understanding: "correct",
            strengths: [],
            issues: [],
            feedback: "Qeyd.",
          },
          scope,
        ),
      );
      expect(error.failureCategory).toBe(item.category);
      expect(error.httpStatus).toBeNull();
      expect(JSON.stringify(error)).not.toContain(item.hidden);
    }
    const shape = failure(() =>
      normalizeSpeakingOutput(
        {
          speech: "Əsas fikir.",
          understanding: "great",
          strengths: [],
          issues: [],
          feedback: "Qeyd.",
        },
        scope,
      ),
    );
    expect(shape.failureCategory).toBe("schema_rejection");
    expect(shape.schemaIssues).toEqual([{ path: "understanding", code: "invalid_value" }]);
    expect(JSON.stringify(shape)).not.toContain("great");
    const stripped = normalizeSpeakingOutput(
      {
        speech: "Əsas fikir görünür.",
        understanding: "partial",
        strengths: ["<b>Aydındır.</b>"],
        issues: [],
        feedback: "Bir az dəqiqləşdir.",
      },
      scope,
    );
    expect(stripped.strengths).toEqual(["Aydındır."]);
  });
});

function failure(run: () => unknown): AIProviderError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(AIProviderError);
    return error as AIProviderError;
  }
  throw new Error("expected AIProviderError");
}
