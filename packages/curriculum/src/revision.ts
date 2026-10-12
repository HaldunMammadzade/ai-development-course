import type {
  LessonAvailability,
  MasteryBand,
  RevisionIndicator,
  RevisionQueue,
} from "@platform/types";
import { MASTERY_DECAY_DAYS, studentCalendarDay, studentDayAge } from "./time";

/** Same evidence floor `classifyStoredEvidence` already treats as success. Speaking stays below it. */
export const REVISION_SUCCESS_EVIDENCE = 80;

export const REVISION_QUEUE_LIMIT = 5;

const INTERVAL_CAP_STEPS = 3;

export type RevisionScheduleState = "not_due" | RevisionIndicator;

export interface RevisionEvent {
  id: string;
  conceptSlug: string;
  occurredAt: Date;
  evidence: number;
  source:
    | "lesson_check"
    | "exercise"
    | "quiz"
    | "code_review"
    | "interview"
    | "homework"
    | "project"
    | "speaking";
}

export interface RevisionSuccessSummary {
  conceptSlug: string;
  successCount: number;
  lastSuccessAt: Date;
}

export interface RevisionExercise {
  slug: string;
  position: number;
  conceptSlug: string;
  lessonSlug: string;
  modulePosition: number;
  lessonPosition: number;
}

export interface RevisionConceptInput {
  slug: string;
  name: string;
  lessonSlug: string;
  lessonTitle: string;
  lessonAvailability: LessonAvailability;
  band: MasteryBand | null;
}

export function summarizeSuccesses(events: readonly RevisionEvent[]): RevisionSuccessSummary[] {
  const grouped = new Map<string, { ids: Set<string>; count: number; last: Date }>();
  const ordered = [...events].sort(
    (left, right) =>
      left.occurredAt.getTime() - right.occurredAt.getTime() || left.id.localeCompare(right.id),
  );
  for (const event of ordered) {
    if (!countsAsSuccess(event)) {
      continue;
    }
    const current = grouped.get(event.conceptSlug);
    if (current === undefined) {
      grouped.set(event.conceptSlug, {
        ids: new Set([event.id]),
        count: 1,
        last: event.occurredAt,
      });
      continue;
    }
    if (current.ids.has(event.id)) {
      continue;
    }
    current.ids.add(event.id);
    current.count += 1;
    if (event.occurredAt.getTime() >= current.last.getTime()) {
      current.last = event.occurredAt;
    }
  }
  return [...grouped.entries()].map(([conceptSlug, value]) => ({
    conceptSlug,
    successCount: value.count,
    lastSuccessAt: value.last,
  }));
}

export function revisionIntervalDays(successCount: number): number {
  const steps = Math.min(Math.max(successCount, 1), INTERVAL_CAP_STEPS);
  return steps * MASTERY_DECAY_DAYS;
}

export function revisionScheduleState(input: {
  now: Date;
  timeZone: string;
  successCount: number;
  lastSuccessAt: Date;
}): RevisionScheduleState {
  const age = studentDayAge(input.lastSuccessAt, input.now, input.timeZone);
  const interval = revisionIntervalDays(input.successCount);
  const reviewedToday =
    input.successCount >= 2 &&
    studentCalendarDay(input.lastSuccessAt, input.timeZone) ===
      studentCalendarDay(input.now, input.timeZone);
  if (reviewedToday) {
    return "recently_reviewed";
  }
  if (age < interval) {
    return "not_due";
  }
  if (age < interval + MASTERY_DECAY_DAYS) {
    return "due";
  }
  return "overdue";
}

export function selectRevisionExercise(
  exercises: readonly RevisionExercise[],
  conceptSlug: string,
  openLessonSlugs: ReadonlySet<string>,
): RevisionExercise | null {
  const matches = exercises
    .filter(
      (exercise) =>
        exercise.conceptSlug === conceptSlug && openLessonSlugs.has(exercise.lessonSlug),
    )
    .sort(
      (left, right) =>
        left.modulePosition - right.modulePosition ||
        left.lessonPosition - right.lessonPosition ||
        left.position - right.position ||
        left.slug.localeCompare(right.slug),
    );
  return matches[0] ?? null;
}

export function buildRevision(input: {
  now: Date;
  timeZone: string;
  concepts: readonly RevisionConceptInput[];
  successes: readonly RevisionSuccessSummary[];
  exercises: readonly RevisionExercise[];
  lessonTitles: ReadonlyMap<string, string>;
}): RevisionQueue & { states: Map<string, RevisionScheduleState> } {
  const successes = new Map<string, RevisionSuccessSummary>();
  for (const summary of input.successes) {
    if (summary.successCount < 1 || successes.has(summary.conceptSlug)) {
      continue;
    }
    successes.set(summary.conceptSlug, summary);
  }
  const openLessonSlugs = new Set(
    input.concepts
      .filter(
        (concept) =>
          concept.lessonAvailability === "current" ||
          concept.lessonAvailability === "completed" ||
          concept.lessonAvailability === "practice",
      )
      .map((concept) => concept.lessonSlug),
  );
  const seen = new Set<string>();
  const states = new Map<string, RevisionScheduleState>();
  const ranked: Array<{
    slug: string;
    name: string;
    lessonSlug: string;
    lessonTitle: string;
    state: "due" | "overdue";
    band: MasteryBand;
    pastDue: number;
    successCount: number;
  }> = [];

  for (const concept of input.concepts) {
    if (seen.has(concept.slug)) {
      continue;
    }
    seen.add(concept.slug);
    const summary = successes.get(concept.slug);
    if (summary === undefined || concept.band === null || concept.band === "weak") {
      continue;
    }
    const band = concept.band;
    if (concept.lessonAvailability === "locked") {
      continue;
    }
    const exercise = selectRevisionExercise(input.exercises, concept.slug, openLessonSlugs);
    if (exercise === null) {
      continue;
    }
    const state = revisionScheduleState({
      now: input.now,
      timeZone: input.timeZone,
      successCount: summary.successCount,
      lastSuccessAt: summary.lastSuccessAt,
    });
    states.set(concept.slug, state);
    if (state !== "due" && state !== "overdue") {
      continue;
    }
    ranked.push({
      slug: concept.slug,
      name: concept.name,
      lessonSlug: exercise.lessonSlug,
      lessonTitle: input.lessonTitles.get(exercise.lessonSlug) ?? concept.lessonTitle,
      state,
      band,
      pastDue:
        studentDayAge(summary.lastSuccessAt, input.now, input.timeZone) -
        revisionIntervalDays(summary.successCount),
      successCount: summary.successCount,
    });
  }

  ranked.sort(
    (left, right) =>
      stateRank(left.state) - stateRank(right.state) ||
      bandRank(left.band) - bandRank(right.band) ||
      right.pastDue - left.pastDue ||
      right.successCount - left.successCount ||
      left.slug.localeCompare(right.slug),
  );
  const items = ranked.slice(0, REVISION_QUEUE_LIMIT).map((item) => ({
    slug: item.slug,
    name: item.name,
    lessonSlug: item.lessonSlug,
    lessonTitle: item.lessonTitle,
    state: item.state,
  }));
  return { status: revisionStatus(items.length, states), items, states };
}

function revisionStatus(
  ready: number,
  states: ReadonlyMap<string, RevisionScheduleState>,
): RevisionQueue["status"] {
  if (ready > 0) {
    return "ready";
  }
  const values = [...states.values()];
  if (values.includes("recently_reviewed")) {
    return "reviewed";
  }
  if (values.length > 0) {
    return "waiting";
  }
  return "empty";
}

function countsAsSuccess(event: RevisionEvent): boolean {
  return (
    event.source !== "speaking" &&
    Number.isFinite(event.evidence) &&
    event.evidence >= REVISION_SUCCESS_EVIDENCE
  );
}

function stateRank(state: "due" | "overdue"): number {
  return state === "overdue" ? 0 : 1;
}

function bandRank(band: MasteryBand): number {
  switch (band) {
    case "strong":
      return 0;
    case "working":
      return 1;
    case "fragile":
      return 2;
    case "weak":
      return 3;
  }
}
