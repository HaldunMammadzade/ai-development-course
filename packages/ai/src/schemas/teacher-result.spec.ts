import { describe, expect, it } from "vitest";
import { AIProviderError } from "../provider/errors";
import {
  decodeTeacherJson,
  parseTeacherResult,
  parseTeacherResultJson,
  readTeacherResult,
  teacherResultSchema,
} from "./teacher-result";

function validResult() {
  return {
    speech: "Sorğu serverə gedir.",
    understanding: "partial",
    misconception: {
      code: "web.http.confuses-response",
      description: "Cavabı sorğu ilə qarışdırır.",
      conceptSlug: "web.http",
      confidence: 0.4,
    },
    skillUpdates: [{ conceptSlug: "web.http", evidence: 50, understanding: "partial" }],
    memoryNotes: [{ category: "mistake", content: "Cavabı sorğu sandı.", importance: 2 }],
    suggestedState: "comprehension_check",
    homework: null,
    cacheableExplanation: null,
  };
}

describe("teacher result schema", () => {
  it("accepts a valid result", () => {
    expect(parseTeacherResult(validResult()).speech).toBe("Sorğu serverə gedir.");
  });

  it("rejects an invalid enum, extra fields, bad confidence, and bad evidence", () => {
    expect(
      teacherResultSchema.safeParse({ ...validResult(), understanding: "great" }).success,
    ).toBe(false);
    expect(teacherResultSchema.safeParse({ ...validResult(), extra: true }).success).toBe(false);
    expect(
      teacherResultSchema.safeParse({
        ...validResult(),
        misconception: { ...validResult().misconception, confidence: 2 },
      }).success,
    ).toBe(false);
    expect(
      teacherResultSchema.safeParse({
        ...validResult(),
        skillUpdates: [{ conceptSlug: "web.http", evidence: 150, understanding: "partial" }],
      }).success,
    ).toBe(false);
  });

  it("rejects too many skill updates or memory notes", () => {
    const skillUpdates = [1, 2, 3, 4].map((index) => ({
      conceptSlug: `web.http${index}`,
      evidence: 50,
      understanding: "partial" as const,
    }));
    expect(teacherResultSchema.safeParse({ ...validResult(), skillUpdates }).success).toBe(false);
    expect(
      teacherResultSchema.safeParse({
        ...validResult(),
        memoryNotes: [
          { category: "mistake", content: "one", importance: 1 },
          { category: "learning", content: "two", importance: 1 },
          { category: "preference", content: "three", importance: 1 },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects the lesson block type as a suggested state and accepts legal states", () => {
    expect(() =>
      parseTeacherResult({ ...validResult(), suggestedState: "check_question" }),
    ).toThrow(AIProviderError);
    try {
      parseTeacherResult({ ...validResult(), suggestedState: "check_question" });
    } catch (error) {
      expect(error).toMatchObject({
        code: "invalid_response",
        failureCategory: "teacher_schema_rejection",
        httpStatus: null,
        schemaIssues: [{ path: "suggestedState", code: "invalid_value" }],
      });
      expect(JSON.stringify(error)).not.toContain("check_question");
    }
    try {
      parseTeacherResultJson("{");
    } catch (error) {
      expect(error).toMatchObject({
        code: "malformed_json",
        failureCategory: "malformed_json",
        schemaIssues: [],
      });
    }
    expect(
      parseTeacherResult({ ...validResult(), suggestedState: null }).suggestedState,
    ).toBeNull();
    expect(
      parseTeacherResult({ ...validResult(), suggestedState: "comprehension_check" })
        .suggestedState,
    ).toBe("comprehension_check");
    const recovered = readTeacherResult({ ...validResult(), suggestedState: "check_question" });
    expect(recovered.result.suggestedState).toBeNull();
    expect(recovered.recoveredIssues).toEqual([{ path: "suggestedState", code: "invalid_value" }]);
    expect(JSON.stringify(recovered)).not.toContain("check_question");
    expect(readTeacherResult(validResult()).recoveredIssues).toEqual([]);
    expect(() =>
      readTeacherResult({ ...validResult(), suggestedState: "check_question", speech: "" }),
    ).toThrow(AIProviderError);
    try {
      decodeTeacherJson("{");
    } catch (error) {
      expect(error).toMatchObject({ code: "malformed_json", failureCategory: "malformed_json" });
    }
  });

  it("rejects malformed JSON", () => {
    expect(() => parseTeacherResultJson("{")).toThrow(AIProviderError);
    expect(() => parseTeacherResultJson("{")).toThrow(/malformed JSON/);
  });
});
