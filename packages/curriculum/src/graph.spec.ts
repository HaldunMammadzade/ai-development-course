import { describe, expect, it } from "vitest";
import {
  getDirectPrerequisites,
  getLessonThatTeachesConcept,
  isConceptTaughtInPath,
  isLessonUnlocked,
  type PathLesson,
} from "./graph";

function lesson(overrides: Partial<PathLesson> & Pick<PathLesson, "slug">): PathLesson {
  return {
    id: overrides.slug,
    title: overrides.slug,
    modulePosition: 1,
    lessonPosition: 1,
    status: "published",
    primaryConceptSlugs: [],
    supportingConceptSlugs: [],
    ...overrides,
  };
}

const first = lesson({
  slug: "page",
  lessonPosition: 1,
  primaryConceptSlugs: ["web.http"],
});
const second = lesson({
  slug: "url",
  lessonPosition: 2,
  primaryConceptSlugs: ["web.url"],
});

describe("prerequisites", () => {
  it("keeps a lesson locked at 59 and unlocks it at 60", () => {
    const input = {
      lesson: second,
      lessons: [first, second],
      prerequisites: [{ conceptSlug: "web.url", prerequisiteSlug: "web.http" }],
    };
    expect(
      isLessonUnlocked({
        ...input,
        masteryByConcept: new Map([["web.http", { score: 59 }]]),
      }),
    ).toBe(false);
    expect(
      isLessonUnlocked({
        ...input,
        masteryByConcept: new Map([["web.http", { score: 60 }]]),
      }),
    ).toBe(true);
  });

  it("locks a lesson when a taught prerequisite is unseen", () => {
    expect(
      isLessonUnlocked({
        lesson: second,
        lessons: [first, second],
        prerequisites: [{ conceptSlug: "web.url", prerequisiteSlug: "web.http" }],
        masteryByConcept: new Map(),
      }),
    ).toBe(false);
  });

  it("does not let a supporting concept gate the lesson", () => {
    const gated = lesson({
      slug: "roles",
      primaryConceptSlugs: ["web.html"],
      supportingConceptSlugs: ["web.javascript"],
    });
    expect(
      isLessonUnlocked({
        lesson: gated,
        lessons: [first, gated],
        prerequisites: [{ conceptSlug: "web.javascript", prerequisiteSlug: "web.http" }],
        masteryByConcept: new Map([["web.http", { score: 0 }]]),
      }),
    ).toBe(true);
  });

  it("does not treat a draft lesson as taught", () => {
    const draft = lesson({
      slug: "draft-page",
      status: "draft",
      lessonPosition: 1,
      primaryConceptSlugs: ["web.http"],
    });
    const next = lesson({
      slug: "url",
      lessonPosition: 2,
      primaryConceptSlugs: ["web.url"],
    });

    expect(
      isConceptTaughtInPath([draft, next], "web.http", { modulePosition: 1, lessonPosition: 2 }),
    ).toBe(false);
    expect(
      isLessonUnlocked({
        lesson: next,
        lessons: [draft, next],
        prerequisites: [{ conceptSlug: "web.url", prerequisiteSlug: "web.http" }],
        masteryByConcept: new Map(),
      }),
    ).toBe(true);
    expect(getLessonThatTeachesConcept([draft, next], "web.http")).toBeNull();
  });

  it("returns the earliest published lesson that teaches a concept as primary", () => {
    const later = lesson({
      slug: "again",
      modulePosition: 2,
      lessonPosition: 1,
      primaryConceptSlugs: ["web.http"],
    });
    const supportingOnly = lesson({
      slug: "mention",
      lessonPosition: 2,
      supportingConceptSlugs: ["web.http"],
    });

    expect(getLessonThatTeachesConcept([later, supportingOnly, first], "web.http")?.slug).toBe(
      "page",
    );
    expect(
      getDirectPrerequisites([{ conceptSlug: "web.url", prerequisiteSlug: "web.http" }], "web.url"),
    ).toEqual(["web.http"]);
  });
});
