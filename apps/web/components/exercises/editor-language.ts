import type { ExerciseLanguage } from "@platform/types";

export type MonacoLanguage = "html" | "css" | "javascript" | "plaintext";

export type AnswerSurface = "choice" | "text" | "code";

const programLanguages = new Set<string>(["html", "css", "javascript"]);

/**
 * Choice when `type` is `multiple_choice`.
 * Compact text when `type` is `code_text`, `language` is null, and
 * `executionAvailable` is false. Those fields are the authored signal that
 * the check is text, not a program. A short starter is not enough.
 * Monaco for a real language, for execution, and for any missing or unknown type.
 */
export function answerSurface(input: {
  type: string;
  language: string | null | undefined;
  executionAvailable?: boolean;
}): AnswerSurface {
  if (input.type === "multiple_choice") {
    return "choice";
  }
  if (
    input.type === "code_text" &&
    (input.language === null || input.language === undefined) &&
    input.executionAvailable === false
  ) {
    return "text";
  }
  if (typeof input.language === "string" && programLanguages.has(input.language)) {
    return "code";
  }
  return "code";
}

export function monacoLanguage(language: string | null | undefined): MonacoLanguage {
  if (language === "html" || language === "css" || language === "javascript") {
    return language;
  }
  return "plaintext";
}

export function languageLabel(language: ExerciseLanguage | null): string {
  if (language === "html") {
    return "HTML";
  }
  if (language === "css") {
    return "CSS";
  }
  if (language === "javascript") {
    return "JavaScript";
  }
  return "Mətn";
}
