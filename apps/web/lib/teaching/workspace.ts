import type { AdaptiveDecision } from "@platform/curriculum";
import type {
  LearningCatalog,
  LearningCatalogLesson,
  MasteryBand,
  NextAction,
  PublicLessonBlock,
  TeachingSessionView,
  TeachingState,
  Understanding,
} from "@platform/types";
import { copy } from "@/lib/copy";
import { conceptName, findCurrentLesson, lessonHref } from "@/lib/learning/catalog-view";
import { advanceLabel, composerMode, type ComposerMode } from "@/lib/teaching/presentation";

export type LessonPhase = "loading" | "ready" | "closed" | "path_complete" | "error";

export type TeacherVisual =
  | "idle"
  | "thinking"
  | "ready"
  | "explaining"
  | "question"
  | "hint"
  | "feedback"
  | "error";

export interface LessonNavItem {
  title: string;
  availability: LearningCatalogLesson["availability"];
  href: string | null;
  lockedReason: string | null;
  status: string;
}

export interface LessonConceptItem {
  name: string;
  status: string;
  weak: boolean;
}

export interface ReadingParagraph {
  text: string;
  code: boolean;
}

export type LessonBlockView =
  | { kind: "reading"; label: string; paragraphs: ReadingParagraph[] }
  | { kind: "question"; label: string; prompt: string }
  | { kind: "recap"; label: string; points: string[]; practice: string };

export interface LessonWorkspaceModel {
  pathTitle: string | null;
  moduleTitle: string | null;
  title: string;
  position: string | null;
  minutes: number | null;
  objective: string | null;
  stateLabel: string | null;
  block: LessonBlockView | null;
  concepts: LessonConceptItem[];
  previous: LessonNavItem | null;
  current: LessonNavItem | null;
  next: LessonNavItem | null;
  adaptive: string | null;
  mode: ComposerMode | null;
  advance: string | null;
  questionSpeech: string | null;
  answers: string[];
  teacherMessages: string[];
  teacherVisual: TeacherVisual;
  teacherLabel: string;
  homeworkPrompt: string | null;
  notice: Array<{ name: string; status: string }>;
  completion: {
    title: string;
    learned: string | null;
    concepts: string[];
    body: string | null;
    href: string | null;
    label: string | null;
    pathDone: boolean;
  } | null;
}

export function readingParagraphs(markdown: string): ReadingParagraph[] {
  return markdown
    .split(/\n\n+/)
    .map((text) => text.trim())
    .filter((text) => text.length > 0)
    .map((text) => ({ text, code: isCodeParagraph(text) }));
}

export function teacherVisual(input: {
  phase: LessonPhase;
  pending: boolean;
  state: TeachingState | null;
  adaptive: AdaptiveDecision | null;
  hasError: boolean;
}): TeacherVisual {
  if (input.phase === "loading" || input.pending) {
    return "thinking";
  }
  if (input.phase === "error" || input.hasError) {
    return "error";
  }
  if (input.phase === "path_complete" || input.phase === "closed" || input.state === null) {
    return "idle";
  }
  if (input.adaptive === "HINT" || input.state === "hint") {
    return "hint";
  }
  if (input.adaptive === "RETRY" || input.adaptive === "REVIEW") {
    return "feedback";
  }
  if (
    input.state === "prior_check" ||
    input.state === "comprehension_check" ||
    input.state === "evaluate"
  ) {
    return "question";
  }
  if (
    input.state === "completed" ||
    input.state === "summarize" ||
    input.state === "homework" ||
    input.adaptive === "CHALLENGE"
  ) {
    return "feedback";
  }
  if (
    input.state === "explain" ||
    input.state === "adapt" ||
    input.state === "objective" ||
    input.state === "created" ||
    input.state === "exercise" ||
    input.state === "raise_difficulty" ||
    input.adaptive === "REEXPLAIN" ||
    input.adaptive === "REMEDIATE_PREREQUISITE"
  ) {
    return "explaining";
  }
  return "ready";
}

export function adaptiveCue(
  decision: AdaptiveDecision | null,
  focus: LearningCatalog["focus"],
): string | null {
  const chosen =
    decision ?? (focus !== null && focus.reason !== "baseline" ? focus.decision : null);
  if (chosen === null || chosen === "CONTINUE") {
    return null;
  }
  return copy.teacher.adaptiveCue[chosen];
}

export function conceptStatus(input: {
  band: MasteryBand | null;
  recorded: boolean;
}): { status: string; weak: boolean } {
  if (input.band === "weak") {
    return { status: copy.dashboard.weakStatus, weak: true };
  }
  if (input.band === "fragile" || input.band === "working" || input.band === "strong") {
    return { status: copy.teacher.band[input.band], weak: false };
  }
  if (input.recorded) {
    return { status: copy.teacher.noted, weak: false };
  }
  return { status: copy.teacher.notStarted, weak: false };
}

export function buildLessonWorkspace(input: {
  slug: string;
  catalog: LearningCatalog;
  session: TeachingSessionView | null;
  phase: LessonPhase;
  pending: boolean;
  hasError: boolean;
  adaptive: AdaptiveDecision | null;
  notice: Array<{ name: string; understanding: Understanding }>;
}): LessonWorkspaceModel {
  const placed = locate(input.catalog, input.slug);
  const lesson = placed?.lesson ?? null;
  const title = input.session?.lessonTitle ?? lesson?.title ?? input.slug;
  const mode = input.session === null ? null : composerMode(input.session.state);
  const visual = teacherVisual({
    phase: input.phase,
    pending: input.pending,
    state: input.session?.state ?? null,
    adaptive: input.adaptive,
    hasError: input.hasError,
  });
  const block = input.session === null ? null : presentBlock(input.session.block);
  const teacherMessages = (input.session?.messages ?? [])
    .filter((message) => message.role === "teacher")
    .map((message) => message.speech);
  const answers = (input.session?.messages ?? [])
    .filter((message) => message.role === "student")
    .map((message) => message.speech);
  const next = input.session?.nextAction ?? input.catalog.nextAction;
  const concepts = lessonConcepts(input.catalog, input.slug, input.session);
  const showCompletion = mode === "done" || input.phase === "path_complete";

  return {
    pathTitle: input.catalog.path?.title ?? null,
    moduleTitle: placed?.moduleTitle ?? null,
    title,
    position:
      placed === null ? null : `${copy.teacher.lessonPosition} ${placed.index} / ${placed.total}`,
    minutes: lesson?.estimatedMinutes ?? null,
    objective: lesson?.objective.trim() ? lesson.objective : null,
    stateLabel: input.session === null ? null : copy.teacher.phase[input.session.state],
    block,
    concepts,
    previous: placed?.previous ?? null,
    current: placed?.current ?? null,
    next: placed?.next ?? null,
    adaptive: adaptiveCue(input.adaptive, input.catalog.focus),
    mode,
    advance:
      input.session !== null && (mode === "advance" || mode === "homework")
        ? advanceLabel(input.session.state)
        : null,
    questionSpeech: mode === "answer" ? (teacherMessages.at(-1) ?? null) : null,
    answers: mode === "answer" ? answers : [],
    teacherMessages,
    teacherVisual: visual,
    teacherLabel: visualLabel(visual),
    homeworkPrompt:
      mode === "homework" && input.session?.homework ? input.session.homework.prompt : null,
    notice: input.notice
      .map((item) => ({
        name: item.name,
        status: understandingLabel(item.understanding),
      }))
      .filter((item) => item.status.length > 0),
    completion: showCompletion
      ? input.session?.state === "review_completed"
        ? reviewFinished(input.session.reviewConceptName)
        : completion(
            input.catalog,
            next,
            lesson?.objective ?? null,
            concepts.map((item) => item.name),
          )
      : null,
  };
}

function visualLabel(visual: TeacherVisual): string {
  if (visual === "thinking") {
    return copy.teacher.thinking;
  }
  if (visual === "ready") {
    return copy.teacher.ready;
  }
  if (visual === "idle") {
    return copy.teacher.visual.idle;
  }
  return copy.teacher.visual[visual];
}

function understandingLabel(understanding: Understanding): string {
  if (understanding === "unknown") {
    return "";
  }
  return copy.teacher.understanding[understanding];
}

function presentBlock(block: PublicLessonBlock): LessonBlockView {
  if (block.type === "reading") {
    return {
      kind: "reading",
      label: copy.teacher.reading,
      paragraphs: readingParagraphs(block.markdown),
    };
  }
  if (block.type === "check_question") {
    return { kind: "question", label: copy.teacher.question, prompt: block.prompt };
  }
  return {
    kind: "recap",
    label: copy.teacher.recap,
    points: block.points,
    practice: block.practicePrompt,
  };
}

function lessonConcepts(
  catalog: LearningCatalog,
  slug: string,
  session: TeachingSessionView | null,
): LessonConceptItem[] {
  const progress = session?.progress ?? [];
  if (progress.length === 0) {
    return catalog.concepts
      .filter((concept) => concept.lessonSlug === slug)
      .map((concept) => ({
        name: concept.name,
        ...conceptStatus({ band: concept.band, recorded: concept.mastery !== null }),
      }));
  }
  return progress.map((item) => {
    const concept = catalog.concepts.find((entry) => entry.slug === item.slug);
    return {
      name: concept?.name ?? conceptName(catalog, item.slug),
      ...conceptStatus({
        band: concept?.band ?? null,
        recorded: item.mastery !== null,
      }),
    };
  });
}

function reviewFinished(name: string | null): LessonWorkspaceModel["completion"] {
  const title =
    name === null || name.trim().length === 0 ? copy.teacher.reviewDoneTitle : `${name} təkrarı bitdi`;
  return {
    title,
    learned: null,
    concepts: [],
    body: copy.teacher.reviewDoneBody,
    href: "/app/dashboard",
    label: copy.teacher.reviewDoneAction,
    pathDone: false,
  };
}

function completion(
  catalog: LearningCatalog,
  next: NextAction,
  objective: string | null,
  concepts: string[],
): LessonWorkspaceModel["completion"] {
  const learned = objective?.trim() ? objective : null;
  if (next.kind === "path_complete") {
    return {
      title: copy.teacher.completedTitle,
      learned,
      concepts,
      body: copy.teacher.pathDone,
      href: null,
      label: null,
      pathDone: true,
    };
  }
  if (next.kind === "do_homework") {
    return {
      title: copy.teacher.completedTitle,
      learned,
      concepts,
      body: copy.teacher.completedBody,
      href: "/app/homework",
      label: copy.teacher.goHomework,
      pathDone: false,
    };
  }
  const current = findCurrentLesson(catalog);
  return {
    title: copy.teacher.completedTitle,
    learned,
    concepts,
    body: null,
    href: current === null ? null : lessonHref(current.lesson.slug),
    label: copy.teacher.nextLesson,
    pathDone: false,
  };
}

function locate(
  catalog: LearningCatalog,
  slug: string,
): {
  moduleTitle: string;
  lesson: LearningCatalogLesson;
  index: number;
  total: number;
  previous: LessonNavItem | null;
  current: LessonNavItem;
  next: LessonNavItem | null;
} | null {
  const sequence = catalog.modules.flatMap((pathModule) =>
    pathModule.lessons.map((lesson) => ({ moduleTitle: pathModule.title, lesson })),
  );
  const index = sequence.findIndex((entry) => entry.lesson.slug === slug);
  const entry = sequence[index];
  if (entry === undefined) {
    return null;
  }
  const moduleLessons = catalog.modules.find((pathModule) =>
    pathModule.lessons.some((lesson) => lesson.slug === slug),
  );
  const moduleIndex = moduleLessons?.lessons.findIndex((lesson) => lesson.slug === slug) ?? index;
  const currentItem = navItem(entry.lesson);
  if (currentItem === null) {
    return null;
  }
  return {
    moduleTitle: entry.moduleTitle,
    lesson: entry.lesson,
    index: moduleIndex + 1,
    total: moduleLessons?.lessons.length ?? sequence.length,
    previous: index > 0 ? navItem(sequence[index - 1]?.lesson) : null,
    current: { ...currentItem, href: null },
    next: navItem(sequence[index + 1]?.lesson),
  };
}

function navItem(lesson: LearningCatalogLesson | undefined): LessonNavItem | null {
  if (lesson === undefined) {
    return null;
  }
  const locked = lesson.availability === "locked";
  return {
    title: lesson.title,
    availability: lesson.availability,
    href: lesson.availability === "current" ? lessonHref(lesson.slug) : null,
    lockedReason: locked ? copy.teacher.lockedWhy : null,
    status: availabilityStatus(lesson.availability),
  };
}

function availabilityStatus(availability: LearningCatalogLesson["availability"]): string {
  if (availability === "completed") {
    return copy.learn.completed;
  }
  if (availability === "current") {
    return copy.learn.current;
  }
  return copy.learn.locked;
}

function isCodeParagraph(text: string): boolean {
  const lines = text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  return lines.length > 0 && lines.every((line) => line.startsWith("<") || line.startsWith("`"));
}
