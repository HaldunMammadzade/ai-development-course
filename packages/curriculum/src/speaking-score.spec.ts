import { describe, expect, it } from "vitest";
import { SPEAKING_EVIDENCE, speakingEvidence, transcriptQuality } from "./speaking-score";

describe("speaking evidence", () => {
  it("writes fixed evidence only for a correct answer", () => {
    expect(speakingEvidence("correct")).toBe(SPEAKING_EVIDENCE);
    expect(speakingEvidence("partial")).toBeNull();
    expect(speakingEvidence("incorrect")).toBeNull();
    expect(speakingEvidence("unknown")).toBeNull();
    expect(SPEAKING_EVIDENCE).toBe(40);
  });

  it("treats an empty, short, or repetitive transcript as unclear", () => {
    expect(transcriptQuality("")).toBe("unclear");
    expect(transcriptQuality("qısa")).toBe("unclear");
    expect(transcriptQuality("hə hə hə hə hə hə hə hə")).toBe("unclear");
    expect(
      transcriptQuality("Semantik element səhifənin mənasını bildirir və header buna misaldır."),
    ).toBe("ok");
  });
});
