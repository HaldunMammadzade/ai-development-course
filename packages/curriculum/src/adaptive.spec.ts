import { describe, expect, it } from "vitest";
import {
  classifyStoredEvidence,
  decideAdaptive,
  prerequisiteIsWeak,
  reviewDue,
  selectExercise,
  type AdaptiveConceptState,
  type AdaptiveEvidence,
} from "./adaptive";

const now = new Date("2026-06-21T12:00:00.000Z");

function concept(patch: Partial<AdaptiveConceptState> = {}): AdaptiveConceptState {
  return { score: null, evidenceCount: 0, lastEvidenceAt: null, ...patch };
}

function evidence(
  outcome: AdaptiveEvidence["outcome"],
  source: AdaptiveEvidence["source"] = "lesson_check",
  daysAgo = 0,
): AdaptiveEvidence {
  return {
    source,
    outcome,
    occurredAt: new Date(now.getTime() - daysAgo * 86_400_000),
  };
}

function decide(
  patch: Partial<Parameters<typeof decideAdaptive>[0]> = {},
): ReturnType<typeof decideAdaptive> {
  return decideAdaptive({
    now,
    timeZone: "UTC",
    concept: concept(),
    prerequisiteWeak: false,
    misconceptionOccurrences: 0,
    recent: [],
    ...patch,
  });
}

describe("adaptive decisions", () => {
  it("starts from the lesson when there is no evidence", () => {
    expect(decide().decision).toBe("CONTINUE");
    expect(decide().strategy).toBe("EXPLAIN");
    expect(decide().reason).toBe("baseline");
  });

  it("does not promote a single success", () => {
    const choice = decide({
      concept: concept({ score: 90, evidenceCount: 1, lastEvidenceAt: now }),
      recent: [evidence("success")],
    });
    expect(choice.decision).not.toBe("CHALLENGE");
  });

  it("challenges only a recent high-confidence success", () => {
    expect(
      decide({
        concept: concept({ score: 88, evidenceCount: 8, lastEvidenceAt: now }),
        recent: [evidence("success"), evidence("success", "exercise", 1)],
      }),
    ).toMatchObject({ decision: "CHALLENGE", strategy: "CHALLENGE", reason: "ready" });
  });

  it("continues a partial answer in the working band", () => {
    expect(
      decide({
        concept: concept({ score: 62, evidenceCount: 4, lastEvidenceAt: now }),
        recent: [evidence("partial")],
      }),
    ).toMatchObject({ decision: "CONTINUE", strategy: "EXAMPLE" });
  });

  it("re-explains repeated weak failures and retries a first failure", () => {
    expect(
      decide({
        concept: concept({ score: 30, evidenceCount: 3, lastEvidenceAt: now }),
        recent: [evidence("failure"), evidence("failure", "exercise", 1)],
      }).decision,
    ).toBe("REEXPLAIN");
    expect(
      decide({
        concept: concept({ score: 70, evidenceCount: 1, lastEvidenceAt: now }),
        recent: [evidence("failure", "exercise")],
      }),
    ).toMatchObject({ decision: "RETRY", strategy: "GUIDED_RETRY" });
  });

  it("hints once inside the working band", () => {
    expect(
      decide({
        concept: concept({ score: 68, evidenceCount: 4, lastEvidenceAt: now }),
        recent: [evidence("failure")],
      }),
    ).toMatchObject({ decision: "HINT", reason: "one_failure" });
  });

  it("reviews a slip after earlier success and decayed evidence", () => {
    expect(
      decide({
        concept: concept({ score: 72, evidenceCount: 5, lastEvidenceAt: now }),
        recent: [evidence("failure"), evidence("success", "homework", 2)],
      }),
    ).toMatchObject({ decision: "REVIEW", reason: "recent_slip" });
    expect(
      reviewDue({
        now,
        timeZone: "UTC",
        concept: concept({
          score: 70,
          evidenceCount: 4,
          lastEvidenceAt: new Date("2026-05-01T00:00:00.000Z"),
        }),
      }),
    ).toBe(true);
    expect(
      decide({
        concept: concept({
          score: 70,
          evidenceCount: 4,
          lastEvidenceAt: new Date("2026-05-01T00:00:00.000Z"),
        }),
      }),
    ).toMatchObject({ decision: "REVIEW", reason: "decayed" });
  });

  it("remediates a weak prerequisite before the current concept", () => {
    expect(decide({ prerequisiteWeak: true })).toMatchObject({
      decision: "REMEDIATE_PREREQUISITE",
      strategy: "TARGETED_REVIEW",
    });
    expect(prerequisiteIsWeak({ score: 20, evidenceCount: 2 })).toBe(true);
    expect(prerequisiteIsWeak({ score: 20, evidenceCount: 1 })).toBe(false);
    expect(prerequisiteIsWeak({ score: null, evidenceCount: 0 })).toBe(false);
  });

  it("changes the explanation after a repeated misconception", () => {
    expect(
      decide({
        concept: concept({ score: 40, evidenceCount: 4, lastEvidenceAt: now }),
        misconceptionOccurrences: 3,
        recent: [evidence("failure"), evidence("failure", "speaking", 1)],
      }),
    ).toMatchObject({ decision: "REEXPLAIN", strategy: "ANALOGY", reason: "misconception" });
  });

  it("does not treat a correct spoken answer as a failure", () => {
    expect(classifyStoredEvidence("speaking", 40)).toBe("success");
    expect(classifyStoredEvidence("lesson_check", 40)).toBe("failure");
    expect(classifyStoredEvidence("exercise", 80)).toBe("success");
    expect(classifyStoredEvidence("interview", 60)).toBe("partial");
  });

  it("keeps a partial spoken success from becoming a challenge", () => {
    const choice = decide({
      concept: concept({ score: 40, evidenceCount: 1, lastEvidenceAt: now }),
      recent: [evidence("success", "speaking")],
    });
    expect(choice.decision).toBe("CONTINUE");
  });
});

describe("exercise selection", () => {
  it("prefers required work, then a retry, then a misconception, then unseen, then a challenge", () => {
    expect(
      selectExercise({
        masteryHigh: true,
        exercises: [
          { id: "challenge", position: 6, required: false, status: "unseen", targetsMisconception: false, challenge: true },
          { id: "unseen", position: 5, required: false, status: "unseen", targetsMisconception: false, challenge: false },
          { id: "misconception", position: 4, required: false, status: "unseen", targetsMisconception: true, challenge: false },
          { id: "failed", position: 3, required: false, status: "failed", targetsMisconception: false, challenge: false },
          { id: "required", position: 1, required: true, status: "unseen", targetsMisconception: false, challenge: false },
          { id: "passed", position: 2, required: true, status: "passed", targetsMisconception: false, challenge: false },
        ],
      }),
    ).toBe("required");
    expect(
      selectExercise({
        masteryHigh: false,
        exercises: [
          { id: "b", position: 2, required: false, status: "failed", targetsMisconception: false, challenge: false },
          { id: "a", position: 1, required: false, status: "failed", targetsMisconception: false, challenge: false },
        ],
      }),
    ).toBe("a");
    expect(
      selectExercise({
        masteryHigh: false,
        exercises: [
          { id: "hard", position: 1, required: false, status: "unseen", targetsMisconception: false, challenge: true },
        ],
      }),
    ).toBe("hard");
    expect(
      selectExercise({
        masteryHigh: true,
        exercises: [
          { id: "done", position: 1, required: true, status: "passed", targetsMisconception: false, challenge: false },
        ],
      }),
    ).toBeNull();
  });
});
