import { isWeak } from "./mastery";
import { SPEAKING_EVIDENCE } from "./speaking-score";
import { MASTERY_DECAY_DAYS, studentDayAge } from "./time";

export const ADAPTIVE_DECISIONS = [
  "CONTINUE",
  "REEXPLAIN",
  "HINT",
  "RETRY",
  "REVIEW",
  "CHALLENGE",
  "REMEDIATE_PREREQUISITE",
] as const;

export const TEACHING_STRATEGIES = [
  "EXPLAIN",
  "SOCRATIC",
  "EXAMPLE",
  "ANALOGY",
  "GUIDED_RETRY",
  "TARGETED_REVIEW",
  "CHALLENGE",
] as const;

export type AdaptiveDecision = (typeof ADAPTIVE_DECISIONS)[number];
export type TeachingStrategy = (typeof TEACHING_STRATEGIES)[number];

export type AdaptiveReason =
  | "baseline"
  | "partial"
  | "one_failure"
  | "repeated_failure"
  | "misconception"
  | "weak_prerequisite"
  | "decayed"
  | "recent_slip"
  | "ready";

export type AdaptiveEvidenceSource =
  | "lesson_check"
  | "homework"
  | "exercise"
  | "speaking"
  | "interview"
  | "project"
  | "quiz"
  | "code_review";

export interface AdaptiveEvidence {
  source: AdaptiveEvidenceSource;
  outcome: "success" | "partial" | "failure";
  occurredAt: Date;
}

export interface AdaptiveConceptState {
  score: number | null;
  evidenceCount: number;
  lastEvidenceAt: Date | null;
}

export interface AdaptiveChoice {
  decision: AdaptiveDecision;
  strategy: TeachingStrategy;
  reason: AdaptiveReason;
}

const MAX_RECENT_EVIDENCE = 5;

export function classifyStoredEvidence(
  source: AdaptiveEvidenceSource,
  evidence: number,
): AdaptiveEvidence["outcome"] {
  if (source === "speaking") {
    return evidence >= SPEAKING_EVIDENCE ? "success" : "failure";
  }
  if (evidence >= 80) {
    return "success";
  }
  if (evidence >= 45) {
    return "partial";
  }
  return "failure";
}

export function decideAdaptive(input: {
  now: Date;
  timeZone: string;
  concept: AdaptiveConceptState;
  prerequisiteWeak: boolean;
  misconceptionOccurrences: number;
  recent: readonly AdaptiveEvidence[];
}): AdaptiveChoice {
  const recent = [...input.recent]
    .sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime())
    .slice(0, MAX_RECENT_EVIDENCE);
  const newest = recent[0];
  const failures = recent.filter((item) => item.outcome === "failure").length;
  const hadSuccess = recent.some((item) => item.outcome === "success");
  const score = input.concept.score;
  const evidenceCount = input.concept.evidenceCount;

  if (input.prerequisiteWeak) {
    return choice("REMEDIATE_PREREQUISITE", "TARGETED_REVIEW", "weak_prerequisite");
  }
  if (input.misconceptionOccurrences >= 2 && failures >= 2) {
    return choice("REEXPLAIN", "ANALOGY", "misconception");
  }
  if (failures >= 2 && score !== null && score < 45 && evidenceCount >= 2) {
    return choice("REEXPLAIN", "EXAMPLE", "repeated_failure");
  }
  if (
    newest?.outcome === "failure" &&
    hadSuccess &&
    score !== null &&
    score >= 60 &&
    evidenceCount >= 3
  ) {
    return choice("REVIEW", "TARGETED_REVIEW", "recent_slip");
  }
  if (reviewDue(input)) {
    return choice("REVIEW", "TARGETED_REVIEW", "decayed");
  }
  if (
    score !== null &&
    score >= 80 &&
    evidenceCount >= 8 &&
    newest?.outcome === "success" &&
    !stale(input)
  ) {
    return choice("CHALLENGE", "CHALLENGE", "ready");
  }
  if (score !== null && score >= 60 && score < 80 && failures === 1 && evidenceCount >= 3) {
    return choice("HINT", "GUIDED_RETRY", "one_failure");
  }
  if (score !== null && score >= 45 && score < 80 && newest?.outcome !== "failure") {
    return choice("CONTINUE", "EXAMPLE", "partial");
  }
  if (failures >= 1 && (score === null || score >= 45 || evidenceCount < 2)) {
    return choice("RETRY", "GUIDED_RETRY", "one_failure");
  }
  if (score !== null && score < 45 && evidenceCount >= 2) {
    return choice("REEXPLAIN", "EXAMPLE", "repeated_failure");
  }
  return choice("CONTINUE", "EXPLAIN", "baseline");
}

export function reviewDue(input: {
  now: Date;
  timeZone: string;
  concept: AdaptiveConceptState;
}): boolean {
  const { concept } = input;
  if (concept.lastEvidenceAt === null || concept.evidenceCount < 3 || concept.score === null) {
    return false;
  }
  return (
    studentDayAge(concept.lastEvidenceAt, input.now, input.timeZone) >= MASTERY_DECAY_DAYS &&
    concept.score < 80
  );
}

export function selectExercise(input: {
  exercises: readonly AdaptiveExercise[];
  masteryHigh: boolean;
}): string | null {
  const ranked = input.exercises
    .map((exercise, index) => ({ exercise, index, rank: exerciseRank(exercise, input.masteryHigh) }))
    .filter((item) => item.rank < 9)
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        left.exercise.position - right.exercise.position ||
        left.exercise.id.localeCompare(right.exercise.id),
    );
  return ranked[0]?.exercise.id ?? null;
}

export interface AdaptiveExercise {
  id: string;
  position: number;
  required: boolean;
  status: "unseen" | "failed" | "passed";
  targetsMisconception: boolean;
  challenge: boolean;
}

export function prerequisiteIsWeak(input: {
  score: number | null;
  evidenceCount: number;
}): boolean {
  if (input.score === null) {
    return false;
  }
  return isWeak({ score: input.score, evidenceCount: input.evidenceCount });
}

function stale(input: { now: Date; timeZone: string; concept: AdaptiveConceptState }): boolean {
  if (input.concept.lastEvidenceAt === null) {
    return false;
  }
  return studentDayAge(input.concept.lastEvidenceAt, input.now, input.timeZone) >= MASTERY_DECAY_DAYS;
}

function exerciseRank(exercise: AdaptiveExercise, masteryHigh: boolean): number {
  if (exercise.status === "passed") {
    return 9;
  }
  if (exercise.required && exercise.status === "unseen") {
    return 0;
  }
  if (exercise.status === "failed") {
    return 1;
  }
  if (exercise.targetsMisconception && !exercise.challenge) {
    return 2;
  }
  if (exercise.status === "unseen" && !exercise.challenge) {
    return 3;
  }
  if (exercise.challenge) {
    return masteryHigh ? 4 : 3;
  }
  return 9;
}

function choice(
  decision: AdaptiveDecision,
  strategy: TeachingStrategy,
  reason: AdaptiveReason,
): AdaptiveChoice {
  return { decision, strategy, reason };
}
