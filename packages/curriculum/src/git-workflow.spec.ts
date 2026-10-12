import { validateCurriculum } from "@platform/validation";
import { describe, expect, it } from "vitest";
import { evaluateExercise, exerciseMasteryUpdate } from "./exercise-validator";
import { frontendCurriculum } from "./frontend-seed";
import { gitExercises, gitLessons } from "./git-workflow";
import { isLessonUnlocked, type PathLesson } from "./graph";
import {
  presentLearningCatalog,
  type CatalogContext,
  type CatalogModuleSource,
} from "./learning-catalog";
import { getNextAction } from "./next-action";

const now = new Date("2026-10-08T12:00:00.000Z");

function exercise(slug: string) {
  const found = gitExercises.find((item) => item.slug === slug);
  if (found === undefined) {
    throw new Error(slug);
  }
  return found;
}

function evaluate(slug: string, submission: string) {
  const item = exercise(slug);
  return evaluateExercise({ type: item.type, rules: item.rules, submission });
}

describe("git workflow curriculum", () => {
  it("publishes a valid optional module without executing git", () => {
    const document = validateCurriculum(frontendCurriculum);
    const git = document.paths
      .find((path) => path.slug === "frontend")
      ?.modules.find((module) => module.slug === "git");
    expect(git?.lessons.map((lesson) => lesson.slug)).toEqual(
      gitLessons.map((lesson) => lesson.slug),
    );
    expect(gitExercises.every((item) => item.published && item.execution == null)).toBe(true);
    expect(gitExercises.map((item) => item.slug)).toEqual([
      "git-repository-identify",
      "git-working-tree-identify",
      "git-diff-line",
      "git-stage-task-form",
      "git-commit-message",
      "git-history-order",
      "git-feature-branch",
      "git-merge-feature",
      "git-conflict-title",
      "git-remote-pull",
      "git-pr-summary",
      "git-review-response",
    ]);
  });

  it("scores the authored answers and rejects a shell string", () => {
    expect(evaluate("git-repository-identify", "history").passed).toBe(true);
    expect(evaluate("git-repository-identify", "password").passed).toBe(false);
    expect(evaluate("git-working-tree-identify", "files").passed).toBe(true);
    expect(evaluate("git-working-tree-identify", "token").passed).toBe(false);
    expect(
      evaluate("git-diff-line", "const visible = tasks.filter((task) => task.status === status);")
        .passed,
    ).toBe(true);
    expect(evaluate("git-stage-task-form", "src/components/TaskForm.tsx").passed).toBe(true);
    expect(
      evaluate("git-stage-task-form", "src/components/TaskForm.tsx\nsrc/components/TaskList.tsx")
        .passed,
    ).toBe(false);
    expect(evaluate("git-commit-message", "update").passed).toBe(false);
    expect(evaluate("git-commit-message", "Add task filtering").passed).toBe(true);
    expect(
      evaluate("git-history-order", "Create task list, Add task form, Add task filtering").passed,
    ).toBe(true);
    expect(evaluate("git-feature-branch", "feature/task-filter").passed).toBe(true);
    expect(evaluate("git-merge-feature", "merge-feature").passed).toBe(true);
    expect(evaluate("git-conflict-title", 'const title = "TaskFlow";').passed).toBe(true);
    expect(
      evaluate(
        "git-conflict-title",
        '<<<<<<< HEAD\nconst title = "TaskFlow";\n=======\nconst title = "Task Manager";\n>>>>>>> feature/rename',
      ).passed,
    ).toBe(false);
    expect(evaluate("git-remote-pull", "pull-integrates").passed).toBe(true);
    expect(evaluate("git-remote-pull", "store-token").passed).toBe(false);
    expect(evaluate("git-pr-summary", "Add task filtering\nFilter tasks by status.").passed).toBe(
      true,
    );
    expect(evaluate("git-review-response", "State parent component-də qalacaq.").passed).toBe(true);
    const shell = evaluate("git-stage-task-form", "git add .; rm -rf /");
    expect(shell.passed).toBe(false);
    expect(evaluate("git-stage-task-form", "git add .; rm -rf /")).toEqual(shell);
    expect(exerciseMasteryUpdate(shell.score)).toBeNull();
    expect(
      exerciseMasteryUpdate(evaluate("git-commit-message", "Add task filtering").score),
    ).toEqual({ evidence: 100, weight: 1 });
  });

  it("keeps git off the next action until earlier lessons are credited", () => {
    const lessons = publishedLessons();
    const action = getNextAction({
      now,
      timeZone: "Asia/Baku",
      homework: [],
      sessions: [],
      lessons: lessons.map((lesson) => ({ ...lesson, progress: "not_started" })),
      prerequisites: frontendCurriculum.prerequisites,
      masteryByConcept: new Map(),
    });
    expect(action).toMatchObject({ kind: "start_lesson", lessonId: "how-the-web-delivers-a-page" });

    const repository = lessons.find((lesson) => lesson.slug === "git-repository");
    const changes = lessons.find((lesson) => lesson.slug === "git-changes");
    expect(repository).toBeDefined();
    expect(changes).toBeDefined();
    const mastery = new Map<string, { score: number }>();
    expect(
      isLessonUnlocked({
        lesson: repository!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: mastery,
      }),
    ).toBe(true);
    expect(
      isLessonUnlocked({
        lesson: changes!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: mastery,
      }),
    ).toBe(false);
  });

  it("marks the first git lesson as practice and does not invent mastery", () => {
    const catalog = presentLearningCatalog({
      now,
      path: { slug: "frontend", title: "Frontend", description: "Yol", status: "published" },
      modules: practiceModules(),
      concepts: [
        { slug: "web.http", name: "HTTP" },
        { slug: "git.repository", name: "Repository" },
        { slug: "git.diff", name: "Diff" },
      ],
      context: practiceContext(),
    });
    expect(catalog.nextAction).toMatchObject({ kind: "start_lesson", lessonId: "web-lesson" });
    expect(catalog.modules.map((module) => module.slug)).toEqual(["web", "git"]);
    expect(catalog.modules[1]?.lessons.map((lesson) => [lesson.slug, lesson.availability])).toEqual(
      [
        ["git-repository", "practice"],
        ["git-changes", "locked"],
      ],
    );
    expect(
      catalog.concepts.find((concept) => concept.slug === "git.repository")?.mastery,
    ).toBeNull();
    expect(catalog.concepts.find((concept) => concept.slug === "git.diff")?.mastery).toBeNull();
  });
});

function publishedLessons(): PathLesson[] {
  const lessons: PathLesson[] = [];
  for (const path of frontendCurriculum.paths) {
    if (path.slug !== "frontend") {
      continue;
    }
    for (const module of path.modules) {
      for (const lesson of module.lessons) {
        if (lesson.status !== "published") {
          continue;
        }
        lessons.push({
          id: lesson.slug,
          slug: lesson.slug,
          title: lesson.title,
          modulePosition: module.position,
          lessonPosition: lesson.position,
          status: lesson.status,
          primaryConceptSlugs: lesson.concepts
            .filter((link) => link.role === "primary")
            .map((link) => link.conceptSlug),
          supportingConceptSlugs: [],
        });
      }
    }
  }
  return lessons;
}

function practiceContext(): CatalogContext {
  return {
    timeZone: "Asia/Baku",
    homework: [],
    sessions: [],
    lessons: [
      {
        id: "web-lesson",
        slug: "how-the-web-delivers-a-page",
        title: "Brauzer",
        modulePosition: 1,
        lessonPosition: 1,
        status: "published",
        primaryConceptSlugs: ["web.http"],
        supportingConceptSlugs: [],
        progress: null,
      },
      {
        id: "git-1",
        slug: "git-repository",
        title: "Repository və iş ağacı",
        modulePosition: 8,
        lessonPosition: 1,
        status: "published",
        primaryConceptSlugs: ["git.repository"],
        supportingConceptSlugs: [],
        progress: null,
      },
      {
        id: "git-2",
        slug: "git-changes",
        title: "Fərq və seçim",
        modulePosition: 8,
        lessonPosition: 2,
        status: "published",
        primaryConceptSlugs: ["git.diff"],
        supportingConceptSlugs: [],
        progress: null,
      },
    ],
    prerequisites: [{ conceptSlug: "git.diff", prerequisiteSlug: "git.repository" }],
    mastery: [],
  };
}

function practiceModules(): CatalogModuleSource[] {
  return [
    {
      slug: "web",
      title: "Web Fundamentals",
      description: "Səhifə",
      position: 1,
      lessons: [
        {
          id: "web-lesson",
          slug: "how-the-web-delivers-a-page",
          title: "Brauzer",
          objective: "HTTP sorğusunu izah etmək üçün kifayət qədər uzun məqsəd.",
          estimatedMinutes: 15,
          position: 1,
          status: "published",
          primaryConceptSlugs: ["web.http"],
          supportingConceptSlugs: [],
        },
      ],
    },
    {
      slug: "git",
      title: "Git & GitHub",
      description: "İş axını",
      position: 8,
      lessons: [
        {
          id: "git-1",
          slug: "git-repository",
          title: "Repository və iş ağacı",
          objective: "Tarixçəni cari fayllardan ayırd etmək.",
          estimatedMinutes: 15,
          position: 1,
          status: "published",
          primaryConceptSlugs: ["git.repository"],
          supportingConceptSlugs: [],
        },
        {
          id: "git-2",
          slug: "git-changes",
          title: "Fərq və seçim",
          objective: "Dəyişikliyi görmək və yalnız hazır hissəni seçmək.",
          estimatedMinutes: 15,
          position: 2,
          status: "published",
          primaryConceptSlugs: ["git.diff"],
          supportingConceptSlugs: [],
        },
      ],
    },
  ];
}
