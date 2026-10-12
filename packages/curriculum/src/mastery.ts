import type { ConfidenceLevel, MasteryBand, Understanding } from "@platform/types";
import { MASTERY_DECAY_DAYS, MASTERY_WINDOW, MAX_SKILL_UPDATES, studentDayAge } from "./time";

const CHECK_BANDS: Record<"correct" | "partial" | "incorrect", readonly [number, number]> = {
  correct: [80, 100],
  partial: [45, 75],
  incorrect: [0, 40],
};

export interface MasteryEvent {
  id: string;
  occurredAt: Date;
  evidence: number;
  weight: number;
}

export interface MasteryProjection {
  score: number;
  evidenceCount: number;
  lastEvidenceAt: Date;
  band: MasteryBand | null;
  confidence: ConfidenceLevel;
}

export function calculateMastery(input: {
  events: MasteryEvent[];
  now: Date;
  timeZone: string;
}): MasteryProjection | null {
  if (input.events.length === 0) {
    return null;
  }

  const sorted = [...input.events].sort(compareNewestFirst);
  const window = sorted.slice(0, MASTERY_WINDOW);
  let weightedEvidence = 0;
  let weightSum = 0;
  for (const event of window) {
    if (!Number.isFinite(event.evidence) || event.evidence < 0 || event.evidence > 100) {
      throw new Error("Evidence must be between 0 and 100.");
    }
    if (!Number.isFinite(event.weight) || event.weight <= 0) {
      throw new Error("Event weight must be positive.");
    }
    const decay = Math.exp(
      -studentDayAge(event.occurredAt, input.now, input.timeZone) / MASTERY_DECAY_DAYS,
    );
    weightedEvidence += event.evidence * event.weight * decay;
    weightSum += event.weight * decay;
  }

  const score = clamp(Math.round(weightedEvidence / weightSum), 0, 100);
  const evidenceCount = input.events.length;
  return {
    score,
    evidenceCount,
    lastEvidenceAt: sorted[0]?.occurredAt ?? input.now,
    band: masteryBand(score, evidenceCount),
    confidence: confidenceLevel(evidenceCount),
  };
}

export function masteryBand(score: number, evidenceCount: number): MasteryBand | null {
  if (score < 45) {
    return evidenceCount >= 2 ? "weak" : null;
  }
  if (score < 60) {
    return "fragile";
  }
  if (score < 80) {
    return "working";
  }
  return "strong";
}

export function confidenceLevel(evidenceCount: number): ConfidenceLevel {
  if (evidenceCount < 3) {
    return "low";
  }
  if (evidenceCount < 8) {
    return "medium";
  }
  return "high";
}

export function isWeak(projection: { score: number; evidenceCount: number } | null): boolean {
  return projection !== null && projection.score < 45 && projection.evidenceCount >= 2;
}

export function clampCheckEvidence(
  understanding: Exclude<Understanding, "unknown">,
  proposed: number,
): number {
  if (!Number.isFinite(proposed)) {
    throw new Error("Evidence must be a finite number.");
  }
  const [minimum, maximum] = CHECK_BANDS[understanding];
  return clamp(clamp(proposed, 0, 100), minimum, maximum);
}

export const HOMEWORK_DONE_EVIDENCE = 80;

export function homeworkDoneUpdate(): { evidence: number; weight: number } {
  return {
    evidence: HOMEWORK_DONE_EVIDENCE,
    weight: evidenceWeight("homework", "done"),
  };
}

export function evidenceWeight(
  source: "lesson_check" | "homework",
  understanding: "correct" | "partial" | "incorrect" | "done",
): number {
  if (source === "homework") {
    if (understanding !== "done") {
      throw new Error("Homework evidence is recorded only when the homework is done.");
    }
    return 1;
  }
  if (understanding === "incorrect") {
    return 1.2;
  }
  if (understanding === "correct" || understanding === "partial") {
    return 1;
  }
  throw new Error("Lesson-check evidence requires a correct, partial, or incorrect understanding.");
}

export interface ProposedSkillUpdate {
  conceptSlug: string;
  understanding: Exclude<Understanding, "unknown">;
  evidence: number;
}

export interface AcceptedSkillUpdate {
  conceptSlug: string;
  understanding: Exclude<Understanding, "unknown">;
  evidence: number;
  weight: number;
}

export function selectSkillUpdates(
  proposed: ProposedSkillUpdate[],
  allowedSlugs: ReadonlySet<string>,
): AcceptedSkillUpdate[] {
  const selected: AcceptedSkillUpdate[] = [];
  const seen = new Set<string>();
  for (const item of proposed) {
    if (!allowedSlugs.has(item.conceptSlug) || seen.has(item.conceptSlug)) {
      continue;
    }
    seen.add(item.conceptSlug);
    selected.push({
      conceptSlug: item.conceptSlug,
      understanding: item.understanding,
      evidence: clampCheckEvidence(item.understanding, item.evidence),
      weight: evidenceWeight("lesson_check", item.understanding),
    });
    if (selected.length === MAX_SKILL_UPDATES) {
      break;
    }
  }
  return selected;
}

function compareNewestFirst(left: MasteryEvent, right: MasteryEvent): number {
  const time = right.occurredAt.getTime() - left.occurredAt.getTime();
  if (time !== 0) {
    return time;
  }
  return right.id < left.id ? -1 : right.id > left.id ? 1 : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
