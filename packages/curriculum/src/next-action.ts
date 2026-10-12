import type { NextAction, TeachingState } from "@platform/types";
import {
  eligibleReviewLesson,
  getDirectPrerequisites,
  isConceptTaughtInPath,
  isLessonUnlocked,
  type PathLesson,
  type PrerequisiteEdge,
} from "./graph";
import { isWeak } from "./mastery";
import { isOpenTeachingState } from "./teaching-state";
import { lessonIsCredited } from "./personalized-path";
import { isDueOnOrBeforeStudentToday, UNLOCK_MASTERY } from "./time";

export interface HomeworkCandidate {
  id: string;
  lessonId: string;
  title: string;
  status: "assigned" | "done" | "skipped";
  dueAt: Date;
}

export interface OpenSessionCandidate {
  id: string;
  lessonId: string;
  title: string;
  state: TeachingState;
  endedAt: Date | null;
  lastActivityAt: Date;
}

export interface LessonCandidate extends PathLesson {
  progress: "not_started" | "in_progress" | "completed" | null;
}

export interface MasterySnapshot {
  score: number;
  evidenceCount: number;
}

export function getNextAction(input: {
  now: Date;
  timeZone: string;
  homework: HomeworkCandidate[];
  sessions: OpenSessionCandidate[];
  lessons: LessonCandidate[];
  prerequisites: PrerequisiteEdge[];
  masteryByConcept: ReadonlyMap<string, MasterySnapshot | null>;
}): NextAction {
  const due = input.homework
    .filter(
      (item) =>
        item.status === "assigned" &&
        isDueOnOrBeforeStudentToday(item.dueAt, input.now, input.timeZone),
    )
    .sort(
      (left, right) =>
        left.dueAt.getTime() - right.dueAt.getTime() || left.id.localeCompare(right.id),
    );
  const homework = due[0];
  if (homework !== undefined) {
    return {
      kind: "do_homework",
      homeworkId: homework.id,
      lessonId: homework.lessonId,
      title: homework.title,
    };
  }

  const open = input.sessions
    .filter(
      (session) =>
        session.endedAt === null && isOpenTeachingState(session.state),
    )
    .sort((left, right) => right.lastActivityAt.getTime() - left.lastActivityAt.getTime());
  const session = open[0];
  if (session !== undefined) {
    return {
      kind: "continue_lesson",
      sessionId: session.id,
      lessonId: session.lessonId,
      title: session.title,
    };
  }

  const published = [...input.lessons]
    .filter((lesson) => lesson.status === "published")
    .sort((left, right) => {
      if (left.modulePosition !== right.modulePosition) {
        return left.modulePosition - right.modulePosition;
      }
      return left.lessonPosition - right.lessonPosition;
    });

  let held: LessonCandidate | null = null;
  for (const lesson of published) {
    if (
      lessonIsCredited({
        lesson,
        lessons: input.lessons,
        prerequisites: input.prerequisites,
        masteryByConcept: input.masteryByConcept,
      })
    ) {
      continue;
    }
    const unlocked = isLessonUnlocked({
      lesson,
      lessons: input.lessons,
      prerequisites: input.prerequisites,
      masteryByConcept: input.masteryByConcept,
    });
    if (!unlocked) {
      const recovery = reviewDestination(lesson, input) ?? earliestGapBefore(lesson, input);
      if (recovery !== null) {
        return recovery;
      }
      held = lesson;
      break;
    }
    return { kind: "start_lesson", lessonId: lesson.id, title: lesson.title };
  }

  const weak = weakReview(input, held);
  if (weak !== null) {
    return weak;
  }
  if (held !== null) {
    const recovered = reviewDestination(held, input) ?? earliestGapBefore(held, input);
    if (recovered !== null) {
      return recovered;
    }
  }

  return { kind: "path_complete" };
}

interface ReviewInput {
  lessons: LessonCandidate[];
  prerequisites: PrerequisiteEdge[];
  masteryByConcept: ReadonlyMap<string, MasterySnapshot | null>;
}

interface Blocker {
  conceptSlug: string;
  score: number | null;
}

function weakReview(input: ReviewInput, held: LessonCandidate | null): NextAction | null {
  const weak = [...input.masteryByConcept.entries()]
    .flatMap(([conceptSlug, mastery]) => {
      if (mastery === null || !isWeak(mastery)) {
        return [];
      }
      return [{ conceptSlug, score: mastery.score }];
    })
    .sort(compareBlockers);
  for (const concept of weak) {
    const recovered = reviewBlockers([concept], input, held);
    if (recovered !== null) {
      return recovered;
    }
  }
  return null;
}

function reviewDestination(lesson: LessonCandidate, input: ReviewInput): NextAction | null {
  return reviewBlockers(blockingConcepts(lesson, input), input, lesson);
}

function reviewBlockers(
  initial: Blocker[],
  input: ReviewInput,
  boundary: LessonCandidate | null,
): NextAction | null {
  const seen = new Set<string>();
  let pending = dedupeBlockers(initial);
  while (pending.length > 0) {
    const deeper: Blocker[] = [];
    for (const blocker of pending) {
      if (seen.has(blocker.conceptSlug)) {
        continue;
      }
      seen.add(blocker.conceptSlug);
      const taught = openLesson(blocker.conceptSlug, input, boundary);
      if (taught !== null) {
        return reviewAction(blocker.conceptSlug, taught);
      }
      for (const teacher of input.lessons) {
        if (
          teacher.status !== "published" ||
          !teacher.primaryConceptSlugs.includes(blocker.conceptSlug) ||
          (boundary !== null && (teacher.id === boundary.id || !isEarlierLesson(teacher, boundary)))
        ) {
          continue;
        }
        deeper.push(...blockingConcepts(teacher, input));
      }
    }
    pending = dedupeBlockers(deeper);
  }
  return null;
}

function earliestGapBefore(locked: LessonCandidate, input: ReviewInput): NextAction | null {
  const gaps: Array<Blocker & { lesson: LessonCandidate }> = [];
  for (const lesson of input.lessons) {
    if (lesson.status !== "published" || !isEarlierLesson(lesson, locked)) {
      continue;
    }
    if (
      !isLessonUnlocked({
        lesson,
        lessons: input.lessons,
        prerequisites: input.prerequisites,
        masteryByConcept: input.masteryByConcept,
      })
    ) {
      continue;
    }
    for (const conceptSlug of lesson.primaryConceptSlugs) {
      const mastery = input.masteryByConcept.get(conceptSlug);
      if (mastery !== undefined && mastery !== null && mastery.score >= UNLOCK_MASTERY) {
        continue;
      }
      gaps.push({
        conceptSlug,
        score: mastery === undefined || mastery === null ? null : mastery.score,
        lesson,
      });
    }
  }
  gaps.sort(
    (left, right) =>
      compareBlockers(left, right) ||
      left.lesson.modulePosition - right.lesson.modulePosition ||
      left.lesson.lessonPosition - right.lesson.lessonPosition ||
      left.lesson.slug.localeCompare(right.lesson.slug),
  );
  const gap = gaps[0];
  return gap === undefined ? null : reviewAction(gap.conceptSlug, gap.lesson);
}

function openLesson(
  conceptSlug: string,
  input: ReviewInput,
  before: LessonCandidate | null,
): PathLesson | null {
  return eligibleReviewLesson({
    lessons: input.lessons,
    conceptSlug,
    prerequisites: input.prerequisites,
    masteryByConcept: input.masteryByConcept,
    before:
      before === null
        ? undefined
        : { modulePosition: before.modulePosition, lessonPosition: before.lessonPosition },
  });
}

function blockingConcepts(lesson: LessonCandidate, input: ReviewInput): Blocker[] {
  const blockers: Blocker[] = [];
  const seen = new Set<string>();
  for (const conceptSlug of lesson.primaryConceptSlugs) {
    for (const prerequisiteSlug of getDirectPrerequisites(input.prerequisites, conceptSlug)) {
      if (seen.has(prerequisiteSlug)) {
        continue;
      }
      if (
        !isConceptTaughtInPath(input.lessons, prerequisiteSlug, {
          modulePosition: lesson.modulePosition,
          lessonPosition: lesson.lessonPosition,
        })
      ) {
        continue;
      }
      const mastery = input.masteryByConcept.get(prerequisiteSlug);
      if (mastery !== undefined && mastery !== null && mastery.score >= UNLOCK_MASTERY) {
        continue;
      }
      seen.add(prerequisiteSlug);
      blockers.push({
        conceptSlug: prerequisiteSlug,
        score: mastery === undefined || mastery === null ? null : mastery.score,
      });
    }
  }
  blockers.sort(compareBlockers);
  return blockers;
}

function dedupeBlockers(blockers: Blocker[]): Blocker[] {
  const seen = new Set<string>();
  const unique: Blocker[] = [];
  for (const blocker of [...blockers].sort(compareBlockers)) {
    if (seen.has(blocker.conceptSlug)) {
      continue;
    }
    seen.add(blocker.conceptSlug);
    unique.push(blocker);
  }
  return unique;
}

function compareBlockers(left: Blocker, right: Blocker): number {
  return (
    (left.score ?? Number.NEGATIVE_INFINITY) - (right.score ?? Number.NEGATIVE_INFINITY) ||
    left.conceptSlug.localeCompare(right.conceptSlug)
  );
}

function isEarlierLesson(lesson: PathLesson, before: PathLesson): boolean {
  return (
    lesson.modulePosition < before.modulePosition ||
    (lesson.modulePosition === before.modulePosition &&
      lesson.lessonPosition < before.lessonPosition)
  );
}

function reviewAction(conceptSlug: string, lesson: PathLesson): NextAction {
  return {
    kind: "review_concept",
    conceptSlug,
    lessonId: lesson.id,
    title: lesson.title,
  };
}
