import { validateCurriculum } from "@platform/validation";
import { describe, expect, it } from "vitest";
import { decideAdaptive } from "./adaptive";
import { evaluateExercise } from "./exercise-validator";
import { frontendCurriculum } from "./frontend-seed";
import { isLessonUnlocked, type PathLesson } from "./graph";
import { getNextAction } from "./next-action";

const now = new Date("2026-10-07T12:00:00.000Z");

function publishedLessons(): PathLesson[] {
  const lessons: PathLesson[] = [];
  for (const path of frontendCurriculum.paths) {
    if (path.slug !== "frontend" || path.status !== "published") {
      continue;
    }
    for (const module of path.modules) {
      for (const lesson of module.lessons) {
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
          supportingConceptSlugs: lesson.concepts
            .filter((link) => link.role === "supporting")
            .map((link) => link.conceptSlug),
        });
      }
    }
  }
  return lessons;
}

describe("frontend curriculum integrity", () => {
  it("keeps a valid published graph and hides unfinished lessons", () => {
    const document = validateCurriculum(frontendCurriculum);
    const slugs = new Set(document.concepts.map((concept) => concept.slug));
    expect(slugs.size).toBe(document.concepts.length);
    const lessonSlugs = document.paths.flatMap((path) =>
      path.modules.flatMap((module) => module.lessons.map((lesson) => lesson.slug)),
    );
    expect(new Set(lessonSlugs).size).toBe(lessonSlugs.length);

    for (const edge of document.prerequisites) {
      expect(slugs.has(edge.conceptSlug)).toBe(true);
      expect(slugs.has(edge.prerequisiteSlug)).toBe(true);
      expect(edge.conceptSlug).not.toBe(edge.prerequisiteSlug);
    }

    const published = document.paths
      .filter((path) => path.status === "published")
      .flatMap((path) => path.modules.flatMap((module) => module.lessons))
      .filter((lesson) => lesson.status === "published");
    for (const lesson of published) {
      expect(lesson.objective.length).toBeGreaterThan(20);
      expect(
        lesson.blocks.some((block) => block.type === "reading" && block.markdown.length > 80),
      ).toBe(true);
      expect(lesson.concepts.some((link) => link.role === "primary")).toBe(true);
      expect(lesson.objective).not.toMatch(/Learn JavaScript|Understand CSS|Practice this topic/);
    }

    const draftSlugs = new Set(
      document.paths
        .flatMap((path) => path.modules.flatMap((module) => module.lessons))
        .filter((lesson) => lesson.status !== "published")
        .map((lesson) => lesson.slug),
    );
    expect(draftSlugs.has("css-grid")).toBe(true);
    expect(draftSlugs.has("js-dom")).toBe(true);
    expect(draftSlugs.has("js-fetch")).toBe(true);

    for (const exercise of document.exercises.filter((item) => item.published)) {
      expect(exercise.rules.length).toBeGreaterThan(0);
      const lesson = document.paths
        .flatMap((path) => path.modules.flatMap((module) => module.lessons))
        .find((item) => item.slug === exercise.lessonSlug);
      expect(lesson?.status).toBe("published");
      const concepts = new Set(lesson?.concepts.map((link) => link.conceptSlug) ?? []);
      expect(concepts.has(exercise.conceptSlug)).toBe(true);
    }
  });

  it("places the function drills on the functions lesson", () => {
    const document = validateCurriculum(frontendCurriculum);
    const published = document.exercises.filter((exercise) => exercise.published);
    const positions = new Map<string, Set<number>>();
    for (const exercise of document.exercises) {
      const used = positions.get(exercise.lessonSlug) ?? new Set<number>();
      expect(used.has(exercise.position)).toBe(false);
      used.add(exercise.position);
      positions.set(exercise.lessonSlug, used);
    }

    const bySlug = new Map(document.exercises.map((exercise) => [exercise.slug, exercise]));
    const drillPositions = new Set<number>();
    for (const slug of ["js-add", "js-is-even", "js-reverse-string"]) {
      const exercise = bySlug.get(slug);
      expect(exercise).toMatchObject({
        lessonSlug: "js-functions",
        conceptSlug: "js.function",
        published: true,
      });
      drillPositions.add(exercise?.position ?? -1);
    }
    expect(drillPositions.size).toBe(3);

    const firstLesson = published
      .filter((exercise) => exercise.lessonSlug === "how-the-web-delivers-a-page")
      .map((exercise) => exercise.slug);
    expect(firstLesson).not.toContain("js-add");
    expect(firstLesson).not.toContain("js-is-even");
    expect(firstLesson).not.toContain("js-reverse-string");

    expect(bySlug.get("js-function-return")).toMatchObject({
      lessonSlug: "js-functions",
      conceptSlug: "js.function",
      position: 1,
      published: true,
    });
    expect(bySlug.get("js-double")).toMatchObject({
      lessonSlug: "js-functions",
      conceptSlug: "js.function",
      position: 2,
      published: true,
    });
  });

  it("does not let JavaScript start before unfinished HTML and CSS", () => {
    const lessons = publishedLessons();
    const mastery = new Map<string, { score: number; evidenceCount: number }>();
    const action = getNextAction({
      now,
      timeZone: "Asia/Baku",
      homework: [],
      sessions: [],
      lessons: lessons.map((lesson) => ({ ...lesson, progress: "not_started" })),
      prerequisites: frontendCurriculum.prerequisites,
      masteryByConcept: mastery,
    });
    expect(action).toMatchObject({ kind: "start_lesson", lessonId: "how-the-web-delivers-a-page" });

    const flex = lessons.find((lesson) => lesson.slug === "css-flexbox");
    expect(flex).toBeDefined();
    mastery.set("css.display", { score: 30, evidenceCount: 4 });
    expect(
      isLessonUnlocked({
        lesson: flex!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: mastery,
      }),
    ).toBe(false);

    const javascript = lessons.find((lesson) => lesson.slug === "js-variables");
    expect(
      isLessonUnlocked({
        lesson: javascript!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: mastery,
      }),
    ).toBe(false);
  });

  it("remediates a weak display prerequisite while learning flexbox", () => {
    const weak = decideAdaptive({
      now,
      timeZone: "Asia/Baku",
      concept: { score: 70, evidenceCount: 3, lastEvidenceAt: now },
      prerequisiteWeak: true,
      misconceptionOccurrences: 0,
      recent: [],
    });
    expect(weak).toMatchObject({
      decision: "REMEDIATE_PREREQUISITE",
      strategy: "TARGETED_REVIEW",
      reason: "weak_prerequisite",
    });

    const reexplain = decideAdaptive({
      now,
      timeZone: "Asia/Baku",
      concept: { score: 30, evidenceCount: 4, lastEvidenceAt: now },
      prerequisiteWeak: false,
      misconceptionOccurrences: 0,
      recent: [
        { source: "exercise", outcome: "failure", occurredAt: now },
        { source: "exercise", outcome: "failure", occurredAt: now },
      ],
    });
    expect(reexplain.decision).toBe("REEXPLAIN");

    const challenge = decideAdaptive({
      now,
      timeZone: "Asia/Baku",
      concept: { score: 90, evidenceCount: 8, lastEvidenceAt: now },
      prerequisiteWeak: false,
      misconceptionOccurrences: 0,
      recent: [{ source: "exercise", outcome: "success", occurredAt: now }],
    });
    expect(challenge.decision).toBe("CHALLENGE");
  });

  it("keeps TypeScript behind JavaScript and rejects a broken graph", () => {
    const document = validateCurriculum(frontendCurriculum);
    const published = document.paths
      .filter((path) => path.status === "published")
      .flatMap((path) => path.modules.flatMap((module) => module.lessons))
      .filter((lesson) => lesson.status === "published");
    const typescript = published.filter((lesson) =>
      lesson.concepts.some((link) => link.role === "primary" && link.conceptSlug.startsWith("ts.")),
    );
    expect(typescript.map((lesson) => lesson.slug)).toEqual([
      "what-typescript-is",
      "type-annotations",
      "primitive-types",
      "arrays-and-tuples",
      "objects-and-type-aliases",
      "unions-and-literals",
      "typescript-interfaces",
      "function-types",
      "optional-and-readonly",
      "type-narrowing",
      "generics-basics",
    ]);
    const linked = new Set(
      document.paths.flatMap((path) =>
        path.modules.flatMap((module) =>
          module.lessons.flatMap((lesson) => lesson.concepts.map((link) => link.conceptSlug)),
        ),
      ),
    );
    for (const concept of document.concepts) {
      expect(linked.has(concept.slug)).toBe(true);
    }

    const publishedPrimaries = new Set(
      published.flatMap((lesson) =>
        lesson.concepts.filter((link) => link.role === "primary").map((link) => link.conceptSlug),
      ),
    );
    for (const lesson of published) {
      for (const link of lesson.concepts.filter((item) => item.role === "primary")) {
        for (const edge of document.prerequisites.filter(
          (item) => item.conceptSlug === link.conceptSlug,
        )) {
          expect(publishedPrimaries.has(edge.prerequisiteSlug)).toBe(true);
        }
      }
    }

    const parents = new Map<string, string[]>();
    for (const edge of document.prerequisites) {
      const list = parents.get(edge.conceptSlug) ?? [];
      list.push(edge.prerequisiteSlug);
      parents.set(edge.conceptSlug, list);
    }
    const seen = new Set<string>();
    const pending = ["ts.generic"];
    let reachesJavaScript = false;
    while (pending.length > 0) {
      const slug = pending.pop();
      if (slug === undefined || seen.has(slug)) {
        continue;
      }
      seen.add(slug);
      if (slug === "web.javascript") {
        reachesJavaScript = true;
      }
      pending.push(...(parents.get(slug) ?? []));
    }
    expect(reachesJavaScript).toBe(true);

    const lessons = publishedLessons();
    const empty = new Map<string, { score: number; evidenceCount: number }>();
    const first = getNextAction({
      now,
      timeZone: "Asia/Baku",
      homework: [],
      sessions: [],
      lessons: lessons.map((lesson) => ({ ...lesson, progress: "not_started" })),
      prerequisites: frontendCurriculum.prerequisites,
      masteryByConcept: empty,
    });
    expect(first).toMatchObject({ kind: "start_lesson", lessonId: "how-the-web-delivers-a-page" });

    const typescriptLesson = lessons.find((lesson) => lesson.slug === "what-typescript-is");
    const primitives = lessons.find((lesson) => lesson.slug === "primitive-types");
    expect(typescriptLesson).toBeDefined();
    expect(primitives).toBeDefined();
    expect(
      isLessonUnlocked({
        lesson: typescriptLesson!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: empty,
      }),
    ).toBe(false);
    const ready = new Map<string, { score: number; evidenceCount: number }>([
      ["web.javascript", { score: 80, evidenceCount: 4 }],
      ["ts.basics", { score: 80, evidenceCount: 4 }],
      ["ts.annotation", { score: 30, evidenceCount: 4 }],
    ]);
    expect(
      isLessonUnlocked({
        lesson: typescriptLesson!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: ready,
      }),
    ).toBe(true);
    expect(
      isLessonUnlocked({
        lesson: primitives!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: ready,
      }),
    ).toBe(false);

    const typedAdd = document.exercises.find((exercise) => exercise.slug === "ts-typed-add");
    expect(typedAdd?.execution ?? null).toBeNull();
    expect(typedAdd?.type).toBe("code_text");
    const passed = evaluateExercise({
      type: "code_text",
      rules: typedAdd?.rules ?? [],
      submission: "function add(a: number, b: number): number {\n  return a + b;\n}\n",
    });
    expect(passed.passed).toBe(true);
    const plain = evaluateExercise({
      type: "code_text",
      rules: typedAdd?.rules ?? [],
      submission: "function add(a, b) {\n  return a + b;\n}\n",
    });
    expect(plain.passed).toBe(false);

    const weakUnion = decideAdaptive({
      now,
      timeZone: "Asia/Baku",
      concept: { score: 30, evidenceCount: 4, lastEvidenceAt: now },
      prerequisiteWeak: false,
      misconceptionOccurrences: 0,
      recent: [
        { source: "exercise", outcome: "failure", occurredAt: now },
        { source: "exercise", outcome: "failure", occurredAt: now },
      ],
    });
    expect(weakUnion.decision).toBe("REEXPLAIN");
    const strongInterface = decideAdaptive({
      now,
      timeZone: "Asia/Baku",
      concept: { score: 90, evidenceCount: 8, lastEvidenceAt: now },
      prerequisiteWeak: false,
      misconceptionOccurrences: 0,
      recent: [{ source: "exercise", outcome: "success", occurredAt: now }],
    });
    expect(strongInterface.decision).toBe("CHALLENGE");
  });

  it("keeps React behind TypeScript and rejects a Next.js shortcut", () => {
    const document = validateCurriculum(frontendCurriculum);
    const published = document.paths
      .filter((path) => path.status === "published")
      .flatMap((path) => path.modules.flatMap((module) => module.lessons))
      .filter((lesson) => lesson.status === "published");
    const react = published.filter((lesson) =>
      lesson.concepts.some(
        (link) => link.role === "primary" && link.conceptSlug.startsWith("react."),
      ),
    );
    expect(react.map((lesson) => lesson.slug)).toEqual([
      "what-react-is",
      "react-project-and-jsx",
      "components-and-props",
      "typescript-react-props",
      "state-and-use-state",
      "react-events",
      "conditional-rendering",
      "lists-and-keys",
      "forms-and-controlled-inputs",
      "effects-and-side-effects",
      "fetching-api-data",
      "component-composition",
      "lifting-state-up",
      "custom-hooks-basics",
    ]);
    expect(published.some((lesson) => lesson.slug === "pages-router")).toBe(false);
    for (const lesson of react) {
      expect(lesson.blocks.some((block) => block.type === "reading")).toBe(true);
      expect(lesson.blocks.some((block) => block.type === "check_question")).toBe(true);
      expect(lesson.blocks.some((block) => block.type === "recap")).toBe(true);
      expect(lesson.concepts.some((link) => link.role === "primary")).toBe(true);
      expect(
        document.exercises.some(
          (exercise) => exercise.published && exercise.lessonSlug === lesson.slug,
        ),
      ).toBe(true);
    }

    const parents = new Map<string, string[]>();
    for (const edge of document.prerequisites) {
      const list = parents.get(edge.conceptSlug) ?? [];
      list.push(edge.prerequisiteSlug);
      parents.set(edge.conceptSlug, list);
    }
    const seen = new Set<string>();
    const pending = ["react.custom-hook"];
    let reachesTypeScript = false;
    let reachesJavaScript = false;
    while (pending.length > 0) {
      const slug = pending.pop();
      if (slug === undefined || seen.has(slug)) {
        continue;
      }
      seen.add(slug);
      if (slug === "ts.generic") {
        reachesTypeScript = true;
      }
      if (slug === "web.javascript") {
        reachesJavaScript = true;
      }
      pending.push(...(parents.get(slug) ?? []));
    }
    expect(reachesTypeScript).toBe(true);
    expect(reachesJavaScript).toBe(true);

    const lessons = publishedLessons();
    const empty = new Map<string, { score: number; evidenceCount: number }>();
    const first = getNextAction({
      now,
      timeZone: "Asia/Baku",
      homework: [],
      sessions: [],
      lessons: lessons.map((lesson) => ({ ...lesson, progress: "not_started" })),
      prerequisites: frontendCurriculum.prerequisites,
      masteryByConcept: empty,
    });
    expect(first).toMatchObject({ kind: "start_lesson", lessonId: "how-the-web-delivers-a-page" });

    const reactIntro = lessons.find((lesson) => lesson.slug === "what-react-is");
    const typedProps = lessons.find((lesson) => lesson.slug === "typescript-react-props");
    expect(reactIntro).toBeDefined();
    expect(typedProps).toBeDefined();
    expect(
      isLessonUnlocked({
        lesson: reactIntro!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: empty,
      }),
    ).toBe(false);
    const javascriptOnly = new Map<string, { score: number; evidenceCount: number }>([
      ["web.javascript", { score: 80, evidenceCount: 4 }],
    ]);
    expect(
      isLessonUnlocked({
        lesson: reactIntro!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: javascriptOnly,
      }),
    ).toBe(false);
    const typescriptReady = new Map<string, { score: number; evidenceCount: number }>([
      ["ts.generic", { score: 80, evidenceCount: 4 }],
    ]);
    expect(
      isLessonUnlocked({
        lesson: reactIntro!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: typescriptReady,
      }),
    ).toBe(true);
    const weakProps = new Map<string, { score: number; evidenceCount: number }>([
      ["react.props", { score: 30, evidenceCount: 4 }],
      ["react.component", { score: 80, evidenceCount: 4 }],
      ["react.jsx", { score: 80, evidenceCount: 4 }],
      ["react.basics", { score: 80, evidenceCount: 4 }],
      ["ts.generic", { score: 80, evidenceCount: 4 }],
    ]);
    expect(
      isLessonUnlocked({
        lesson: typedProps!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: weakProps,
      }),
    ).toBe(false);

    const buttonProps = document.exercises.find(
      (exercise) => exercise.slug === "react-button-props",
    );
    expect(buttonProps?.execution ?? null).toBeNull();
    expect(buttonProps?.type).toBe("code_text");
    const passed = evaluateExercise({
      type: "code_text",
      rules: buttonProps?.rules ?? [],
      submission:
        "type ButtonProps = {\n  label: string;\n  disabled?: boolean;\n  onClick: () => void;\n};\n",
    });
    expect(passed.passed).toBe(true);
    const untyped = evaluateExercise({
      type: "code_text",
      rules: buttonProps?.rules ?? [],
      submission: "function Button(props) {\n  return props.label;\n}\n",
    });
    expect(untyped.passed).toBe(false);

    const weakState = decideAdaptive({
      now,
      timeZone: "Asia/Baku",
      concept: { score: 30, evidenceCount: 4, lastEvidenceAt: now },
      prerequisiteWeak: false,
      misconceptionOccurrences: 0,
      recent: [
        { source: "exercise", outcome: "failure", occurredAt: now },
        { source: "exercise", outcome: "failure", occurredAt: now },
      ],
    });
    expect(weakState.decision).toBe("REEXPLAIN");
    const strongComponent = decideAdaptive({
      now,
      timeZone: "Asia/Baku",
      concept: { score: 90, evidenceCount: 8, lastEvidenceAt: now },
      prerequisiteWeak: false,
      misconceptionOccurrences: 0,
      recent: [{ source: "exercise", outcome: "success", occurredAt: now }],
    });
    expect(strongComponent.decision).toBe("CHALLENGE");
  });

  it("keeps Next.js behind React and uses the current App Router", () => {
    const document = validateCurriculum(frontendCurriculum);
    const published = document.paths
      .filter((path) => path.status === "published")
      .flatMap((path) => path.modules.flatMap((module) => module.lessons))
      .filter((lesson) => lesson.status === "published");
    const nextLessons = published.filter((lesson) =>
      lesson.concepts.some(
        (link) => link.role === "primary" && link.conceptSlug.startsWith("next."),
      ),
    );
    expect(nextLessons.map((lesson) => lesson.slug)).toEqual([
      "what-nextjs-is",
      "nextjs-project-structure",
      "nextjs-app-router",
      "nextjs-file-routing",
      "nextjs-dynamic-routes",
      "nextjs-layouts",
      "nextjs-navigation",
      "nextjs-server-and-client",
      "nextjs-use-client",
      "nextjs-data-fetching",
      "nextjs-loading-and-error",
      "nextjs-params",
      "nextjs-metadata",
      "nextjs-rendering",
      "nextjs-route-handlers",
      "nextjs-environment",
    ]);
    expect(published.some((lesson) => lesson.slug === "pages-router")).toBe(false);
    const nextSlugs = document.concepts.filter((concept) => concept.slug.startsWith("next."));
    expect(new Set(nextSlugs.map((concept) => concept.slug)).size).toBe(nextSlugs.length);
    for (const lesson of nextLessons) {
      expect(
        lesson.blocks.some((block) => block.type === "reading" && block.markdown.length > 80),
      ).toBe(true);
      expect(lesson.blocks.some((block) => block.type === "check_question")).toBe(true);
      expect(lesson.blocks.some((block) => block.type === "recap")).toBe(true);
      expect(lesson.concepts.some((link) => link.role === "primary")).toBe(true);
      expect(
        document.exercises.some(
          (exercise) => exercise.published && exercise.lessonSlug === lesson.slug,
        ),
      ).toBe(true);
      expect(
        lesson.blocks.some((block) => block.type === "reading" && block.markdown.includes("sk-")),
      ).toBe(false);
    }

    const parents = new Map<string, string[]>();
    for (const edge of document.prerequisites) {
      const list = parents.get(edge.conceptSlug) ?? [];
      list.push(edge.prerequisiteSlug);
      parents.set(edge.conceptSlug, list);
    }
    const seen = new Set<string>();
    const pending = ["next.environment"];
    let reachesReact = false;
    let reachesTypeScript = false;
    let reachesJavaScript = false;
    while (pending.length > 0) {
      const slug = pending.pop();
      if (slug === undefined || seen.has(slug)) {
        continue;
      }
      seen.add(slug);
      if (slug === "react.custom-hook") {
        reachesReact = true;
      }
      if (slug === "ts.generic") {
        reachesTypeScript = true;
      }
      if (slug === "web.javascript") {
        reachesJavaScript = true;
      }
      pending.push(...(parents.get(slug) ?? []));
    }
    expect(reachesReact).toBe(true);
    expect(reachesTypeScript).toBe(true);
    expect(reachesJavaScript).toBe(true);

    const lessons = publishedLessons();
    const intro = lessons.find((lesson) => lesson.slug === "what-nextjs-is");
    const clientBoundary = lessons.find((lesson) => lesson.slug === "nextjs-use-client");
    expect(intro).toBeDefined();
    expect(clientBoundary).toBeDefined();
    const empty = new Map<string, { score: number; evidenceCount: number }>();
    expect(
      isLessonUnlocked({
        lesson: intro!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: empty,
      }),
    ).toBe(false);
    const javascriptOnly = new Map<string, { score: number; evidenceCount: number }>([
      ["web.javascript", { score: 80, evidenceCount: 4 }],
    ]);
    const typescriptOnly = new Map<string, { score: number; evidenceCount: number }>([
      ["ts.generic", { score: 80, evidenceCount: 4 }],
    ]);
    expect(
      isLessonUnlocked({
        lesson: intro!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: javascriptOnly,
      }),
    ).toBe(false);
    expect(
      isLessonUnlocked({
        lesson: intro!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: typescriptOnly,
      }),
    ).toBe(false);
    const reactReady = new Map<string, { score: number; evidenceCount: number }>([
      ["react.custom-hook", { score: 80, evidenceCount: 4 }],
    ]);
    expect(
      isLessonUnlocked({
        lesson: intro!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: reactReady,
      }),
    ).toBe(true);
    const weakClient = new Map<string, { score: number; evidenceCount: number }>([
      ["next.client-component", { score: 30, evidenceCount: 4 }],
      ["next.server-component", { score: 80, evidenceCount: 4 }],
      ["react.component", { score: 80, evidenceCount: 4 }],
      ["react.custom-hook", { score: 80, evidenceCount: 4 }],
    ]);
    expect(
      isLessonUnlocked({
        lesson: clientBoundary!,
        lessons,
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: weakClient,
      }),
    ).toBe(false);

    const paramsExercise = document.exercises.find(
      (exercise) => exercise.slug === "nx-await-params",
    );
    expect(paramsExercise?.execution ?? null).toBeNull();
    const passed = evaluateExercise({
      type: "code_text",
      rules: paramsExercise?.rules ?? [],
      submission:
        "export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ category?: string }> }) {\n  const { id } = await params;\n  const { category } = await searchParams;\n  return <p>{id}{category}</p>;\n}\n",
    });
    expect(passed.passed).toBe(true);
    const legacy = evaluateExercise({
      type: "code_text",
      rules: paramsExercise?.rules ?? [],
      submission: "export default function Page({ params }) {\n  return <p>{params.id}</p>;\n}\n",
    });
    expect(legacy.passed).toBe(false);

    const weakServer = decideAdaptive({
      now,
      timeZone: "Asia/Baku",
      concept: { score: 30, evidenceCount: 4, lastEvidenceAt: now },
      prerequisiteWeak: false,
      misconceptionOccurrences: 0,
      recent: [
        { source: "exercise", outcome: "failure", occurredAt: now },
        { source: "exercise", outcome: "failure", occurredAt: now },
      ],
    });
    expect(weakServer.decision).toBe("REEXPLAIN");
    const strongRouting = decideAdaptive({
      now,
      timeZone: "Asia/Baku",
      concept: { score: 90, evidenceCount: 8, lastEvidenceAt: now },
      prerequisiteWeak: false,
      misconceptionOccurrences: 0,
      recent: [{ source: "exercise", outcome: "success", occurredAt: now }],
    });
    expect(strongRouting.decision).toBe("CHALLENGE");
    const first = getNextAction({
      now,
      timeZone: "Asia/Baku",
      homework: [],
      sessions: [],
      lessons: lessons.map((lesson) => ({ ...lesson, progress: "not_started" })),
      prerequisites: frontendCurriculum.prerequisites,
      masteryByConcept: empty,
    });
    expect(first).toMatchObject({ kind: "start_lesson", lessonId: "how-the-web-delivers-a-page" });
  });
});
