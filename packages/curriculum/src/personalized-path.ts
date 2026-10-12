import type { PersonalizedPath, PersonalizedPathStep } from "@platform/types";

type FocusDecision =
  "CONTINUE" | "REEXPLAIN" | "HINT" | "RETRY" | "REVIEW" | "CHALLENGE" | "REMEDIATE_PREREQUISITE";
import { isLessonUnlocked, type PathLesson, type PrerequisiteEdge } from "./graph";
import { isWeak } from "./mastery";
import type { LessonCandidate, MasterySnapshot } from "./next-action";
import { UNLOCK_MASTERY } from "./time";

const FOUNDATION_NOTE = "Bu mərhələyə keçmək üçün bir əsas mövzu qalıb.";
const STRENGTHEN_NOTE = "Əvvəl bu əsas mövzunu möhkəmləndirək.";
const REVIEW_NOTE = "Bu mövzunun əsaslarını əvvəlcə möhkəmləndirək.";

export function lessonIsCredited(input: {
  lesson: LessonCandidate;
  lessons: readonly PathLesson[];
  prerequisites: readonly PrerequisiteEdge[];
  masteryByConcept: ReadonlyMap<string, { score: number } | null>;
}): boolean {
  if (input.lesson.progress === "completed") {
    return true;
  }
  if (!primariesKnown(input.lesson, input.masteryByConcept)) {
    return false;
  }
  return isLessonUnlocked({
    lesson: input.lesson,
    lessons: [...input.lessons],
    prerequisites: [...input.prerequisites],
    masteryByConcept: input.masteryByConcept,
  });
}

export function buildPersonalizedPath(input: {
  lessons: Array<LessonCandidate & { moduleTitle: string }>;
  prerequisites: readonly PrerequisiteEdge[];
  masteryByConcept: ReadonlyMap<string, MasterySnapshot | null>;
  names: ReadonlyMap<string, string>;
  focus: { decision: FocusDecision } | null;
  preferredLessonId?: string;
}): PersonalizedPath {
  const ordered = published(input.lessons);
  const preferred =
    input.preferredLessonId === undefined
      ? null
      : (ordered.find((lesson) => lesson.id === input.preferredLessonId) ?? null);
  const current =
    preferred ??
    ordered.find(
      (lesson) =>
        !lessonIsCredited({
          lesson,
          lessons: ordered,
          prerequisites: input.prerequisites,
          masteryByConcept: input.masteryByConcept,
        }) &&
        isLessonUnlocked({
          lesson,
          lessons: ordered,
          prerequisites: [...input.prerequisites],
          masteryByConcept: input.masteryByConcept,
        }),
    ) ??
    null;
  const next =
    current === null
      ? []
      : ordered
          .filter(
            (lesson) =>
              isAfter(lesson, current) &&
              !lessonIsCredited({
                lesson,
                lessons: ordered,
                prerequisites: input.prerequisites,
                masteryByConcept: input.masteryByConcept,
              }) &&
              !primariesKnown(lesson, input.masteryByConcept),
          )
          .slice(0, 3)
          .map((lesson) => toStep(lesson));
  const foundation = ordered.some(
    (lesson) =>
      primariesKnown(lesson, input.masteryByConcept) &&
      !lessonIsCredited({
        lesson,
        lessons: ordered,
        prerequisites: input.prerequisites,
        masteryByConcept: input.masteryByConcept,
      }),
  );

  return {
    note: noteFor(foundation, input.focus),
    current: current === null ? null : toStep(current),
    next,
    concepts: conceptStrip(ordered, current, input.masteryByConcept, input.names),
    known: knownNames(ordered, current, input.masteryByConcept, input.names),
  };
}

function published<T extends LessonCandidate>(lessons: readonly T[]): T[] {
  return [...lessons]
    .filter((lesson) => lesson.status === "published")
    .sort(
      (left, right) =>
        left.modulePosition - right.modulePosition ||
        left.lessonPosition - right.lessonPosition ||
        left.slug.localeCompare(right.slug),
    );
}

function primariesKnown(
  lesson: PathLesson,
  masteryByConcept: ReadonlyMap<string, { score: number } | null>,
): boolean {
  if (lesson.primaryConceptSlugs.length === 0) {
    return false;
  }
  return lesson.primaryConceptSlugs.every((slug) => {
    const row = masteryByConcept.get(slug);
    return row !== undefined && row !== null && row.score >= UNLOCK_MASTERY;
  });
}

function isAfter(lesson: PathLesson, current: PathLesson): boolean {
  return (
    lesson.modulePosition > current.modulePosition ||
    (lesson.modulePosition === current.modulePosition &&
      lesson.lessonPosition > current.lessonPosition)
  );
}

function toStep(lesson: LessonCandidate & { moduleTitle: string }): PersonalizedPathStep {
  return {
    slug: lesson.slug,
    title: lesson.title,
    moduleTitle: lesson.moduleTitle,
  };
}

function noteFor(foundation: boolean, focus: { decision: FocusDecision } | null): string | null {
  if (foundation) {
    return FOUNDATION_NOTE;
  }
  if (focus?.decision === "REMEDIATE_PREREQUISITE" || focus?.decision === "REEXPLAIN") {
    return STRENGTHEN_NOTE;
  }
  if (focus?.decision === "REVIEW" || focus?.decision === "RETRY" || focus?.decision === "HINT") {
    return REVIEW_NOTE;
  }
  return null;
}

function conceptStrip(
  ordered: Array<LessonCandidate & { moduleTitle: string }>,
  current: (LessonCandidate & { moduleTitle: string }) | null,
  masteryByConcept: ReadonlyMap<string, MasterySnapshot | null>,
  names: ReadonlyMap<string, string>,
): PersonalizedPath["concepts"] {
  if (current === null) {
    return [];
  }
  const seen = new Set<string>();
  const concepts = ordered
    .filter((lesson) => lesson.modulePosition === current.modulePosition)
    .flatMap((lesson) => lesson.primaryConceptSlugs)
    .flatMap((slug) => {
      if (seen.has(slug)) {
        return [];
      }
      const name = names.get(slug);
      if (name === undefined) {
        return [];
      }
      seen.add(slug);
      const row = masteryByConcept.get(slug) ?? null;
      const known = row !== null && row.score >= UNLOCK_MASTERY;
      const mark = known
        ? "known"
        : current.primaryConceptSlugs.includes(slug)
          ? "current"
          : row !== null && isWeak(row)
            ? "review"
            : "upcoming";
      return [{ slug, name, mark }] as const;
    });
  const currentIndex = concepts.findIndex((concept) => concept.mark === "current");
  if (concepts.length <= 8 || currentIndex < 0) {
    return concepts.slice(0, 8);
  }
  const start = Math.max(0, Math.min(currentIndex - 2, concepts.length - 8));
  return concepts.slice(start, start + 8);
}

function knownNames(
  ordered: Array<LessonCandidate & { moduleTitle: string }>,
  current: (LessonCandidate & { moduleTitle: string }) | null,
  masteryByConcept: ReadonlyMap<string, MasterySnapshot | null>,
  names: ReadonlyMap<string, string>,
): string[] {
  const seen = new Set<string>();
  const earlier: string[] = [];
  const later: string[] = [];
  for (const lesson of ordered) {
    for (const slug of lesson.primaryConceptSlugs) {
      if (seen.has(slug)) {
        continue;
      }
      const row = masteryByConcept.get(slug);
      if (row === undefined || row === null || row.score < UNLOCK_MASTERY) {
        continue;
      }
      const name = names.get(slug);
      if (name === undefined) {
        seen.add(slug);
        continue;
      }
      seen.add(slug);
      const bucket = current !== null && isAfter(lesson, current) ? later : earlier;
      if (!bucket.includes(name)) {
        bucket.push(name);
      }
    }
  }
  const strip = conceptStrip(ordered, current, masteryByConcept, names)
    .filter((concept) => concept.mark === "known")
    .map((concept) => concept.name);
  const unique: string[] = [];
  for (const name of [...strip, ...later.slice(0, 4), ...earlier.slice(-4)]) {
    if (!unique.includes(name)) {
      unique.push(name);
    }
  }
  return unique.slice(0, 8);
}
