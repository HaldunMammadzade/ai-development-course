import { describe, expect, it } from "vitest";
import {
  presentLearningCatalog,
  type CatalogContext,
  type CatalogModuleSource,
} from "./learning-catalog";

const now = new Date("2026-06-01T12:00:00.000Z");

function context(patch: Partial<CatalogContext> = {}): CatalogContext {
  return {
    timeZone: "UTC",
    homework: [],
    sessions: [],
    lessons: [
      {
        id: "lesson-1",
        slug: "how-the-web-delivers-a-page",
        title: "Brauzer səhifəni necə alır",
        modulePosition: 1,
        lessonPosition: 1,
        status: "published",
        primaryConceptSlugs: ["web.http"],
        supportingConceptSlugs: ["web.browser"],
        progress: null,
      },
      {
        id: "lesson-2",
        slug: "what-is-a-url",
        title: "URL nədir",
        modulePosition: 1,
        lessonPosition: 2,
        status: "published",
        primaryConceptSlugs: ["web.url"],
        supportingConceptSlugs: [],
        progress: null,
      },
    ],
    prerequisites: [{ conceptSlug: "web.url", prerequisiteSlug: "web.http" }],
    mastery: [],
    ...patch,
  };
}

const modules: CatalogModuleSource[] = [
  {
    slug: "web",
    title: "Web Fundamentals",
    description: "Səhifənin yolu",
    position: 1,
    lessons: [
      {
        id: "lesson-1",
        slug: "how-the-web-delivers-a-page",
        title: "Brauzer səhifəni necə alır",
        objective: "HTTP sorğusunu izah etmək.",
        estimatedMinutes: 15,
        position: 1,
        status: "published",
        primaryConceptSlugs: ["web.http"],
        supportingConceptSlugs: ["web.browser"],
      },
      {
        id: "lesson-2",
        slug: "what-is-a-url",
        title: "URL nədir",
        objective: "URL hissələrini tanımaq.",
        estimatedMinutes: 12,
        position: 2,
        status: "published",
        primaryConceptSlugs: ["web.url"],
        supportingConceptSlugs: [],
      },
      {
        id: "lesson-draft",
        slug: "css-selectors",
        title: "CSS selektorları",
        objective: "Selektor.",
        estimatedMinutes: 10,
        position: 3,
        status: "draft",
        primaryConceptSlugs: ["css.selector"],
        supportingConceptSlugs: [],
      },
    ],
  },
];

describe("presentLearningCatalog", () => {
  it("marks the server's next lesson current and keeps the rest locked", () => {
    const catalog = presentLearningCatalog({
      now,
      path: {
        slug: "frontend",
        title: "Frontend",
        description: "Frontend yolu",
        status: "published",
      },
      modules,
      concepts: [
        { slug: "web.http", name: "HTTP" },
        { slug: "web.browser", name: "Browser" },
        { slug: "web.url", name: "URL" },
        { slug: "css.selector", name: "CSS selector" },
      ],
      context: context(),
      evidence: [{ conceptSlug: "web.http", source: "exercise" }],
    });

    expect(catalog.nextAction).toMatchObject({ kind: "start_lesson", lessonId: "lesson-1" });
    expect(catalog.personalized?.current?.slug).toBe("how-the-web-delivers-a-page");
    expect(catalog.personalized?.known).toEqual([]);
    expect(catalog.modules[0]?.lessons.map((lesson) => [lesson.slug, lesson.availability])).toEqual(
      [
        ["how-the-web-delivers-a-page", "current"],
        ["what-is-a-url", "locked"],
      ],
    );
    expect(catalog.concepts).toEqual([
      {
        slug: "web.http",
        name: "HTTP",
        moduleTitle: "Web Fundamentals",
        lessonSlug: "how-the-web-delivers-a-page",
        mastery: null,
        confidence: null,
        band: null,
        reviewDue: false,
      },
      {
        slug: "web.browser",
        name: "Browser",
        moduleTitle: "Web Fundamentals",
        lessonSlug: "how-the-web-delivers-a-page",
        mastery: null,
        confidence: null,
        band: null,
        reviewDue: false,
      },
      {
        slug: "web.url",
        name: "URL",
        moduleTitle: "Web Fundamentals",
        lessonSlug: "what-is-a-url",
        mastery: null,
        confidence: null,
        band: null,
        reviewDue: false,
      },
    ]);
    expect(catalog.modules[0]?.lessons[0]).not.toHaveProperty("id");
    expect(catalog.activity).toEqual([]);
    expect(catalog.skill?.concepts.map((concept) => concept.slug)).toEqual([
      "web.http",
      "web.browser",
      "web.url",
    ]);
    expect(catalog.skill?.concepts.every((concept) => concept.state === "unknown")).toBe(true);
    expect(
      catalog.skill?.concepts.find((concept) => concept.slug === "web.url")?.prerequisites,
    ).toEqual([{ slug: "web.http", name: "HTTP", state: "unknown" }]);
    expect(
      catalog.skill?.concepts.find((concept) => concept.slug === "web.browser")?.prerequisites,
    ).toEqual([]);
    expect(catalog.skill?.concepts.some((concept) => concept.slug === "css.selector")).toBe(false);
    expect(JSON.stringify(catalog.skill)).not.toContain("mastery");
    expect(catalog.skill?.focus?.lessonTitle).toBe("Brauzer səhifəni necə alır");
    expect(
      catalog.skill?.concepts.find((concept) => concept.slug === "web.http")?.evidenceSource,
    ).toBe("exercise");
    expect(
      catalog.skill?.concepts.find((concept) => concept.slug === "web.url")?.lessonAvailability,
    ).toBe("locked");
    expect(
      catalog.skill?.concepts.find((concept) => concept.slug === "web.http")?.lessonAvailability,
    ).toBe("current");
  });

  it("keeps a completed lesson completed while homework is the next action", () => {
    const catalog = presentLearningCatalog({
      now,
      path: {
        slug: "frontend",
        title: "Frontend",
        description: "Frontend yolu",
        status: "published",
      },
      modules,
      concepts: [{ slug: "web.http", name: "HTTP" }],
      context: context({
        lessons: [
          {
            id: "lesson-1",
            slug: "how-the-web-delivers-a-page",
            title: "Brauzer səhifəni necə alır",
            modulePosition: 1,
            lessonPosition: 1,
            status: "published",
            primaryConceptSlugs: ["web.http"],
            supportingConceptSlugs: [],
            progress: "completed",
          },
        ],
        homework: [
          {
            id: "homework-1",
            lessonId: "lesson-1",
            title: "Brauzer səhifəni necə alır",
            status: "assigned",
            dueAt: new Date("2026-06-01T00:00:00.000Z"),
          },
        ],
        mastery: [{ conceptSlug: "web.http", score: 80, evidenceCount: 2 }],
      }),
    });

    expect(catalog.nextAction.kind).toBe("do_homework");
    expect(catalog.modules[0]?.lessons[0]).toMatchObject({ availability: "completed" });
    expect(catalog.concepts[0]).toEqual({
      slug: "web.http",
      name: "HTTP",
      moduleTitle: "Web Fundamentals",
      lessonSlug: "how-the-web-delivers-a-page",
      mastery: 80,
      confidence: "low",
      band: "strong",
      reviewDue: false,
    });
  });

  it("credits a mastered lesson and keeps review on the decayed concept", () => {
    const catalog = presentLearningCatalog({
      now,
      path: {
        slug: "frontend",
        title: "Frontend",
        description: "Frontend yolu",
        status: "published",
      },
      modules,
      concepts: [
        { slug: "web.http", name: "HTTP" },
        { slug: "web.url", name: "URL" },
      ],
      context: context({
        mastery: [
          {
            conceptSlug: "web.http",
            score: 62,
            evidenceCount: 4,
            lastEvidenceAt: new Date("2026-05-01T00:00:00.000Z"),
          },
        ],
      }),
    });

    expect(catalog.concepts[0]?.reviewDue).toBe(true);
    expect(catalog.focus).toMatchObject({
      slug: "web.http",
      decision: "REVIEW",
      reason: "decayed",
    });
    expect(catalog.nextAction).toMatchObject({ kind: "start_lesson", lessonId: "lesson-2" });
    expect(catalog.modules[0]?.lessons.map((lesson) => [lesson.slug, lesson.availability])).toEqual(
      [
        ["how-the-web-delivers-a-page", "completed"],
        ["what-is-a-url", "current"],
      ],
    );
    expect(catalog.personalized?.note).toBe("Bu mövzunun əsaslarını əvvəlcə möhkəmləndirək.");
    expect(catalog.personalized?.current?.slug).toBe("what-is-a-url");
  });

  it("links a locked-path review to the lesson the session can open", () => {
    const source = context();
    const first = source.lessons[0];
    const second = source.lessons[1];
    if (first === undefined || second === undefined) {
      throw new Error("fixture");
    }
    const catalog = presentLearningCatalog({
      now,
      path: {
        slug: "frontend",
        title: "Frontend",
        description: "Frontend yolu",
        status: "published",
      },
      modules,
      concepts: [
        { slug: "web.http", name: "HTTP" },
        { slug: "web.url", name: "URL" },
      ],
      context: context({
        lessons: [{ ...first, progress: "completed" }, second],
        mastery: [{ conceptSlug: "web.http", score: 59, evidenceCount: 2 }],
      }),
    });

    expect(catalog.nextAction).toEqual({
      kind: "review_concept",
      conceptSlug: "web.http",
      lessonId: "lesson-1",
      title: "Brauzer səhifəni necə alır",
    });
    expect(catalog.modules[0]?.lessons.map((lesson) => [lesson.slug, lesson.availability])).toEqual(
      [
        ["how-the-web-delivers-a-page", "current"],
        ["what-is-a-url", "locked"],
      ],
    );
    expect(catalog.personalized?.current?.slug).toBe("how-the-web-delivers-a-page");
  });
});
