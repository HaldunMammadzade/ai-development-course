import type {
  HomeworkListResponse,
  LearningCatalog,
  LearningCatalogConcept,
  PersonalizedPath,
  ProjectDetail,
  ProjectSummary,
  RevisionQueue,
  SkillGraph,
} from "@platform/types";
import { copy } from "@/lib/copy";
import { actionLabel } from "@/lib/teaching/presentation";
import { findCurrentLesson, lessonHref } from "./catalog-view";

export interface DashboardHero {
  eyebrow: string;
  title: string;
  moduleTitle: string | null;
  description: string | null;
  minutes: number | null;
  href: string | null;
  action: string;
}

export interface DashboardFocus {
  name: string;
  body: string;
  href: string;
}

export interface DashboardPath {
  title: string;
  description: string;
  moduleTitle: string | null;
  completed: number;
  total: number;
}

export interface DashboardWeakConcept {
  slug: string;
  name: string;
  status: string;
  href: string | null;
}

export interface SkillSnapshot {
  moduleTitle: string | null;
  weak: string[];
  strong: string[];
  unknown: number;
}

export interface DashboardHomeworkItem {
  id: string;
  title: string;
  dueAt: string;
}

export interface DashboardProject {
  title: string;
  href: string;
  passed: number;
  total: number;
  milestoneTitle: string | null;
  milestonePosition: number | null;
  completed: boolean;
}

export interface DashboardActivity {
  id: string;
  label: string;
  conceptName: string;
  createdAt: string;
}

export interface DashboardModel {
  hero: DashboardHero;
  focus: DashboardFocus | null;
  path: DashboardPath | null;
  route: PersonalizedPath | null;
  weak: DashboardWeakConcept[];
  homework:
    { status: "ready"; items: DashboardHomeworkItem[] } | { status: "error"; message: string };
  project:
    { status: "ready"; item: DashboardProject | null } | { status: "error"; message: string };
  snapshot: SkillSnapshot | null;
  revision: RevisionQueue | null;
  activity: DashboardActivity[];
}

export function buildDashboard(input: {
  catalog: LearningCatalog;
  homework: HomeworkListResponse | string;
  projects: ProjectSummary[] | string;
  projectDetail: ProjectDetail | null;
}): DashboardModel {
  const lessons = input.catalog.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({ moduleTitle: module.title, lesson })),
  );
  const completed = lessons.filter((item) => item.lesson.availability === "completed").length;
  const current = findCurrentLesson(input.catalog);
  return {
    hero: hero(input.catalog, current, completed, input.homework),
    focus: focus(input.catalog),
    path: path(input.catalog, current?.moduleTitle ?? null, completed, lessons.length),
    route: input.catalog.personalized ?? null,
    weak: weakConcepts(input.catalog),
    homework: homeworkSection(input.homework),
    project: projectSection(input.projects, input.projectDetail),
    snapshot: skillSnapshot(input.catalog.skill),
    revision: revisionSection(input.catalog.revision),
    activity: activity(input.catalog),
  };
}

function hero(
  catalog: LearningCatalog,
  current: ReturnType<typeof findCurrentLesson>,
  completed: number,
  homework: HomeworkListResponse | string,
): DashboardHero {
  const action = catalog.nextAction;
  const assigned =
    action.kind === "do_homework" && typeof homework !== "string"
      ? homework.homework.find((item) => item.id === action.homeworkId)
      : undefined;
  const eyebrow =
    action.kind === "path_complete"
      ? copy.learn.title
      : action.kind === "do_homework"
        ? copy.dashboard.homework
        : action.kind === "review_concept"
          ? copy.dashboard.review
          : action.kind === "start_lesson" && completed === 0
            ? copy.dashboard.startHere
            : copy.dashboard.continueLead;
  const titled =
    assigned?.lessonTitle ??
    current?.lesson.title ??
    ("title" in action && typeof action.title === "string" && action.title.trim().length > 0
      ? action.title
      : null);
  const title =
    action.kind === "path_complete"
      ? copy.dashboard.pathComplete
      : (titled ?? copy.actions[action.kind]);
  return {
    eyebrow,
    title,
    moduleTitle: current?.moduleTitle ?? null,
    description: assigned?.prompt ?? current?.lesson.objective ?? null,
    minutes: assigned === undefined ? (current?.lesson.estimatedMinutes ?? null) : null,
    href: heroHref(catalog, current),
    action: actionLabel(action),
  };
}

function heroHref(
  catalog: LearningCatalog,
  current: ReturnType<typeof findCurrentLesson>,
): string | null {
  const action = catalog.nextAction;
  if (action.kind === "path_complete") {
    return null;
  }
  if (action.kind === "do_homework") {
    return "/app/homework";
  }
  if (current !== null) {
    return lessonHref(current.lesson.slug);
  }
  if (action.kind === "review_concept") {
    return null;
  }
  return "/app/learn";
}

function focus(catalog: LearningCatalog): DashboardFocus | null {
  const current = catalog.focus;
  if (current === null || current.reason === "baseline") {
    return null;
  }
  const concept = catalog.concepts.find((item) => item.slug === current.slug);
  const reason = copy.adaptive[current.reason as keyof typeof copy.adaptive];
  const href = concept === undefined ? "/app/learn" : openLessonHref(catalog, concept.lessonSlug);
  return {
    name: current.name,
    body: reason ?? copy.adaptive.baseline,
    href: href ?? "/app/progress",
  };
}

function path(
  catalog: LearningCatalog,
  moduleTitle: string | null,
  completed: number,
  total: number,
): DashboardPath | null {
  if (catalog.path === null || total === 0) {
    return null;
  }
  return {
    title: catalog.path.title,
    description: catalog.path.description,
    moduleTitle,
    completed,
    total,
  };
}

function weakConcepts(catalog: LearningCatalog): DashboardWeakConcept[] {
  return catalog.concepts
    .filter(
      (concept): concept is LearningCatalogConcept & { mastery: number } =>
        concept.band === "weak" && concept.mastery !== null,
    )
    .sort(
      (left, right) => left.mastery - right.mastery || left.name.localeCompare(right.name, "az"),
    )
    .slice(0, 3)
    .map((concept) => ({
      slug: concept.slug,
      name: concept.name,
      status: copy.progress.states.weak,
      href: openLessonHref(catalog, concept.lessonSlug),
    }));
}

function openLessonHref(catalog: LearningCatalog, lessonSlug: string): string | null {
  const lesson = catalog.modules
    .flatMap((pathModule) => pathModule.lessons)
    .find((item) => item.slug === lessonSlug);
  if (lesson === undefined || lesson.availability === "locked") {
    return null;
  }
  return lessonHref(lessonSlug);
}

function revisionSection(queue: RevisionQueue | undefined): RevisionQueue | null {
  if (queue === undefined || queue.status !== "ready" || queue.items.length === 0) {
    return null;
  }
  return queue;
}

function skillSnapshot(skill: SkillGraph | undefined): SkillSnapshot | null {
  if (skill === undefined || skill.concepts.length === 0) {
    return null;
  }
  const names = (state: SkillGraph["concepts"][number]["state"]) =>
    skill.concepts.filter((concept) => concept.state === state).map((concept) => concept.name);
  return {
    moduleTitle: skill.focus?.moduleTitle ?? null,
    weak: names("weak").slice(0, 3),
    strong: names("strong").slice(0, 3),
    unknown: names("unknown").length,
  };
}

function homeworkSection(homework: HomeworkListResponse | string): DashboardModel["homework"] {
  if (typeof homework === "string") {
    return { status: "error", message: homework };
  }
  return {
    status: "ready",
    items: homework.homework
      .filter((item) => item.status === "assigned")
      .sort(
        (left, right) => left.dueAt.localeCompare(right.dueAt) || left.id.localeCompare(right.id),
      )
      .slice(0, 3)
      .map((item) => ({
        id: item.id,
        title: item.lessonTitle,
        dueAt: item.dueAt,
      })),
  };
}

function projectSection(
  projects: ProjectSummary[] | string,
  detail: ProjectDetail | null,
): DashboardModel["project"] {
  if (typeof projects === "string") {
    return { status: "error", message: projects };
  }
  const summary = projects.find((item) => !item.completed) ?? projects[0] ?? null;
  if (summary === null) {
    return { status: "ready", item: null };
  }
  const milestone =
    detail !== null && detail.slug === summary.slug
      ? (detail.milestones.find((item) => item.status === "current") ?? null)
      : null;
  return {
    status: "ready",
    item: {
      title: summary.title,
      href: `/app/projects/${summary.slug}`,
      passed: summary.passedMilestones,
      total: summary.totalMilestones,
      milestoneTitle: milestone?.title ?? null,
      milestonePosition: milestone?.position ?? null,
      completed: summary.completed,
    },
  };
}

function activity(catalog: LearningCatalog): DashboardActivity[] {
  return (catalog.activity ?? []).slice(0, 6).map((item) => ({
    id: item.id,
    label: copy.dashboard.activitySource[item.source],
    conceptName: item.conceptName,
    createdAt: item.createdAt,
  }));
}
