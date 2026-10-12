import type {
  LearningActivityItem,
  LearningActivitySource,
  LearningCatalog,
  LessonAvailability,
  NextAction,
} from "@platform/types";
import { decideAdaptive, prerequisiteIsWeak, reviewDue } from "./adaptive";
import { confidenceLevel, masteryBand } from "./mastery";
import { GIT_MODULE_SLUG } from "./git-workflow";
import { TESTING_MODULE_SLUG } from "./testing-fundamentals";
import { isLessonUnlocked, type PrerequisiteEdge } from "./graph";
import { buildRevision, type RevisionExercise, type RevisionSuccessSummary } from "./revision";
import { buildSkillGraph, type SkillGraphConceptInput } from "./skill-graph";
import {
  getNextAction,
  type HomeworkCandidate,
  type LessonCandidate,
  type MasterySnapshot,
  type OpenSessionCandidate,
} from "./next-action";
import { buildPersonalizedPath, lessonIsCredited } from "./personalized-path";

export interface CatalogLessonSource {
  id: string;
  slug: string;
  title: string;
  objective: string;
  estimatedMinutes: number;
  position: number;
  status: "draft" | "published";
  primaryConceptSlugs: string[];
  supportingConceptSlugs: string[];
}

export interface CatalogModuleSource {
  slug: string;
  title: string;
  description: string;
  position: number;
  lessons: CatalogLessonSource[];
}

export interface CatalogContext {
  timeZone: string;
  homework: HomeworkCandidate[];
  sessions: OpenSessionCandidate[];
  lessons: LessonCandidate[];
  prerequisites: PrerequisiteEdge[];
  mastery: Array<{
    conceptSlug: string;
    score: number;
    evidenceCount: number;
    lastEvidenceAt?: Date | null;
  }>;
}

export function presentLearningCatalog(input: {
  now: Date;
  path: {
    slug: string;
    title: string;
    description: string;
    status: "draft" | "published";
  } | null;
  modules: CatalogModuleSource[];
  concepts: Array<{ slug: string; name: string; summary?: string }>;
  context: CatalogContext;
  evidence?: Array<{ conceptSlug: string; source: LearningActivitySource }>;
  revisionSuccesses?: RevisionSuccessSummary[];
  revisionExercises?: RevisionExercise[];
  activity?: Array<{
    id: string;
    source: LearningActivityItem["source"];
    conceptName: string;
    createdAt: Date;
  }>;
}): LearningCatalog {
  const masteryByConcept = new Map<string, MasterySnapshot>(
    input.context.mastery.map((row) => [
      row.conceptSlug,
      { score: row.score, evidenceCount: row.evidenceCount },
    ]),
  );
  const nextAction = getNextAction({
    now: input.now,
    timeZone: input.context.timeZone,
    homework: input.context.homework,
    sessions: input.context.sessions,
    lessons: input.context.lessons,
    prerequisites: input.context.prerequisites,
    masteryByConcept,
  });
  const progressByLesson = new Map(
    input.context.lessons.map((lesson) => [lesson.id, lesson.progress]),
  );
  const lessonById = new Map(input.context.lessons.map((lesson) => [lesson.id, lesson]));
  const names = new Map(input.concepts.map((concept) => [concept.slug, concept.name]));
  const summaries = new Map(input.concepts.map((concept) => [concept.slug, concept.summary ?? ""]));
  const evidenceByConcept = new Map(
    (input.evidence ?? []).map((item) => [item.conceptSlug, item.source]),
  );
  const skillConcepts: SkillGraphConceptInput[] = [];
  const published =
    input.path !== null && input.path.status === "published"
      ? [...input.modules].sort((left, right) => left.position - right.position)
      : [];
  const seen = new Set<string>();
  const concepts: LearningCatalog["concepts"] = [];

  const modules = published.flatMap((module) => {
    const lessons = [...module.lessons]
      .sort((left, right) => left.position - right.position)
      .flatMap((lesson) => {
        if (lesson.status !== "published") {
          return [];
        }
        for (const slug of [...lesson.primaryConceptSlugs, ...lesson.supportingConceptSlugs]) {
          if (seen.has(slug)) {
            continue;
          }
          seen.add(slug);
          const row = input.context.mastery.find((item) => item.conceptSlug === slug);
          const snapshot = masteryByConcept.get(slug);
          const band =
            snapshot === undefined ? null : masteryBand(snapshot.score, snapshot.evidenceCount);
          concepts.push({
            slug,
            name: names.get(slug) ?? slug,
            moduleTitle: module.title,
            lessonSlug: lesson.slug,
            mastery: snapshot?.score ?? null,
            confidence: snapshot === undefined ? null : confidenceLevel(snapshot.evidenceCount),
            band,
            reviewDue: reviewDue({
              now: input.now,
              timeZone: input.context.timeZone,
              concept: {
                score: snapshot?.score ?? null,
                evidenceCount: snapshot?.evidenceCount ?? 0,
                lastEvidenceAt: row?.lastEvidenceAt ?? null,
              },
            }),
          });
          skillConcepts.push({
            slug,
            name: names.get(slug) ?? slug,
            summary: summaries.get(slug) ?? "",
            moduleSlug: module.slug,
            moduleTitle: module.title,
            lessonSlug: lesson.slug,
            lessonTitle: lesson.title,
            lessonAvailability: "locked",
            band,
            evidenceSource: evidenceByConcept.get(slug) ?? null,
          });
        }
        const pathLesson = lessonById.get(lesson.id) ?? {
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          modulePosition: module.position,
          lessonPosition: lesson.position,
          status: lesson.status,
          primaryConceptSlugs: lesson.primaryConceptSlugs,
          supportingConceptSlugs: lesson.supportingConceptSlugs,
          progress: progressByLesson.get(lesson.id) ?? null,
        };
        const availability = lessonAvailability(
          lesson.id,
          progressByLesson.get(lesson.id) ?? null,
          nextAction,
          lessonIsCredited({
            lesson: pathLesson,
            lessons: input.context.lessons,
            prerequisites: input.context.prerequisites,
            masteryByConcept,
          }),
          (module.slug === GIT_MODULE_SLUG || module.slug === TESTING_MODULE_SLUG) &&
            isLessonUnlocked({
              lesson: pathLesson,
              lessons: input.context.lessons,
              prerequisites: input.context.prerequisites,
              masteryByConcept,
            }),
        );
        for (const slug of [...lesson.primaryConceptSlugs, ...lesson.supportingConceptSlugs]) {
          const skillConcept = skillConcepts.find((item) => item.slug === slug);
          if (skillConcept !== undefined && skillConcept.lessonSlug === lesson.slug) {
            skillConcept.lessonAvailability = availability;
          }
        }
        return [
          {
            slug: lesson.slug,
            title: lesson.title,
            objective: lesson.objective,
            estimatedMinutes: lesson.estimatedMinutes,
            availability,
          },
        ];
      });
    if (lessons.length === 0) {
      return [];
    }
    return [
      {
        slug: module.slug,
        title: module.title,
        description: module.description,
        lessons,
      },
    ];
  });

  const focus = catalogFocus(input.now, input.context, concepts);
  const moduleTitleByLesson = new Map<string, string>();
  for (const module of published) {
    for (const lesson of module.lessons) {
      moduleTitleByLesson.set(lesson.id, module.title);
    }
  }

  const lessonTitles = new Map(
    skillConcepts.map((concept) => [concept.lessonSlug, concept.lessonTitle]),
  );
  const revision = buildRevision({
    now: input.now,
    timeZone: input.context.timeZone,
    concepts: skillConcepts.map((concept) => ({
      slug: concept.slug,
      name: concept.name,
      lessonSlug: concept.lessonSlug,
      lessonTitle: concept.lessonTitle,
      lessonAvailability: concept.lessonAvailability,
      band: concept.band,
    })),
    successes: input.revisionSuccesses ?? [],
    exercises: input.revisionExercises ?? [],
    lessonTitles,
  });
  for (const concept of skillConcepts) {
    const state = revision.states.get(concept.slug);
    concept.revision =
      state === "due" || state === "overdue" || state === "recently_reviewed" ? state : null;
  }

  const personalized = buildPersonalizedPath({
    lessons: input.context.lessons.map((lesson) => ({
      ...lesson,
      moduleTitle: moduleTitleByLesson.get(lesson.id) ?? "",
    })),
    prerequisites: input.context.prerequisites,
    masteryByConcept,
    names,
    focus,
    preferredLessonId: nextAction.kind === "review_concept" ? nextAction.lessonId : undefined,
  });

  return {
    path:
      input.path === null || input.path.status !== "published"
        ? null
        : {
            slug: input.path.slug,
            title: input.path.title,
            description: input.path.description,
          },
    modules,
    concepts,
    focus,
    nextAction,
    activity: (input.activity ?? []).slice(0, 6).map((item) => ({
      id: item.id,
      source: item.source,
      conceptName: item.conceptName,
      createdAt: item.createdAt.toISOString(),
    })),
    personalized,
    skill: buildSkillGraph({
      concepts: skillConcepts,
      prerequisites: input.context.prerequisites,
      path: personalized,
    }),
    revision: { status: revision.status, items: revision.items },
  };
}

function catalogFocus(
  now: Date,
  context: CatalogContext,
  concepts: LearningCatalog["concepts"],
): LearningCatalog["focus"] {
  const mastery = new Map(context.mastery.map((row) => [row.conceptSlug, row]));
  let best: LearningCatalog["focus"] = null;
  let bestRank = 9;
  for (const concept of concepts) {
    const row = mastery.get(concept.slug);
    const prerequisiteWeak = context.prerequisites.some((edge) => {
      if (edge.conceptSlug !== concept.slug) {
        return false;
      }
      const prerequisite = mastery.get(edge.prerequisiteSlug);
      return prerequisiteIsWeak({
        score: prerequisite?.score ?? null,
        evidenceCount: prerequisite?.evidenceCount ?? 0,
      });
    });
    const choice = decideAdaptive({
      now,
      timeZone: context.timeZone,
      concept: {
        score: row?.score ?? null,
        evidenceCount: row?.evidenceCount ?? 0,
        lastEvidenceAt: row?.lastEvidenceAt ?? null,
      },
      prerequisiteWeak,
      misconceptionOccurrences: 0,
      recent: [],
    });
    const rank = focusRank(choice.decision);
    if (rank < bestRank) {
      bestRank = rank;
      best = {
        slug: concept.slug,
        name: concept.name,
        decision: choice.decision,
        reason: choice.reason,
      };
    }
  }
  return best;
}

function focusRank(decision: NonNullable<LearningCatalog["focus"]>["decision"]): number {
  switch (decision) {
    case "REMEDIATE_PREREQUISITE":
      return 0;
    case "REEXPLAIN":
      return 1;
    case "REVIEW":
      return 2;
    case "RETRY":
      return 3;
    case "HINT":
      return 4;
    case "CHALLENGE":
      return 5;
    case "CONTINUE":
      return 9;
  }
}

function lessonAvailability(
  lessonId: string,
  progress: LessonCandidate["progress"] | null,
  nextAction: NextAction,
  credited: boolean,
  practice: boolean,
): LessonAvailability {
  if (actionableLessonId(nextAction) === lessonId) {
    return "current";
  }
  if (progress === "completed" || credited) {
    return "completed";
  }
  if (practice) {
    return "practice";
  }
  return "locked";
}

function actionableLessonId(action: NextAction): string | null {
  switch (action.kind) {
    case "start_lesson":
    case "continue_lesson":
    case "review_concept":
      return action.lessonId;
    case "do_homework":
    case "path_complete":
      return null;
  }
}
