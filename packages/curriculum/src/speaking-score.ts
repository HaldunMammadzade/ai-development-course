/**
 * Server-owned speaking evidence.
 *
 * The model classifies understanding and never submits a number.
 * Only a correct answer writes evidence, and that evidence is fixed at 40
 * so a speaking session cannot outweigh an exercise, project, or interview.
 * Partial, incorrect, unknown, unclear transcripts, and provider failures
 * write nothing.
 *
 * At most one event is written per attempt, and at most four per session.
 */

export const SPEAKING_EVIDENCE = 40;
export const SPEAKING_MAX_EVENTS_PER_ATTEMPT = 1;
export const SPEAKING_MAX_EVENTS_PER_SESSION = 4;
export const SPEAKING_TRANSCRIPT_MIN = 12;
export const SPEAKING_TRANSCRIPT_MAX = 6_000;
export const SPEAKING_ATTEMPTS_PER_10_MIN = 20;
export const SPEAKING_ATTEMPTS_PER_DAY = 30;
export const SPEAKING_TRANSCRIPTIONS_PER_DAY = 20;
export const SPEAKING_AI_CALLS_PER_DAY = 20;
export const SPEAKING_WINDOW_MS = 10 * 60 * 1000;

export type SpeakingUnderstanding = "unknown" | "incorrect" | "partial" | "correct";

export function speakingEvidence(understanding: SpeakingUnderstanding): number | null {
  return understanding === "correct" ? SPEAKING_EVIDENCE : null;
}

export function transcriptQuality(transcript: string): "ok" | "unclear" {
  const text = transcript.trim();
  if (text.length < SPEAKING_TRANSCRIPT_MIN) {
    return "unclear";
  }
  const words = text
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  if (words.length >= 8) {
    const counts = new Map<string, number>();
    for (const word of words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
    const highest = Math.max(...counts.values());
    if (highest / words.length >= 0.7) {
      return "unclear";
    }
  }
  return "ok";
}

export function speakingHiddenLiterals(): readonly string[] {
  return ["even-eight", "odd-forty-one", "rubric-internal", "sk-"];
}
