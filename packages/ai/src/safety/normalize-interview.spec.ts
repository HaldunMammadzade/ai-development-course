import { describe, expect, it } from "vitest";
import { AIProviderError } from "../provider/errors";
import { normalizeInterviewOutput } from "./normalize-interview";

const scope = { forbiddenLiterals: ["even-eight"], studentCode: "" };

function valid(extra: Record<string, unknown> = {}) {
  return {
    speech: "Element açılış və bağlanışdan ibarətdir.",
    understanding: "correct",
    evaluation: {
      strengths: ["Quruluşu izah etdi."],
      issues: [],
      reasoningQuality: "strong",
    },
    followUpRecommended: false,
    feedback: "Əsas fikir görünür.",
    ...extra,
  };
}

describe("interview normalization", () => {
  it("drops score, mastery, and question-control fields", () => {
    const result = normalizeInterviewOutput(
      valid({
        score: 100,
        mastery: 99,
        nextQuestionIntent: "finish",
        nextQuestion: "attributes",
        completed: true,
        hiddenTests: ["even-eight"],
        concepts: ["js.value"],
      }),
      { ...scope, forbiddenLiterals: [] },
    );
    expect(result).not.toHaveProperty("score");
    expect(result).not.toHaveProperty("mastery");
    expect(result).not.toHaveProperty("nextQuestionIntent");
    expect(result.understanding).toBe("correct");
  });

  it("rejects leaked secrets, hidden tests, the solution, and a senior claim", () => {
    expect(
      failure(() => normalizeInterviewOutput(valid({ speech: "sk-secret" }), scope)),
    ).toMatchObject({
      failureCategory: "internal_leak_rejection",
      httpStatus: null,
    });
    expect(
      JSON.stringify(
        failure(() => normalizeInterviewOutput(valid({ speech: "sk-secret" }), scope)),
      ),
    ).not.toContain("sk-secret");
    expect(
      failure(() => normalizeInterviewOutput(valid({ speech: "interview.v1" }), scope))
        .failureCategory,
    ).toBe("internal_leak_rejection");
    expect(
      failure(() => normalizeInterviewOutput(valid({ feedback: "even-eight" }), scope))
        .failureCategory,
    ).toBe("internal_leak_rejection");
    expect(
      failure(() => normalizeInterviewOutput(valid({ speech: "return n % 2 === 0" }), scope))
        .failureCategory,
    ).toBe("full_solution_rejection");
    expect(
      failure(() =>
        normalizeInterviewOutput(valid({ speech: "You are ready for a senior role" }), scope),
      ).failureCategory,
    ).toBe("internal_leak_rejection");
  });

  it("allows the solution text only when the student already wrote it", () => {
    const speech = "Sizin return n % 2 === 0 ifadəniz cütlüyü yoxlayır.";
    expect(() => normalizeInterviewOutput(valid({ speech }), scope)).toThrow(AIProviderError);
    expect(
      normalizeInterviewOutput(valid({ speech }), {
        ...scope,
        studentCode: "return n % 2 === 0",
        forbiddenLiterals: [],
      }).speech,
    ).toContain("cütlüyü");
  });

  it("rejects malformed output and bounds lists", () => {
    expect(failure(() => normalizeInterviewOutput({ speech: "ok" }, scope))).toMatchObject({
      failureCategory: "schema_rejection",
      schemaIssues: [{ path: "evaluation", code: "invalid_type" }],
    });
    expect(
      JSON.stringify(failure(() => normalizeInterviewOutput({ speech: "ok" }, scope))),
    ).not.toContain("ok");
    expect(
      failure(() => normalizeInterviewOutput(valid({ understanding: "perfect" }), scope))
        .schemaIssues,
    ).toEqual([{ path: "understanding", code: "invalid_value" }]);
    const long = normalizeInterviewOutput(
      valid({
        speech: "a".repeat(2000),
        evaluation: {
          strengths: ["one", "two", "three", "four", "five"],
          issues: ["issue"],
          reasoningQuality: "developing",
        },
      }),
      scope,
    );
    expect(long.speech).toHaveLength(800);
    expect(long.evaluation.strengths).toHaveLength(4);
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
