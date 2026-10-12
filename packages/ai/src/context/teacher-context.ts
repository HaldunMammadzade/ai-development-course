import {
  decideAdaptive,
  getDirectPrerequisites,
  prerequisiteIsWeak,
  type AdaptiveEvidence,
} from "@platform/curriculum";
import type {
  ChallengeLevel,
  ExplanationStyle,
  LessonBlock,
  Locale,
  TeachingMode,
  TeachingState,
  TeacherContext,
} from "@platform/types";
import { MAX_TEACHER_MEMORY } from "@platform/curriculum";
import {
  GLOSSARY_REMINDER,
  MAX_HOMEWORK_CHARS,
  MAX_MESSAGE_CHARS,
  MAX_MISCONCEPTIONS,
  MAX_RECENT_MESSAGES,
  MAX_STUDENT_MESSAGE_CHARS,
  MAX_SUMMARY_CHARS,
} from "./limits";

export interface TeacherContextSource {
  student: {
    name: string | null;
    locale: Locale;
    timezone: string;
    explanationStyle: ExplanationStyle;
    challengeLevel: ChallengeLevel;
  };
  lesson: {
    slug: string;
    title: string;
    objective: string;
    currentBlock: LessonBlock;
    concepts: Array<{
      slug: string;
      name: string;
      role: "primary" | "supporting";
      mastery: number | null;
      evidenceCount?: number;
      lastEvidenceAt?: Date | null;
    }>;
    prerequisites: Array<{
      conceptSlug: string;
      prerequisiteSlug: string;
      name: string;
      mastery: number | null;
      evidenceCount?: number;
    }>;
  };
  learning: {
    misconceptions: Array<{
      code: string;
      description: string;
      conceptSlug: string;
      occurrenceCount?: number;
    }>;
    recentEvidence?: readonly AdaptiveEvidence[];
    homeworkPrompts: string[];
    memory?: Array<{
      category: "learning" | "mistake" | "preference";
      conceptSlug: string | null;
      content: string;
    }>;
  };
  session: {
    mode: TeachingMode;
    state: TeachingState;
    turnNumber: number;
    recentMessages: Array<{ role: "student" | "teacher"; speech: string }>;
    summary: string | null;
  };
  studentMessage: string;
  reviewConceptSlug?: string | null;
}

export function buildTeacherContext(source: TeacherContextSource): TeacherContext {
  const lessonSlugs = new Set(source.lesson.concepts.map((concept) => concept.slug));
  const edges = source.lesson.prerequisites.map((edge) => ({
    conceptSlug: edge.conceptSlug,
    prerequisiteSlug: edge.prerequisiteSlug,
  }));
  const directSlugSet = new Set<string>();
  for (const concept of source.lesson.concepts) {
    for (const slug of getDirectPrerequisites(edges, concept.slug)) {
      if (!lessonSlugs.has(slug)) {
        directSlugSet.add(slug);
      }
    }
  }
  const prerequisiteBySlug = new Map(
    source.lesson.prerequisites.map((edge) => [edge.prerequisiteSlug, edge]),
  );
  const directPrerequisites = [...directSlugSet].flatMap((slug) => {
    const edge = prerequisiteBySlug.get(slug);
    return edge === undefined ? [] : [{ slug, name: edge.name }];
  });

  const mastery = [
    ...source.lesson.concepts.map((concept) => ({
      slug: concept.slug,
      name: concept.name,
      mastery: concept.mastery,
    })),
    ...[...directSlugSet].flatMap((slug) => {
      const edge = prerequisiteBySlug.get(slug);
      return edge === undefined ? [] : [{ slug, name: edge.name, mastery: edge.mastery }];
    }),
  ];

  const misconceptions = [...source.learning.misconceptions]
    .sort((left, right) => {
      const leftRank = lessonSlugs.has(left.conceptSlug) ? 0 : 1;
      const rightRank = lessonSlugs.has(right.conceptSlug) ? 0 : 1;
      return leftRank - rightRank || left.code.localeCompare(right.code);
    })
    .slice(0, MAX_MISCONCEPTIONS)
    .map((item) => ({
      code: item.code,
      description: item.description.slice(0, 280),
      conceptSlug: item.conceptSlug,
    }));

  const homework = source.learning.homeworkPrompts
    .map((prompt) => prompt.trim())
    .find((prompt) => prompt.length > 0);
  const openHomework = homework === undefined ? null : homework.slice(0, MAX_HOMEWORK_CHARS);
  const summary = truncateSummary(source.session.summary);
  const recentMessages = source.session.recentMessages
    .filter((message) => message.role === "student" || message.role === "teacher")
    .slice(-MAX_RECENT_MESSAGES)
    .map((message) => ({
      role: message.role,
      speech: message.speech.slice(0, MAX_MESSAGE_CHARS),
    }));

  const memory = (source.learning.memory ?? [])
    .filter(
      (note) =>
        note.category === "learning" ||
        note.category === "mistake" ||
        note.category === "preference",
    )
    .slice(0, MAX_TEACHER_MEMORY)
    .map((note) => ({
      category: note.category,
      conceptSlug: note.conceptSlug,
      content: note.content.slice(0, 280),
    }));

  const allowCache =
    summary === null && misconceptions.length === 0 && openHomework === null && memory.length === 0;
  const reviewConcept = primaryReviewConcept(source);
  const lesson = {
    slug: source.lesson.slug,
    title: source.lesson.title,
    objective: source.lesson.objective,
    currentBlock: source.lesson.currentBlock,
    primaryConcepts: source.lesson.concepts
      .filter((concept) => concept.role === "primary")
      .map((concept) => ({ slug: concept.slug, name: concept.name })),
    supportingConcepts: source.lesson.concepts
      .filter((concept) => concept.role === "supporting")
      .map((concept) => ({ slug: concept.slug, name: concept.name })),
    directPrerequisites,
  };

  return {
    locale: source.student.locale,
    timezone: source.student.timezone,
    mode: source.session.mode,
    state: source.session.state,
    glossaryReminder: GLOSSARY_REMINDER,
    lesson:
      reviewConcept === null
        ? lesson
        : { ...lesson, reviewFocus: { slug: reviewConcept.slug, name: reviewConcept.name } },
    student: {
      name: source.student.name?.trim() ?? "",
      explanationStyle: source.student.explanationStyle,
      challengeLevel: source.student.challengeLevel,
    },
    learning: {
      mastery,
      misconceptions,
      adaptive: adaptiveChoice(source),
      openHomework,
      memory,
    },
    session: {
      mode: source.session.mode,
      state: source.session.state,
      turnNumber: source.session.turnNumber,
      recentMessages,
      summary,
    },
    studentMessage: source.studentMessage.slice(0, MAX_STUDENT_MESSAGE_CHARS),
    allowCache,
  };
}

function primaryReviewConcept(source: TeacherContextSource) {
  const slug = source.reviewConceptSlug;
  if (slug === null || slug === undefined || slug.length === 0) {
    return null;
  }
  return (
    source.lesson.concepts.find((concept) => concept.role === "primary" && concept.slug === slug) ??
    null
  );
}

function adaptiveChoice(source: TeacherContextSource): TeacherContext["learning"]["adaptive"] {
  const primary =
    primaryReviewConcept(source) ??
    source.lesson.concepts.find((concept) => concept.role === "primary") ??
    source.lesson.concepts[0];
  const slug = primary?.slug ?? source.lesson.slug;
  const prerequisiteWeak = source.lesson.prerequisites.some(
    (edge) =>
      edge.conceptSlug === slug &&
      prerequisiteIsWeak({
        score: edge.mastery,
        evidenceCount: edge.evidenceCount ?? 0,
      }),
  );
  const occurrences = source.learning.misconceptions
    .filter((item) => item.conceptSlug === slug)
    .reduce((highest, item) => Math.max(highest, item.occurrenceCount ?? 1), 0);
  const choice = decideAdaptive({
    now: new Date(),
    timeZone: source.student.timezone,
    concept: {
      score: primary?.mastery ?? null,
      evidenceCount: primary?.evidenceCount ?? 0,
      lastEvidenceAt: primary?.lastEvidenceAt ?? null,
    },
    prerequisiteWeak,
    misconceptionOccurrences: occurrences,
    recent: (source.learning.recentEvidence ?? []).filter(() => true).slice(0, 5),
  });
  return { conceptSlug: slug, ...choice };
}

function truncateSummary(summary: string | null): string | null {
  if (summary === null) {
    return null;
  }
  const trimmed = summary.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed.slice(0, MAX_SUMMARY_CHARS);
}
