import { evidenceWeight } from "@platform/curriculum";
import { describe, expect, it } from "vitest";
import { AIProviderError } from "../provider/errors";
import {
  normalizeTeacherOutput,
  normalizeTeacherTurn,
  type TeacherNormalizationScope,
} from "./normalize-teacher-result";

const scope: TeacherNormalizationScope = {
  allowedConceptSlugs: new Set(["web.http", "web.browser", "web.url"]),
  state: "explain",
  mode: "explain",
  hintCount: 0,
  incorrectEvaluations: 0,
  lesson: {
    hasRemainingCheckQuestion: true,
    hasHarderCheck: false,
    recapSummarized: false,
    homeworkPersisted: false,
  },
  allowCache: false,
  studentName: "Aysel",
  locale: "az-AZ",
  explanationStyle: "clear",
};

function proposal(overrides: Record<string, unknown> = {}) {
  return {
    speech: "Sorğu göndərilir.",
    understanding: "incorrect",
    misconception: null,
    skillUpdates: [{ conceptSlug: "web.http", evidence: 10, understanding: "incorrect" }],
    memoryNotes: [{ category: "mistake", content: "Cavabı qarışdırdı.", importance: 2 }],
    suggestedState: "completed",
    homework: "Ev tapşırığı",
    cacheableExplanation: {
      conceptSlug: "web.http",
      difficulty: "beginner",
      speech: "HTTP sorğu və cavabdır.",
    },
    ...overrides,
  };
}

describe("teacher output normalization", () => {
  it("drops out-of-scope concepts, clamps evidence, and ignores model weights and ids", () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    const accepted = normalizeTeacherOutput(
      proposal({
        userId,
        lessonId: userId,
        lessonCompleted: true,
        unlockLesson: userId,
        nextLessonId: userId,
        apiKey: "sk-hidden",
        secret: "hidden",
        skillUpdates: [
          {
            conceptSlug: "web.http",
            evidence: 10,
            understanding: "incorrect",
            weight: 99,
            mastery: 100,
            score: 100,
            userId,
          },
          { conceptSlug: "html.forms", evidence: 90, understanding: "correct" },
          { conceptSlug: userId, evidence: 80, understanding: "correct" },
        ],
      }),
      scope,
    );

    expect(accepted.skillUpdates).toEqual([
      {
        conceptSlug: "web.http",
        understanding: "incorrect",
        evidence: 10,
        weight: evidenceWeight("lesson_check", "incorrect"),
      },
    ]);
    expect(JSON.stringify(accepted)).not.toContain("99");
    expect(JSON.stringify(accepted)).not.toContain(userId);
    expect(JSON.stringify(accepted)).not.toContain("lessonCompleted");
    expect(JSON.stringify(accepted)).not.toContain("unlockLesson");
    expect(JSON.stringify(accepted)).not.toContain("apiKey");
    expect(JSON.stringify(accepted)).not.toContain("html.forms");
    expect(accepted.suggestionAccepted).toBe(false);
    expect(accepted.state).toBe("comprehension_check");
    expect(accepted.homework).toBeNull();
    expect(accepted.cacheableExplanation).toBeNull();
  });

  it("keeps at most three skill updates and two memory notes", () => {
    const accepted = normalizeTeacherOutput(
      proposal({
        understanding: "partial",
        skillUpdates: [
          { conceptSlug: "web.http", evidence: 50, understanding: "partial" },
          { conceptSlug: "web.browser", evidence: 60, understanding: "partial" },
          { conceptSlug: "web.url", evidence: 55, understanding: "partial" },
          { conceptSlug: "web.http", evidence: 70, understanding: "partial" },
        ],
        memoryNotes: [
          { category: "mistake", content: "one", importance: 1 },
          { category: "learning", content: "two", importance: 2 },
          { category: "preference", content: "three", importance: 3 },
        ],
      }),
      scope,
    );

    expect(accepted.skillUpdates.map((item) => item.conceptSlug)).toEqual([
      "web.http",
      "web.browser",
      "web.url",
    ]);
    expect(accepted.memoryNotes.map((note) => note.content)).toEqual(["one", "two"]);
  });

  it("clamps correct evidence into the server band", () => {
    const accepted = normalizeTeacherOutput(
      proposal({
        understanding: "correct",
        skillUpdates: [{ conceptSlug: "web.http", evidence: 10, understanding: "correct" }],
      }),
      scope,
    );
    expect(accepted.skillUpdates[0]?.evidence).toBe(80);
  });

  it("drops an invalid suggested state and keeps the server transition", () => {
    const recovered = normalizeTeacherTurn(proposal({ suggestedState: "check_question" }), scope);
    expect(recovered.recoveredIssues).toEqual([{ path: "suggestedState", code: "invalid_value" }]);
    expect(recovered.accepted.state).toBe("comprehension_check");
    expect(recovered.accepted.suggestionAccepted).toBe(false);
    expect(JSON.stringify(recovered)).not.toContain("check_question");
    const strict = normalizeTeacherTurn(proposal({ suggestedState: "comprehension_check" }), scope);
    expect(strict.recoveredIssues).toEqual([]);
    expect(strict.accepted.suggestionAccepted).toBe(true);
    const absent = normalizeTeacherTurn(proposal({ suggestedState: null }), scope);
    expect(absent.recoveredIssues).toEqual([]);
    expect(absent.accepted.suggestionAccepted).toBe(false);
    expect(absent.accepted.state).toBe("comprehension_check");
    expect(() =>
      normalizeTeacherTurn(
        proposal({ suggestedState: "check_question", understanding: "great" }),
        scope,
      ),
    ).toThrow(AIProviderError);
    expect(() =>
      normalizeTeacherTurn(
        proposal({ suggestedState: "check_question", speech: "sk-abcdefghij" }),
        scope,
      ),
    ).toThrow(AIProviderError);
    try {
      normalizeTeacherTurn(
        proposal({ suggestedState: "check_question", speech: "sk-abcdefghij" }),
        scope,
      );
    } catch (error) {
      expect(error).toMatchObject({ failureCategory: "internal_leak_rejection" });
      expect(JSON.stringify(error)).not.toContain("sk-abcdefghij");
    }
  });

  it("rejects speech that leaks a prompt version or a secret", () => {
    expect(() =>
      normalizeTeacherOutput(proposal({ speech: "The key is AI_API_KEY=secret." }), scope),
    ).toThrow(AIProviderError);
    try {
      normalizeTeacherOutput(proposal({ speech: "The key is AI_API_KEY=secret." }), scope);
    } catch (error) {
      expect(error).toMatchObject({
        code: "invalid_response",
        failureCategory: "internal_leak_rejection",
        schemaIssues: [],
      });
      expect(JSON.stringify(error)).not.toContain("AI_API_KEY");
      expect(JSON.stringify(error)).not.toContain("secret");
    }
  });

  it("allows the DATABASE_URL name and rejects a connection string", () => {
    const accepted = normalizeTeacherOutput(
      proposal({
        speech: "DATABASE_URL serverdə qalır. NEXT_PUBLIC_ isə brauzerə çıxa bilər.",
      }),
      scope,
    );
    expect(accepted.speech).toContain("DATABASE_URL");
    expect(() =>
      normalizeTeacherOutput(
        proposal({ speech: "DATABASE_URL=postgresql://user:pass@localhost/db" }),
        scope,
      ),
    ).toThrow(AIProviderError);
    expect(() => normalizeTeacherOutput(proposal({ speech: "sk-abcdefghij" }), scope)).toThrow(
      AIProviderError,
    );
  });

  it("finishes a review from the comprehension result and keeps other concepts out", () => {
    const review: TeacherNormalizationScope = {
      ...scope,
      state: "comprehension_check",
      allowedConceptSlugs: new Set(["web.http"]),
      review: { active: true, focusValid: true },
    };
    const finished = normalizeTeacherTurn(
      proposal({
        understanding: "correct",
        suggestedState: "completed",
        skillUpdates: [
          { conceptSlug: "web.http", evidence: 90, understanding: "correct", mastery: 100 },
          { conceptSlug: "web.browser", evidence: 90, understanding: "correct" },
        ],
      }),
      review,
    );
    expect(finished.accepted.state).toBe("review_completed");
    expect(finished.accepted.skillUpdates.map((update) => update.conceptSlug)).toEqual(["web.http"]);
    expect(finished.accepted.skillUpdates[0]?.evidence).toBe(90);
    expect(JSON.stringify(finished.accepted)).not.toContain("mastery");

    expect(
      normalizeTeacherTurn(
        proposal({ understanding: "incorrect", suggestedState: "completed" }),
        review,
      ).accepted.state,
    ).toBe("adapt");

    expect(
      normalizeTeacherTurn(
        proposal({
          understanding: "correct",
          suggestedState: "completed",
          skillUpdates: [{ conceptSlug: "web.http", evidence: 90, understanding: "correct" }],
        }),
        {
          ...review,
          allowedConceptSlugs: new Set(),
          review: { active: true, focusValid: false },
        },
      ).accepted,
    ).toMatchObject({ state: "comprehension_check", skillUpdates: [] });

    expect(
      normalizeTeacherTurn(
        proposal({ understanding: "correct", suggestedState: "completed" }),
        { ...scope, state: "comprehension_check" },
      ).accepted.state,
    ).toBe("exercise");
  });
});
