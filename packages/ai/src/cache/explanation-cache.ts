import type { CacheDifficulty, ExplanationStyle, Locale } from "@platform/types";

export interface ExplanationCacheEntry {
  conceptSlug: string;
  difficulty: CacheDifficulty;
  locale: Locale;
  style: ExplanationStyle;
  speech: string;
}

export type CacheAdmission =
  | { admitted: true; entry: ExplanationCacheEntry }
  | { admitted: false; reason: "personalized" | "out_of_scope" | "empty" };

export function admitExplanationCache(input: {
  allowCache: boolean;
  speech: string;
  studentName: string;
  conceptSlug: string;
  difficulty: CacheDifficulty;
  locale: Locale;
  style: ExplanationStyle;
  allowedConceptSlugs: ReadonlySet<string>;
}): CacheAdmission {
  const speech = input.speech.replace(/<[^>]*>/g, "").trim();
  if (
    !input.allowCache ||
    containsStudentName(speech, input.studentName) ||
    looksPersonal(speech)
  ) {
    return { admitted: false, reason: "personalized" };
  }
  if (!input.allowedConceptSlugs.has(input.conceptSlug)) {
    return { admitted: false, reason: "out_of_scope" };
  }
  if (speech.length === 0) {
    return { admitted: false, reason: "empty" };
  }
  return {
    admitted: true,
    entry: {
      conceptSlug: input.conceptSlug,
      difficulty: input.difficulty,
      locale: input.locale,
      style: input.style,
      speech,
    },
  };
}

function containsStudentName(speech: string, name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2) {
    return false;
  }
  return speech.toLocaleLowerCase().includes(trimmed.toLocaleLowerCase());
}

function looksPersonal(speech: string): boolean {
  return /@|session token|password|you missed|your homework|your last answer/i.test(speech);
}
