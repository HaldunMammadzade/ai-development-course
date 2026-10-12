import { validateCurriculum } from "@platform/validation";
import { describe, expect, it } from "vitest";
import { evaluateExercise, exerciseMasteryUpdate } from "./exercise-validator";
import { frontendCurriculum } from "./frontend-seed";
import { isLessonUnlocked, type PathLesson } from "./graph";
import {
  presentLearningCatalog,
  type CatalogContext,
  type CatalogModuleSource,
} from "./learning-catalog";
import { getNextAction } from "./next-action";
import { testingExercises, testingLessons } from "./testing-fundamentals";

const now = new Date("2026-10-09T12:00:00.000Z");

function exercise(slug: string) {
  const found = testingExercises.find((item) => item.slug === slug);
  if (found === undefined) {
    throw new Error(slug);
  }
  return found;
}

function evaluate(slug: string, submission: string) {
  const item = exercise(slug);
  return evaluateExercise({ type: item.type, rules: item.rules, submission });
}

describe("testing fundamentals curriculum", () => {
  it("publishes a valid module and never executes student tests", () => {
    const document = validateCurriculum(frontendCurriculum);
    const testing = document.paths
      .find((path) => path.slug === "frontend")
      ?.modules.find((module) => module.slug === "testing");
    expect(testing?.lessons.map((lesson) => lesson.slug)).toEqual(
      testingLessons.map((lesson) => lesson.slug),
    );
    expect(testingLessons.every((lesson) => lesson.objective.length > 20)).toBe(true);
    expect(
      testingLessons.every((lesson) =>
        lesson.blocks.some(
          (block) => block.type === "reading" && block.markdown.trim().length > 80,
        ),
      ),
    ).toBe(true);
    expect(testingExercises.every((item) => item.published && item.execution == null)).toBe(true);
    expect(testingExercises.map((item) => item.slug)).toEqual([
      "testing-why-purpose",
      "testing-expected-number",
      "testing-assertion-line",
      "testing-unit-scope",
      "testing-edge-empty",
      "testing-component-output",
      "testing-interaction-complete",
      "testing-integration-parts",
      "testing-e2e-scope",
      "testing-mock-target",
      "testing-brittle-check",
      "testing-failure-fix",
      "testing-regression-spot",
      "testing-coverage-limit",
      "testing-workflow-order",
      "testing-missing-empty",
    ]);
  });

  it("scores authored answers and rejects a command string", () => {
    expect(evaluate("testing-why-purpose", "check-behavior").passed).toBe(true);
    expect(evaluate("testing-why-purpose", "prove-zero").passed).toBe(false);
    expect(evaluate("testing-expected-number", "5").passed).toBe(true);
    expect(evaluate("testing-expected-number", "6").passed).toBe(false);
    expect(evaluate("testing-assertion-line", "expect(add(2, 3)).toBe(5);").passed).toBe(true);
    expect(evaluate("testing-assertion-line", "npm test; rm -rf /").passed).toBe(false);
    expect(evaluate("testing-unit-scope", "one-function").passed).toBe(true);
    expect(evaluate("testing-edge-empty", "[]").passed).toBe(true);
    expect(evaluate("testing-edge-empty", "[task]").passed).toBe(false);
    expect(evaluate("testing-component-output", "rendered").passed).toBe(true);
    expect(evaluate("testing-interaction-complete", "task-done").passed).toBe(true);
    expect(evaluate("testing-integration-parts", "form-and-list").passed).toBe(true);
    expect(evaluate("testing-integration-parts", "pure-add").passed).toBe(false);
    expect(evaluate("testing-e2e-scope", "full-workflow").passed).toBe(true);
    expect(evaluate("testing-e2e-scope", "every-browser").passed).toBe(false);
    expect(evaluate("testing-mock-target", "api-error").passed).toBe(true);
    expect(evaluate("testing-mock-target", "filter-itself").passed).toBe(false);
    expect(evaluate("testing-brittle-check", "css-class").passed).toBe(true);
    expect(evaluate("testing-failure-fix", "expect(visible).toHaveLength(3);").passed).toBe(true);
    expect(evaluate("testing-failure-fix", "expect(visible).toHaveLength(2);").passed).toBe(false);
    expect(evaluate("testing-regression-spot", "regression").passed).toBe(true);
    expect(evaluate("testing-coverage-limit", "not-proof").passed).toBe(true);
    expect(evaluate("testing-coverage-limit", "no-bugs").passed).toBe(false);
    expect(
      evaluate("testing-workflow-order", "Test yaz, Testi işlət, Düzəlt, Yenidən işlət, Commit")
        .passed,
    ).toBe(true);
    expect(evaluate("testing-workflow-order", "Commit, Test yaz").passed).toBe(false);
    expect(evaluate("testing-missing-empty", "boş siyahı").passed).toBe(true);
    expect(evaluate("testing-missing-empty", "").score).toBe(0);
    expect(exerciseMasteryUpdate(evaluate("testing-assertion-line", "npm test").score)).toBeNull();
    expect(exerciseMasteryUpdate(evaluate("testing-expected-number", "5").score)).toEqual({
      evidence: 100,
      weight: 1,
    });
  });

  it("keeps testing practice off the current path until earlier lessons are credited", () => {
    const lessons = publishedLessons();
    const action = getNextAction({
      now,
      timeZone: "Asia/Baku",
      homework: [],
      sessions: [],
      lessons: lessons.map((lesson) => ({ ...lesson, progress: "not_started" as const })),
      prerequisites: frontendCurriculum.prerequisites,
      masteryByConcept: new Map(),
    });
    expect(action).toMatchObject({ kind: "start_lesson", lessonId: "how-the-web-delivers-a-page" });
    const first = lessons.find((lesson) => lesson.slug === "testing-why");
    const second = lessons.find((lesson) => lesson.slug === "testing-assertions");
    expect(
      isLessonUnlocked({
        lesson: first!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: new Map(),
      }),
    ).toBe(true);
    expect(
      isLessonUnlocked({
        lesson: second!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: new Map(),
      }),
    ).toBe(false);
  });

  it("does not create mastery by opening the practice catalog", () => {
    const catalog = presentLearningCatalog({
      now,
      path: { slug: "frontend", title: "Frontend", description: "Yol", status: "published" },
      modules: practiceModules(),
      concepts: [
        { slug: "web.http", name: "HTTP" },
        { slug: "testing.purpose", name: "Testin məqsədi" },
        { slug: "testing.assertion", name: "Assertion" },
      ],
      context: practiceContext(),
    });
    expect(catalog.nextAction).toMatchObject({ kind: "start_lesson", lessonId: "web-lesson" });
    expect(catalog.modules[1]?.lessons.map((lesson) => [lesson.slug, lesson.availability])).toEqual(
      [
        ["testing-why", "practice"],
        ["testing-assertions", "locked"],
      ],
    );
    expect(
      catalog.concepts.find((concept) => concept.slug === "testing.purpose")?.mastery,
    ).toBeNull();
    expect(
      catalog.concepts.find((concept) => concept.slug === "testing.assertion")?.mastery,
    ).toBeNull();
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
        id: "testing-1",
        slug: "testing-why",
        title: "Niyə test yazırıq",
        modulePosition: 9,
        lessonPosition: 1,
        status: "published",
        primaryConceptSlugs: ["testing.purpose", "testing.expected-actual"],
        supportingConceptSlugs: [],
        progress: null,
      },
      {
        id: "testing-2",
        slug: "testing-assertions",
        title: "Gözlənti və assertion",
        modulePosition: 9,
        lessonPosition: 2,
        status: "published",
        primaryConceptSlugs: ["testing.assertion"],
        supportingConceptSlugs: [],
        progress: null,
      },
    ],
    prerequisites: [
      { conceptSlug: "testing.assertion", prerequisiteSlug: "testing.expected-actual" },
    ],
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
      slug: "testing",
      title: "Testing Fundamentals",
      description: "Test",
      position: 9,
      lessons: [
        {
          id: "testing-1",
          slug: "testing-why",
          title: "Niyə test yazırıq",
          objective: "Testin vəd edilən davranışı yoxladığını izah etmək.",
          estimatedMinutes: 15,
          position: 1,
          status: "published",
          primaryConceptSlugs: ["testing.purpose", "testing.expected-actual"],
          supportingConceptSlugs: [],
        },
        {
          id: "testing-2",
          slug: "testing-assertions",
          title: "Gözlənti və assertion",
          objective: "Assertion-un gözlənilən nəticəni yoxladığını izah etmək.",
          estimatedMinutes: 15,
          position: 2,
          status: "published",
          primaryConceptSlugs: ["testing.assertion"],
          supportingConceptSlugs: [],
        },
      ],
    },
  ];
}
