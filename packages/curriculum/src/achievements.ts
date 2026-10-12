import type { Achievement, AchievementCategory, AchievementList } from "@platform/types";
import { REVISION_SUCCESS_EVIDENCE, type RevisionEvent } from "./revision";

export interface AchievementLessonFact {
  status: "draft" | "published";
  progress: "not_started" | "in_progress" | "completed" | null;
  completedAt: Date | null;
}

export interface AchievementModuleFact {
  slug: string;
  position: number;
  lessons: readonly AchievementLessonFact[];
}

export interface AchievementProjectFact {
  slug: string;
  milestoneIds: readonly string[];
}

export interface AchievementPassFact {
  milestoneId: string;
  passedAt: Date;
}

export interface AchievementFacts {
  modules: readonly AchievementModuleFact[];
  events: readonly RevisionEvent[];
  assessment: {
    status: "in_progress" | "completed" | "skipped";
    completedAt: Date | null;
  } | null;
  projects: readonly AchievementProjectFact[];
  passes: readonly AchievementPassFact[];
  interviewPublished: boolean;
  interviewCompletedAt: Date | null;
}

const CATEGORY_ORDER: readonly AchievementCategory[] = [
  "learning",
  "skill",
  "practice",
  "project",
  "interview",
];

const MODULE_MILESTONES = [
  {
    id: "html-foundations",
    moduleSlug: "html",
    title: "HTML əsasları",
    description: "HTML əsaslarını tamamladın",
  },
  {
    id: "css-foundations",
    moduleSlug: "css",
    title: "CSS əsasları",
    description: "CSS əsaslarını tamamladın",
  },
  {
    id: "javascript-foundations",
    moduleSlug: "javascript",
    title: "JavaScript əsasları",
    description: "JavaScript əsaslarını tamamladın",
  },
  {
    id: "typescript-foundations",
    moduleSlug: "typescript-fundamentals",
    title: "TypeScript əsasları",
    description: "TypeScript əsaslarını tamamladın",
  },
  {
    id: "react-foundations",
    moduleSlug: "react-fundamentals",
    title: "React əsasları",
    description: "React əsaslarını tamamladın",
  },
  {
    id: "nextjs-foundations",
    moduleSlug: "nextjs-fundamentals",
    title: "Next.js əsasları",
    description: "Next.js əsaslarını tamamladın",
  },
] as const;

interface Draft {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  earned: boolean;
  earnedAt: Date | null;
  order: number;
}

export function buildAchievements(facts: AchievementFacts): AchievementList {
  const drafts: Draft[] = [];
  const firstLesson = earliestLessonCompletion(facts.modules);
  if (firstLesson.available) {
    drafts.push({
      id: "first-lesson",
      title: "İlk addım",
      description: "İlk dərsi tamamladın",
      category: "learning",
      earned: firstLesson.earned,
      earnedAt: firstLesson.earned ? firstLesson.earnedAt : null,
      order: 0,
    });
  }
  const revisionAt = firstRevisionAt(facts.events);
  drafts.push({
    id: "first-revision",
    title: "İlk təkrar",
    description: "Öyrəndiyini yenidən təsdiqlədin",
    category: "learning",
    earned: revisionAt !== null,
    earnedAt: revisionAt,
    order: 1,
  });
  const assessmentDone = facts.assessment?.status === "completed";
  drafts.push({
    id: "skill-map",
    title: "Bacarıq xəritən hazırdır",
    description: "İlkin qiymətləndirməni tamamladın",
    category: "skill",
    earned: assessmentDone,
    earnedAt: assessmentDone ? validDate(facts.assessment?.completedAt ?? null) : null,
    order: 0,
  });
  for (const milestone of MODULE_MILESTONES) {
    const module = facts.modules.find((item) => item.slug === milestone.moduleSlug);
    if (module === undefined) {
      continue;
    }
    const published = module.lessons.filter((lesson) => lesson.status === "published");
    if (published.length === 0) {
      continue;
    }
    const earned = published.every((lesson) => lesson.progress === "completed");
    drafts.push({
      id: milestone.id,
      title: milestone.title,
      description: milestone.description,
      category: "skill",
      earned,
      earnedAt: earned ? latestDate(published.map((lesson) => lesson.completedAt)) : null,
      order: 10 + module.position,
    });
  }
  const exerciseAt = firstExerciseAt(facts.events);
  drafts.push({
    id: "first-exercise",
    title: "İlk məşq",
    description: "İlk məşqi uğurla tamamladın",
    category: "practice",
    earned: exerciseAt !== null,
    earnedAt: exerciseAt,
    order: 0,
  });
  const projectAt = firstProjectAt(facts.projects, facts.passes);
  if (projectAt.available) {
    drafts.push({
      id: "first-project",
      title: "İlk layihə",
      description: "İlk real layihəni tamamladın",
      category: "project",
      earned: projectAt.earnedAt !== null,
      earnedAt: projectAt.earnedAt,
      order: 0,
    });
  }
  if (facts.interviewPublished) {
    const interviewAt = validDate(facts.interviewCompletedAt);
    drafts.push({
      id: "first-interview",
      title: "İlk müsahibə",
      description: "İlk texniki müsahibəni tamamladın",
      category: "interview",
      earned: interviewAt !== null,
      earnedAt: interviewAt,
      order: 0,
    });
  }

  const items = drafts
    .sort(
      (left, right) =>
        CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category) ||
        left.order - right.order ||
        left.id.localeCompare(right.id),
    )
    .map(toAchievement);
  const earned = items.filter((item) => item.state === "earned");
  return {
    items,
    earnedCount: earned.length,
    latest: latestEarned(earned),
  };
}

function toAchievement(draft: Draft): Achievement {
  return {
    id: draft.id,
    title: draft.title,
    description: draft.description,
    category: draft.category,
    state: draft.earned ? "earned" : "locked",
    earnedAt: draft.earned && draft.earnedAt !== null ? draft.earnedAt.toISOString() : null,
  };
}

function earliestLessonCompletion(modules: readonly AchievementModuleFact[]): {
  available: boolean;
  earned: boolean;
  earnedAt: Date | null;
} {
  const published = modules.flatMap((module) =>
    module.lessons.filter((lesson) => lesson.status === "published"),
  );
  if (published.length === 0) {
    return { available: false, earned: false, earnedAt: null };
  }
  const completed = published.filter((lesson) => lesson.progress === "completed");
  if (completed.length === 0) {
    return { available: true, earned: false, earnedAt: null };
  }
  return {
    available: true,
    earned: true,
    earnedAt: earliestDate(completed.map((lesson) => lesson.completedAt)),
  };
}

function firstExerciseAt(events: readonly RevisionEvent[]): Date | null {
  let earliest: Date | null = null;
  const seen = new Set<string>();
  for (const event of ordered(events)) {
    if (event.source !== "exercise" || seen.has(event.id)) {
      continue;
    }
    seen.add(event.id);
    earliest = earliest === null ? event.occurredAt : earliest;
    break;
  }
  return validDate(earliest);
}

function firstRevisionAt(events: readonly RevisionEvent[]): Date | null {
  const grouped = new Map<string, { ids: Set<string>; second: Date | null }>();
  for (const event of ordered(events)) {
    if (event.evidence < REVISION_SUCCESS_EVIDENCE || event.source === "speaking") {
      continue;
    }
    const current = grouped.get(event.conceptSlug) ?? { ids: new Set<string>(), second: null };
    if (current.ids.has(event.id)) {
      grouped.set(event.conceptSlug, current);
      continue;
    }
    current.ids.add(event.id);
    if (current.ids.size === 2) {
      current.second = event.occurredAt;
    }
    grouped.set(event.conceptSlug, current);
  }
  return earliestDate([...grouped.values()].map((value) => value.second));
}

function firstProjectAt(
  projects: readonly AchievementProjectFact[],
  passes: readonly AchievementPassFact[],
): { available: boolean; earnedAt: Date | null } {
  const real = projects.filter((project) => project.milestoneIds.length > 0);
  if (real.length === 0) {
    return { available: false, earnedAt: null };
  }
  const passedAt = new Map<string, Date>();
  for (const pass of passes) {
    const current = passedAt.get(pass.milestoneId);
    if (current === undefined || pass.passedAt.getTime() < current.getTime()) {
      passedAt.set(pass.milestoneId, pass.passedAt);
    }
  }
  const completions: Date[] = [];
  for (const project of real) {
    const times = project.milestoneIds.map((id) => passedAt.get(id) ?? null);
    if (times.every((time) => time !== null)) {
      const done = latestDate(times);
      if (done !== null) {
        completions.push(done);
      }
    }
  }
  return { available: true, earnedAt: earliestDate(completions) };
}

function latestEarned(earned: readonly Achievement[]): Achievement | null {
  if (earned.length === 0) {
    return null;
  }
  return (
    [...earned].sort((left, right) => {
      const leftAt = left.earnedAt ?? "";
      const rightAt = right.earnedAt ?? "";
      if (leftAt !== rightAt) {
        return rightAt.localeCompare(leftAt);
      }
      return left.id.localeCompare(right.id);
    })[0] ?? null
  );
}

function ordered(events: readonly RevisionEvent[]): RevisionEvent[] {
  return [...events].sort(
    (left, right) =>
      left.occurredAt.getTime() - right.occurredAt.getTime() || left.id.localeCompare(right.id),
  );
}

function earliestDate(values: readonly (Date | null)[]): Date | null {
  let best: Date | null = null;
  for (const value of values) {
    const date = validDate(value);
    if (date !== null && (best === null || date.getTime() < best.getTime())) {
      best = date;
    }
  }
  return best;
}

function latestDate(values: readonly (Date | null)[]): Date | null {
  let best: Date | null = null;
  for (const value of values) {
    const date = validDate(value);
    if (date !== null && (best === null || date.getTime() > best.getTime())) {
      best = date;
    }
  }
  return best;
}

function validDate(value: Date | null): Date | null {
  if (value === null || Number.isNaN(value.getTime())) {
    return null;
  }
  return value;
}
