import type { ExerciseRule } from "@platform/types";
import { describe, expect, it } from "vitest";
import { evaluateExercise, exerciseMasteryUpdate, EXERCISE_PASS_SCORE } from "./exercise-validator";

const choice = (optionId: string, points = 100): ExerciseRule => ({
  type: "choice_equals",
  optionId,
  points,
  feedback: "Bu variant uyğun deyil.",
});

describe("evaluateExercise", () => {
  it("accepts the authored multiple-choice option and rejects the others", () => {
    const rules = [choice("http-request")];
    expect(
      evaluateExercise({ type: "multiple_choice", rules, submission: "http-request" }),
    ).toMatchObject({
      passed: true,
      score: 100,
    });
    const wrong = evaluateExercise({ type: "multiple_choice", rules, submission: "css-file" });
    expect(wrong.passed).toBe(false);
    expect(wrong.score).toBe(0);
    expect(wrong.failedRules[0]?.feedback).toBe("Bu variant uyğun deyil.");
    expect(JSON.stringify(wrong)).not.toContain("http-request");
  });

  it("scores each authored rule and passes only at the server threshold", () => {
    const rules: ExerciseRule[] = [
      { type: "html_element_exists", tag: "a", points: 40, feedback: "a elementi lazımdır." },
      {
        type: "html_attribute_equals",
        tag: "a",
        attribute: "href",
        value: "https://example.com",
        points: 40,
        feedback: "href ünvanı tapşırıqdakı ünvana bərabər olmalıdır.",
      },
      {
        type: "contains_text",
        text: "Example",
        points: 20,
        feedback: "Görünən mətn Example olmalıdır.",
      },
    ];
    const partial = evaluateExercise({
      type: "code_text",
      rules,
      submission: '<a href="https://example.com">Link</a>',
    });
    expect(partial.score).toBe(80);
    expect(partial.passed).toBe(true);
    expect(partial.failedRules).toHaveLength(1);

    const low = evaluateExercise({
      type: "code_text",
      rules,
      submission: "<a>Example</a>",
    });
    expect(low.score).toBe(60);
    expect(low.passed).toBe(EXERCISE_PASS_SCORE <= 60);
    expect(low.passed).toBe(false);
  });

  it("checks text, regex, length, attributes, and token order without executing code", () => {
    expect(
      evaluateExercise({
        type: "code_text",
        rules: [
          { type: "exact_text", text: "sorğu", points: 1, feedback: "Tam mətn uyğun deyil." },
        ],
        submission: "sorğu",
      }).passed,
    ).toBe(true);
    expect(
      evaluateExercise({
        type: "code_text",
        rules: [
          { type: "required_text", text: "function", points: 1, feedback: "function yoxdur." },
        ],
        submission: "function add() {}",
      }).passed,
    ).toBe(true);
    expect(
      evaluateExercise({
        type: "code_text",
        rules: [
          {
            type: "regex",
            pattern: "color\\s*:\\s*#0f3d34",
            points: 1,
            feedback: "Rəng uyğun deyil.",
          },
        ],
        submission: "p { color: #0f3d34 }",
      }).passed,
    ).toBe(true);
    expect(
      evaluateExercise({
        type: "code_text",
        rules: [
          { type: "minimum_length", length: 4, points: 1, feedback: "Çox qısadır." },
          { type: "maximum_length", length: 8, points: 1, feedback: "Çox uzundur." },
        ],
        submission: "add",
      }).passed,
    ).toBe(false);
    expect(
      evaluateExercise({
        type: "code_text",
        rules: [
          {
            type: "html_attribute_exists",
            tag: "a",
            attribute: "href",
            points: 1,
            feedback: "href yoxdur.",
          },
        ],
        submission: "<a href='https://example.com'>Example</a>",
      }).passed,
    ).toBe(true);
    expect(
      evaluateExercise({
        type: "code_text",
        rules: [
          {
            type: "ordered_tokens",
            tokens: ["function", "add"],
            points: 1,
            feedback: "add funksiyası yoxdur.",
          },
          {
            type: "not_contains_text",
            text: "eval(",
            points: 1,
            feedback: "eval istifadə olunmur.",
          },
        ],
        submission: "function add(left, right) { return left; }",
      }).passed,
    ).toBe(true);
  });

  it("rejects an empty submission without treating it as a pass", () => {
    const result = evaluateExercise({
      type: "code_text",
      rules: [{ type: "contains_text", text: "a", points: 1, feedback: "missing" }],
      submission: "   ",
    });
    expect(result).toMatchObject({ passed: false, score: 0, feedback: "Cavab boşdur." });
  });
});

describe("exerciseMasteryUpdate", () => {
  it("records strong evidence for a high pass, moderate evidence for a low pass, and nothing for a fail", () => {
    expect(exerciseMasteryUpdate(100)).toEqual({ evidence: 100, weight: 1 });
    expect(exerciseMasteryUpdate(80)).toEqual({ evidence: 80, weight: 1 });
    expect(exerciseMasteryUpdate(75)).toEqual({ evidence: 75, weight: 1 });
    expect(exerciseMasteryUpdate(70)).toEqual({ evidence: 70, weight: 1 });
    expect(exerciseMasteryUpdate(69)).toBeNull();
    expect(exerciseMasteryUpdate(0)).toBeNull();
    for (const score of [100, 80, 75, 70]) {
      const update = exerciseMasteryUpdate(score);
      expect(update).not.toBeNull();
      expect(update?.evidence).toBeGreaterThanOrEqual(score >= 80 ? 80 : 45);
      expect(update?.evidence).toBeLessThanOrEqual(score >= 80 ? 100 : 75);
      expect(update?.weight).toBe(1);
    }
  });
});
