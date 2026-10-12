import { describe, expect, it } from "vitest";
import { frontendCurriculum } from "./frontend-seed";
import { getNextAction, type LessonCandidate } from "./next-action";
import { buildPersonalizedPath, lessonIsCredited } from "./personalized-path";

const now = new Date("2026-10-08T08:00:00.000Z");

function pathLessons(): Array<LessonCandidate & { moduleTitle: string }> {
  const path = frontendCurriculum.paths.find((entry) => entry.slug === "frontend");
  if (path === undefined) {
    throw new Error("Frontend path is missing.");
  }
  return path.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      id: lesson.slug,
      slug: lesson.slug,
      title: lesson.title,
      moduleTitle: module.title,
      modulePosition: module.position,
      lessonPosition: lesson.position,
      status: lesson.status,
      primaryConceptSlugs: lesson.concepts
        .filter((link) => link.role === "primary")
        .map((link) => link.conceptSlug),
      supportingConceptSlugs: lesson.concepts
        .filter((link) => link.role !== "primary")
        .map((link) => link.conceptSlug),
      progress: null,
    })),
  );
}

function names(): Map<string, string> {
  return new Map(frontendCurriculum.concepts.map((concept) => [concept.slug, concept.name]));
}

function scored(
  slugs: readonly string[],
  score = 80,
): Map<string, { score: number; evidenceCount: number }> {
  return new Map(slugs.map((slug) => [slug, { score, evidenceCount: 4 }]));
}

function primariesUntil(slug: string, include: boolean): string[] {
  const lessons = pathLessons().filter((lesson) => lesson.status === "published");
  const index = lessons.findIndex((lesson) => lesson.slug === slug);
  if (index < 0) {
    throw new Error(`Missing lesson ${slug}`);
  }
  return lessons
    .slice(0, include ? index + 1 : index)
    .flatMap((lesson) => lesson.primaryConceptSlugs);
}

function route(
  mastery: Map<string, { score: number; evidenceCount: number }>,
  lessons = pathLessons(),
  focus: { decision: "CONTINUE" | "REMEDIATE_PREREQUISITE" | "REVIEW" | "CHALLENGE" } | null = null,
) {
  return buildPersonalizedPath({
    lessons,
    prerequisites: frontendCurriculum.prerequisites,
    masteryByConcept: mastery,
    names: names(),
    focus,
  });
}

describe("personalized learning path", () => {
  it("starts a beginner at the first lesson", () => {
    const path = route(new Map());
    const published = pathLessons().filter((lesson) => lesson.status === "published");
    expect(path.current?.slug).toBe("how-the-web-delivers-a-page");
    expect(path.next.map((step) => step.slug)).toEqual(
      published.slice(1, 4).map((lesson) => lesson.slug),
    );
    expect(path.known).toEqual([]);
    expect(path.concepts.some((concept) => concept.mark === "known")).toBe(false);
    expect(path.concepts.find((concept) => concept.slug === "web.http")?.mark).toBe("current");
    expect(path.note).toBeNull();
    expect(JSON.stringify(path)).not.toContain("REMEDIATE");
    expect(JSON.stringify(path)).not.toContain("UNLOCK");
  });

  it("starts HTML and CSS evidence at the first JavaScript lesson", () => {
    const path = route(scored(primariesUntil("js-basics", false)));
    expect(path.current?.slug).toBe("js-basics");
    expect(path.current?.moduleTitle.length).toBeGreaterThan(0);
    expect(path.next[0]?.slug).toBe("js-variables");
    expect(path.known).toContain(names().get("css.responsive"));
    expect(path.known).not.toContain(names().get("web.javascript"));
    expect(path.concepts.find((concept) => concept.slug === "web.javascript")?.mark).toBe(
      "current",
    );
  });

  it("moves strong JavaScript evidence to the next legal lesson", () => {
    const mastery = scored(primariesUntil("js-functions", true));
    const path = route(mastery);
    expect(path.current?.slug).toBe("js-arrays");
    expect(path.next.map((step) => step.slug)).not.toContain("js-functions");
    expect(path.known).toContain(names().get("js.function"));
    expect(
      getNextAction({
        now,
        timeZone: "UTC",
        homework: [],
        sessions: [],
        lessons: pathLessons(),
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: mastery,
      }),
    ).toMatchObject({ kind: "start_lesson", lessonId: "js-arrays" });
  });

  it("keeps a React-strong profile on the JavaScript prerequisite gap", () => {
    const mastery = scored([
      ...primariesUntil("js-basics", false),
      "js.function",
      "react.component",
      "react.props",
      "next.app-router",
      "next.server-component",
    ]);
    const path = route(mastery);
    expect(path.current?.slug).toBe("js-basics");
    expect(path.next.map((step) => step.slug)).toEqual([
      "js-variables",
      "js-values",
      "js-conditions",
    ]);
    expect(path.next.map((step) => step.slug)).not.toContain("components-and-props");
    expect(path.next.map((step) => step.slug)).not.toContain("js-functions");
    expect(path.note).toBe("Bu mərhələyə keçmək üçün bir əsas mövzu qalıb.");
    expect(path.known).toContain(names().get("react.component"));
    expect(path.known).not.toContain(names().get("web.javascript"));
    expect(path.concepts.find((concept) => concept.slug === "js.function")?.mark).toBe("known");
    expect(
      lessonIsCredited({
        lesson: pathLessons().find((lesson) => lesson.slug === "components-and-props")!,
        lessons: pathLessons(),
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: mastery,
      }),
    ).toBe(false);
  });

  it("keeps a mixed profile on the first legal lesson and does not mark a weak concept known", () => {
    const mastery = scored(["html.semantic"]);
    mastery.set("js.function", { score: 20, evidenceCount: 4 });
    const path = route(mastery);
    expect(path.current?.slug).toBe("how-the-web-delivers-a-page");
    expect(path.known).not.toContain(names().get("js.function"));
    expect(path.known).not.toContain(names().get("react.component"));
    expect(
      path.concepts.every(
        (concept) => concept.mark !== "known" || concept.slug === "html.semantic",
      ),
    ).toBe(true);
  });

  it("changes the recommendation when a weak prerequisite becomes known", () => {
    const mastery = scored(primariesUntil("js-basics", false));
    expect(route(mastery).current?.slug).toBe("js-basics");
    mastery.set("web.javascript", { score: 80, evidenceCount: 4 });
    const next = route(mastery);
    expect(next.current?.slug).toBe("js-variables");
    expect(
      getNextAction({
        now,
        timeZone: "UTC",
        homework: [],
        sessions: [],
        lessons: pathLessons(),
        prerequisites: frontendCurriculum.prerequisites,
        masteryByConcept: mastery,
      }),
    ).toMatchObject({ kind: "start_lesson", lessonId: "js-variables" });
  });

  it("follows saved progress for a returning student without an assessment record", () => {
    const lessons = pathLessons().map((lesson) =>
      lesson.slug === "how-the-web-delivers-a-page"
        ? { ...lesson, progress: "in_progress" as const }
        : lesson,
    );
    const path = route(new Map(), lessons);
    expect(path.current?.slug).toBe("how-the-web-delivers-a-page");
    expect(path.known).toEqual([]);
  });

  it("does not let a challenge decision skip a prerequisite", () => {
    const path = route(scored(primariesUntil("js-basics", false)), pathLessons(), {
      decision: "CHALLENGE",
    });
    expect(path.current?.slug).toBe("js-basics");
    expect(path.note).toBeNull();
  });

  it("states a foundation gap in words when adaptive remediation is the focus", () => {
    const path = route(new Map(), pathLessons(), { decision: "REMEDIATE_PREREQUISITE" });
    expect(path.note).toBe("Əvvəl bu əsas mövzunu möhkəmləndirək.");
    expect(JSON.stringify(path)).not.toContain("REMEDIATE_PREREQUISITE");
  });
});
