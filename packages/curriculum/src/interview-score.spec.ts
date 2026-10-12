import { describe, expect, it } from "vitest";
import {
  blendFollowUp,
  codeEvidence,
  decideInterviewStep,
  finalInterviewScore,
  interviewBand,
  verbalEvidence,
} from "./interview-score";

describe("interview scoring", () => {
  it("maps understanding to fixed evidence", () => {
    expect(verbalEvidence("incorrect")).toBe(20);
    expect(verbalEvidence("unknown")).toBe(20);
    expect(verbalEvidence("partial")).toBe(60);
    expect(verbalEvidence("correct")).toBe(90);
  });

  it("keeps execution ahead of the qualitative band", () => {
    expect(codeEvidence(0, "correct")).toBe(27);
    expect(codeEvidence(100, "incorrect")).toBe(76);
    expect(codeEvidence(100, "correct")).toBe(97);
  });

  it("blends one follow-up into the parent and averages the weights", () => {
    expect(blendFollowUp(90, 20)).toBe(73);
    expect(
      finalInterviewScore([
        { evidence: 90, weight: 1 },
        { evidence: 97, weight: 1 },
        { evidence: 20, weight: 0 },
      ]),
    ).toBe(94);
  });

  it("bands the final score without a senior claim", () => {
    expect(interviewBand(44)).toBe("weak");
    expect(interviewBand(74)).toBe("developing");
    expect(interviewBand(75)).toBe("strong");
  });

  it("selects an authored follow-up only when the server rules allow it", () => {
    const base = {
      phase: "question" as const,
      followUpRecommended: true,
      followUpsUsed: 0,
      hasAuthoredFollowUp: true,
      hasNextMain: true,
    };
    expect(decideInterviewStep({ ...base, understanding: "partial" })).toBe("follow_up");
    expect(decideInterviewStep({ ...base, understanding: "incorrect" })).toBe("follow_up");
    expect(decideInterviewStep({ ...base, understanding: "correct" })).toBe("next");
    expect(decideInterviewStep({ ...base, understanding: "unknown" })).toBe("next");
    expect(
      decideInterviewStep({ ...base, understanding: "partial", followUpRecommended: false }),
    ).toBe("next");
    expect(decideInterviewStep({ ...base, understanding: "partial", followUpsUsed: 1 })).toBe(
      "next",
    );
    expect(
      decideInterviewStep({
        ...base,
        understanding: "partial",
        hasAuthoredFollowUp: false,
        hasNextMain: false,
      }),
    ).toBe("complete");
    expect(
      decideInterviewStep({
        ...base,
        phase: "follow_up",
        understanding: "partial",
        hasNextMain: false,
      }),
    ).toBe("complete");
  });
});
