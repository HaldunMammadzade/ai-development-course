import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import {
  advanceLabel,
  composerIssue,
  composerMode,
  lessonBlockText,
  stateLabel,
} from "./presentation";

describe("teaching presentation", () => {
  it("maps server state to an answer, an advance, or a closed lesson", () => {
    expect(composerMode("prior_check")).toBe("answer");
    expect(composerMode("comprehension_check")).toBe("answer");
    expect(composerMode("evaluate")).toBe("answer");
    expect(composerMode("explain")).toBe("advance");
    expect(composerMode("exercise")).toBe("advance");
    expect(composerMode("created")).toBe("advance");
    expect(composerMode("homework")).toBe("homework");
    expect(composerMode("completed")).toBe("done");
    expect(composerMode("abandoned")).toBe("closed");
    expect(advanceLabel("created")).toBe(copy.teacher.begin);
    expect(advanceLabel("explain")).toBe(copy.teacher.advance);
    expect(stateLabel("comprehension_check")).toBe("Bir az düşünək");
    expect(stateLabel("prior_check")).not.toBe("prior_check");
    expect(stateLabel("raise_difficulty")).toBe("Əla, davam edək");
  });

  it("rejects an empty answer and an answer over 2000 characters", () => {
    expect(composerIssue("  ")).toBe("empty");
    expect(composerIssue("a".repeat(2001))).toBe("too_long");
    expect(composerIssue("Cavab.")).toBeNull();
  });

  it("renders lesson material as plain text", () => {
    expect(lessonBlockText({ type: "check_question", position: 1, prompt: "Sual?" })).toBe("Sual?");
    expect(
      lessonBlockText({
        type: "reading",
        position: 1,
        markdown: "<script>alert(1)</script>",
      }),
    ).toBe("<script>alert(1)</script>");
  });
});
