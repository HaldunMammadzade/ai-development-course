import type { LessonBlock, PublishStatus } from "@platform/types";
import { UNLOCK_MASTERY } from "./time";

export interface PathLesson {
  id: string;
  slug: string;
  title: string;
  modulePosition: number;
  lessonPosition: number;
  status: PublishStatus;
  primaryConceptSlugs: string[];
  supportingConceptSlugs: string[];
}

export interface PrerequisiteEdge {
  conceptSlug: string;
  prerequisiteSlug: string;
}

export function getDirectPrerequisites(edges: PrerequisiteEdge[], conceptSlug: string): string[] {
  return edges
    .filter((edge) => edge.conceptSlug === conceptSlug)
    .map((edge) => edge.prerequisiteSlug);
}

export function isConceptTaughtInPath(
  lessons: PathLesson[],
  conceptSlug: string,
  before?: { modulePosition: number; lessonPosition: number },
): boolean {
  return lessons.some(
    (lesson) =>
      lesson.status === "published" &&
      lesson.primaryConceptSlugs.includes(conceptSlug) &&
      (before === undefined || isEarlier(lesson, before)),
  );
}

export function getLessonThatTeachesConcept(
  lessons: PathLesson[],
  conceptSlug: string,
): PathLesson | null {
  const matches = lessons
    .filter(
      (lesson) => lesson.status === "published" && lesson.primaryConceptSlugs.includes(conceptSlug),
    )
    .sort(compareLessonOrder);
  return matches[0] ?? null;
}

export function eligibleReviewLesson(input: {
  lessons: readonly PathLesson[];
  conceptSlug: string;
  prerequisites: readonly PrerequisiteEdge[];
  masteryByConcept: ReadonlyMap<string, { score: number } | null>;
  before?: { modulePosition: number; lessonPosition: number };
}): PathLesson | null {
  const matches = input.lessons
    .filter(
      (lesson) =>
        lesson.status === "published" &&
        lesson.primaryConceptSlugs.includes(input.conceptSlug) &&
        (input.before === undefined || isEarlier(lesson, input.before)) &&
        isLessonUnlocked({
          lesson,
          lessons: [...input.lessons],
          prerequisites: [...input.prerequisites],
          masteryByConcept: input.masteryByConcept,
        }),
    )
    .sort(compareReviewOrder);
  return matches[0] ?? null;
}

export function isLessonUnlocked(input: {
  lesson: PathLesson;
  lessons: PathLesson[];
  prerequisites: PrerequisiteEdge[];
  masteryByConcept: ReadonlyMap<string, { score: number } | null>;
}): boolean {
  if (input.lesson.status !== "published") {
    return false;
  }

  for (const conceptSlug of input.lesson.primaryConceptSlugs) {
    for (const prerequisiteSlug of getDirectPrerequisites(input.prerequisites, conceptSlug)) {
      const taught = isConceptTaughtInPath(input.lessons, prerequisiteSlug, {
        modulePosition: input.lesson.modulePosition,
        lessonPosition: input.lesson.lessonPosition,
      });
      if (!taught) {
        continue;
      }
      const mastery = input.masteryByConcept.get(prerequisiteSlug);
      if (mastery === undefined || mastery === null || mastery.score < UNLOCK_MASTERY) {
        return false;
      }
    }
  }
  return true;
}

export function lessonHasHarderCheck(blocks: LessonBlock[]): boolean {
  return blocks.some((block) => block.type === "check_question" && block.harder === true);
}

export function hasRemainingCheckQuestion(
  blocks: LessonBlock[],
  usedPositions: ReadonlySet<number>,
): boolean {
  return blocks.some(
    (block) => block.type === "check_question" && !usedPositions.has(block.position),
  );
}

export function recapPracticePrompt(blocks: LessonBlock[]): string | null {
  const recap = blocks.find((block) => block.type === "recap");
  return recap === undefined ? null : recap.practicePrompt;
}

function isEarlier(
  lesson: PathLesson,
  before: { modulePosition: number; lessonPosition: number },
): boolean {
  return (
    lesson.modulePosition < before.modulePosition ||
    (lesson.modulePosition === before.modulePosition &&
      lesson.lessonPosition < before.lessonPosition)
  );
}

function compareLessonOrder(left: PathLesson, right: PathLesson): number {
  if (left.modulePosition !== right.modulePosition) {
    return left.modulePosition - right.modulePosition;
  }
  return left.lessonPosition - right.lessonPosition;
}

function compareReviewOrder(left: PathLesson, right: PathLesson): number {
  return compareLessonOrder(left, right) || left.slug.localeCompare(right.slug);
}
