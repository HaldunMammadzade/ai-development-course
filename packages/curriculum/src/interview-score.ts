import type { ExecutionConfig } from "@platform/types";

/**
 * Server-owned interview scoring.
 *
 * Verbal evidence is a fixed map. The model classifies understanding and
 * never submits a number.
 *   unknown = 20, incorrect = 20, partial = 60, correct = 90
 *
 * Code evidence blends the deterministic execution score with that map:
 *   round(0.7 * executionScore + 0.3 * verbalEvidence(understanding))
 *
 * A follow-up is not a separate weighted question. When one exists, the
 * parent evidence becomes:
 *   round(0.75 * parentEvidence + 0.25 * followUpEvidence)
 *
 * Every published main question has weight 1. Follow-ups have weight 0.
 *   finalScore = round(sum(mainEvidence * weight) / sum(weight))
 *
 * Bands: under 45 weak, under 75 developing, otherwise strong.
 * Learning events use min(evidence, 70), only when evidence is at least 60,
 * at most one event per authored concept, and at most 8 events per interview.
 */

export const VERBAL_EVIDENCE = {
  unknown: 20,
  incorrect: 20,
  partial: 60,
  correct: 90,
} as const;

export const CODE_EXECUTION_SHARE = 0.7;
export const CODE_REASONING_SHARE = 0.3;
export const FOLLOW_UP_SHARE = 0.25;
export const MAX_FOLLOW_UPS_PER_QUESTION = 1;
export const MAX_AI_CALLS_PER_INTERVIEW = 30;
export const MAX_ACTIVE_INTERVIEWS = 1;
export const MAX_COMPLETED_PER_DAY = 2;
export const MAX_INTERVIEWS_PER_WEEK = 10;
export const INTERVIEW_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_LEARNING_EVENTS = 8;
export const LEARNING_EVIDENCE_CAP = 70;
export const LEARNING_EVIDENCE_FLOOR = 60;
export const ANSWER_TEXT_MAX = 6_000;
export const ANSWER_CODE_MAX = 8_000;
export const ANSWER_TOTAL_MAX = 10_000;

export type InterviewUnderstanding = keyof typeof VERBAL_EVIDENCE;
export type InterviewStep = "follow_up" | "next" | "complete";

export function verbalEvidence(understanding: InterviewUnderstanding): number {
  return VERBAL_EVIDENCE[understanding];
}

export function codeEvidence(
  executionScore: number,
  understanding: InterviewUnderstanding,
): number {
  const qualitative = verbalEvidence(understanding);
  return clamp(
    Math.round(CODE_EXECUTION_SHARE * executionScore + CODE_REASONING_SHARE * qualitative),
    0,
    100,
  );
}

export function blendFollowUp(mainEvidence: number, followUpEvidence: number): number {
  return clamp(
    Math.round((1 - FOLLOW_UP_SHARE) * mainEvidence + FOLLOW_UP_SHARE * followUpEvidence),
    0,
    100,
  );
}

export function finalInterviewScore(
  items: ReadonlyArray<{ evidence: number; weight: number }>,
): number {
  let weighted = 0;
  let weights = 0;
  for (const item of items) {
    if (item.weight <= 0) {
      continue;
    }
    weighted += item.evidence * item.weight;
    weights += item.weight;
  }
  if (weights === 0) {
    return 0;
  }
  return clamp(Math.round(weighted / weights), 0, 100);
}

export function interviewBand(score: number): "weak" | "developing" | "strong" {
  if (score < 45) {
    return "weak";
  }
  if (score < 75) {
    return "developing";
  }
  return "strong";
}

export function decideInterviewStep(input: {
  phase: "question" | "follow_up";
  understanding: InterviewUnderstanding;
  followUpRecommended: boolean;
  followUpsUsed: number;
  hasAuthoredFollowUp: boolean;
  hasNextMain: boolean;
}): InterviewStep {
  const partial = input.understanding === "partial" || input.understanding === "incorrect";
  if (
    input.phase === "question" &&
    input.followUpsUsed < MAX_FOLLOW_UPS_PER_QUESTION &&
    input.hasAuthoredFollowUp &&
    input.followUpRecommended &&
    partial
  ) {
    return "follow_up";
  }
  return input.hasNextMain ? "next" : "complete";
}

export function interviewHiddenLiterals(config: ExecutionConfig | null): string[] {
  if (config === null) {
    return [];
  }
  return config.tests.map((test) => test.id).filter((id) => id.length >= 3 && !/^\d+$/.test(id));
}

export function learningEvidence(evidence: number): number | null {
  if (evidence < LEARNING_EVIDENCE_FLOOR) {
    return null;
  }
  return Math.min(evidence, LEARNING_EVIDENCE_CAP);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
