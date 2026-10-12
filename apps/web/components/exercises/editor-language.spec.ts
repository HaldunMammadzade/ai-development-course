import { describe, expect, it } from "vitest";
import { answerSurface, languageLabel, monacoLanguage } from "./editor-language";

describe("answer surface", () => {
  it("uses a compact field only for an authored text check", () => {
    expect(answerSurface({ type: "code_text", language: null, executionAvailable: false })).toBe(
      "text",
    );
    expect(
      answerSurface({ type: "code_text", language: "javascript", executionAvailable: false }),
    ).toBe("code");
    expect(answerSurface({ type: "code_text", language: "html", executionAvailable: false })).toBe(
      "code",
    );
    expect(answerSurface({ type: "code_text", language: "css", executionAvailable: true })).toBe(
      "code",
    );
    expect(
      answerSurface({ type: "multiple_choice", language: null, executionAvailable: false }),
    ).toBe("choice");
  });

  it("keeps Monaco when the type or execution flag is missing or unknown", () => {
    expect(answerSurface({ type: "code_text", language: null })).toBe("code");
    expect(answerSurface({ type: "code_text", language: null, executionAvailable: true })).toBe(
      "code",
    );
    expect(answerSurface({ type: "code_review", language: null, executionAvailable: false })).toBe(
      "code",
    );
    expect(
      answerSurface({ type: "code_text", language: "python", executionAvailable: false }),
    ).toBe("code");
  });
});

describe("monaco language mapping", () => {
  it("maps authored languages and falls back to plaintext", () => {
    expect(monacoLanguage("html")).toBe("html");
    expect(monacoLanguage("css")).toBe("css");
    expect(monacoLanguage("javascript")).toBe("javascript");
    expect(monacoLanguage(null)).toBe("plaintext");
    expect(monacoLanguage(undefined)).toBe("plaintext");
    expect(monacoLanguage("python")).toBe("plaintext");
    expect(monacoLanguage("javascript;alert(1)")).toBe("plaintext");
  });

  it("labels the languages a student can see", () => {
    expect(languageLabel("html")).toBe("HTML");
    expect(languageLabel("css")).toBe("CSS");
    expect(languageLabel("javascript")).toBe("JavaScript");
    expect(languageLabel(null)).toBe("Mətn");
  });
});
