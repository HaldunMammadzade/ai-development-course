import { isLessonUnlocked } from "./graph";
import type { LessonCandidate } from "./next-action";
import { getNextAction } from "./next-action";
import { UNLOCK_MASTERY } from "./time";
import { describe, expect, it } from "vitest";

const NOW = new Date("2026-04-02T12:00:00.000Z");

function lesson(
  overrides: Partial<LessonCandidate> & Pick<LessonCandidate, "slug" | "lessonPosition">,
): LessonCandidate {
  return {
    id: overrides.slug,
    title: overrides.slug,
    modulePosition: 1,
    status: "published",
    progress: null,
    primaryConceptSlugs: [],
    supportingConceptSlugs: [],
    ...overrides,
  };
}

const first = lesson({ slug: "page", lessonPosition: 1, primaryConceptSlugs: ["web.http"] });
const second = lesson({
  slug: "url",
  lessonPosition: 2,
  modulePosition: 2,
  primaryConceptSlugs: ["web.url"],
});

describe("getNextAction", () => {
  it("prefers homework, then an open session, then the next unlocked lesson", () => {
    const shared = {
      now: NOW,
      timeZone: "UTC",
      lessons: [first, second],
      prerequisites: [{ conceptSlug: "web.url", prerequisiteSlug: "web.http" }],
      masteryByConcept: new Map([["web.http", { score: 80, evidenceCount: 3 }]]),
    };

    expect(
      getNextAction({
        ...shared,
        homework: [
          {
            id: "hw-1",
            lessonId: "page",
            title: "Repeat the request",
            status: "assigned",
            dueAt: new Date("2026-04-02T08:00:00.000Z"),
          },
        ],
        sessions: [
          {
            id: "session-1",
            lessonId: "page",
            title: "Page",
            state: "explain",
            endedAt: null,
            lastActivityAt: NOW,
          },
        ],
      }).kind,
    ).toBe("do_homework");

    expect(
      getNextAction({
        ...shared,
        homework: [
          {
            id: "hw-later",
            lessonId: "page",
            title: "Later",
            status: "assigned",
            dueAt: new Date("2026-04-03T08:00:00.000Z"),
          },
        ],
        sessions: [
          {
            id: "session-1",
            lessonId: "page",
            title: "Page",
            state: "explain",
            endedAt: null,
            lastActivityAt: NOW,
          },
        ],
      }),
    ).toMatchObject({ kind: "continue_lesson", sessionId: "session-1" });

    expect(
      getNextAction({
        ...shared,
        homework: [],
        sessions: [],
      }),
    ).toMatchObject({ kind: "start_lesson", lessonId: "url" });
  });

  it("skips an unlocked lesson whose primaries already meet the existing threshold", () => {
    expect(
      getNextAction({
        now: NOW,
        timeZone: "UTC",
        homework: [],
        sessions: [],
        lessons: [first, second],
        prerequisites: [{ conceptSlug: "web.url", prerequisiteSlug: "web.http" }],
        masteryByConcept: new Map([["web.http", { score: 80, evidenceCount: 3 }]]),
      }),
    ).toMatchObject({ kind: "start_lesson", lessonId: "url" });
  });

  it("does not treat an empty primary list or a locked mastered lesson as skippable", () => {
    const empty = lesson({ slug: "empty", lessonPosition: 1 });
    expect(
      getNextAction({
        now: NOW,
        timeZone: "UTC",
        homework: [],
        sessions: [],
        lessons: [empty, second],
        prerequisites: [],
        masteryByConcept: new Map([["web.url", { score: 90, evidenceCount: 4 }]]),
      }),
    ).toMatchObject({ kind: "start_lesson", lessonId: "empty" });

    expect(
      getNextAction({
        now: NOW,
        timeZone: "UTC",
        homework: [],
        sessions: [],
        lessons: [first, { ...second, primaryConceptSlugs: ["web.url"] }],
        prerequisites: [{ conceptSlug: "web.url", prerequisiteSlug: "web.http" }],
        masteryByConcept: new Map([["web.url", { score: 90, evidenceCount: 4 }]]),
      }),
    ).toMatchObject({ kind: "start_lesson", lessonId: "page" });
  });

  it("reviews the blocking prerequisite instead of finishing a locked path", () => {
    expect(UNLOCK_MASTERY).toBe(60);
    const locked = {
      now: NOW,
      timeZone: "UTC",
      homework: [],
      sessions: [],
      lessons: [
        { ...first, progress: "completed" as const },
        second,
        lesson({
          slug: "later",
          lessonPosition: 3,
          modulePosition: 3,
          primaryConceptSlugs: ["web.later"],
        }),
      ],
      prerequisites: [{ conceptSlug: "web.url", prerequisiteSlug: "web.http" }],
      masteryByConcept: new Map([["web.http", { score: 59, evidenceCount: 2 }]]),
    };
    expect(getNextAction(locked)).toEqual({
      kind: "review_concept",
      conceptSlug: "web.http",
      lessonId: "page",
      title: "page",
    });
    expect(
      getNextAction({
        ...locked,
        masteryByConcept: new Map([["web.http", { score: UNLOCK_MASTERY, evidenceCount: 2 }]]),
      }),
    ).toMatchObject({ kind: "start_lesson", lessonId: "url" });
  });

  it("reviews the lowest-scored blocking prerequisite, then the slug", () => {
    const http = lesson({ slug: "http", lessonPosition: 1, primaryConceptSlugs: ["web.http"] });
    const browser = lesson({
      slug: "browser",
      lessonPosition: 2,
      primaryConceptSlugs: ["web.browser"],
    });
    const page = lesson({
      slug: "composed",
      lessonPosition: 3,
      primaryConceptSlugs: ["web.page"],
    });
    const shared = {
      now: NOW,
      timeZone: "UTC",
      homework: [],
      sessions: [],
      lessons: [
        { ...http, progress: "completed" as const },
        { ...browser, progress: "completed" as const },
        page,
      ],
      prerequisites: [
        { conceptSlug: "web.page", prerequisiteSlug: "web.http" },
        { conceptSlug: "web.page", prerequisiteSlug: "web.browser" },
      ],
    };
    expect(
      getNextAction({
        ...shared,
        masteryByConcept: new Map([
          ["web.http", { score: 55, evidenceCount: 2 }],
          ["web.browser", { score: 40, evidenceCount: 2 }],
        ]),
      }),
    ).toMatchObject({ kind: "review_concept", conceptSlug: "web.browser", lessonId: "browser" });
    expect(
      getNextAction({
        ...shared,
        masteryByConcept: new Map([
          ["web.http", { score: 50, evidenceCount: 2 }],
          ["web.browser", { score: 50, evidenceCount: 2 }],
        ]),
      }),
    ).toMatchObject({ kind: "review_concept", conceptSlug: "web.browser", lessonId: "browser" });
    expect(
      getNextAction({
        ...shared,
        masteryByConcept: new Map([["web.browser", { score: 10, evidenceCount: 1 }]]),
      }),
    ).toMatchObject({ kind: "review_concept", conceptSlug: "web.http", lessonId: "http" });
  });

  it("reviews a weak concept before declaring the path complete", () => {
    const completed = [
      { ...first, progress: "completed" as const },
      { ...second, progress: "completed" as const },
    ];
    expect(
      getNextAction({
        now: NOW,
        timeZone: "UTC",
        homework: [],
        sessions: [],
        lessons: completed,
        prerequisites: [],
        masteryByConcept: new Map([
          ["web.http", { score: 30, evidenceCount: 2 }],
          ["web.url", { score: 20, evidenceCount: 1 }],
        ]),
      }),
    ).toMatchObject({ kind: "review_concept", conceptSlug: "web.http", lessonId: "page" });

    expect(
      getNextAction({
        now: NOW,
        timeZone: "UTC",
        homework: [],
        sessions: [],
        lessons: completed,
        prerequisites: [],
        masteryByConcept: new Map([["web.http", { score: 90, evidenceCount: 4 }]]),
      }),
    ).toEqual({ kind: "path_complete" });
  });

  it("reviews an eligible lesson for the blocking concept and skips a locked teacher", () => {
    const base = lesson({ slug: "base", lessonPosition: 1, primaryConceptSlugs: ["web.base"] });
    const early = lesson({
      slug: "early",
      lessonPosition: 2,
      primaryConceptSlugs: ["web.http", "web.extra"],
    });
    const later = lesson({ slug: "later", lessonPosition: 3, primaryConceptSlugs: ["web.http"] });
    const same = lesson({ slug: "also", lessonPosition: 3, primaryConceptSlugs: ["web.http"] });
    const locked = lesson({
      slug: "url",
      lessonPosition: 4,
      modulePosition: 2,
      primaryConceptSlugs: ["web.url"],
    });
    const prerequisites = [
      { conceptSlug: "web.extra", prerequisiteSlug: "web.base" },
      { conceptSlug: "web.url", prerequisiteSlug: "web.http" },
    ];
    const shared = {
      now: NOW,
      timeZone: "UTC",
      homework: [],
      sessions: [],
      prerequisites,
    };
    const openable = {
      ...shared,
      lessons: [
        { ...base, progress: "completed" as const },
        { ...early, progress: "completed" as const },
        { ...later, progress: "completed" as const },
        locked,
      ],
      masteryByConcept: new Map([
        ["web.base", { score: 40, evidenceCount: 2 }],
        ["web.http", { score: 50, evidenceCount: 2 }],
      ]),
    };
    const action = getNextAction(openable);
    expect(action).toMatchObject({
      kind: "review_concept",
      conceptSlug: "web.http",
      lessonId: "later",
    });
    expect(
      sessionWouldOpen(action, openable.lessons, prerequisites, openable.masteryByConcept),
    ).toBe(true);

    const ordered = getNextAction({
      ...shared,
      lessons: [
        { ...base, progress: "completed" as const },
        { ...early, primaryConceptSlugs: ["web.http"], progress: "completed" as const },
        { ...later, progress: "completed" as const },
        { ...same, progress: "completed" as const },
        locked,
      ],
      masteryByConcept: new Map([["web.http", { score: 50, evidenceCount: 2 }]]),
    });
    expect(ordered).toMatchObject({
      kind: "review_concept",
      conceptSlug: "web.http",
      lessonId: "early",
    });

    const tied = getNextAction({
      ...shared,
      lessons: [
        { ...later, id: "b-http", slug: "b-http", progress: "completed" as const },
        { ...same, id: "a-http", slug: "a-http", progress: "completed" as const },
        locked,
      ],
      masteryByConcept: new Map([["web.http", { score: 50, evidenceCount: 2 }]]),
    });
    expect(tied).toMatchObject({
      kind: "review_concept",
      conceptSlug: "web.http",
      lessonId: "a-http",
    });
  });

  it("does not open a locked teacher or finish the path when that concept has no eligible lesson", () => {
    const base = lesson({ slug: "base", lessonPosition: 1, primaryConceptSlugs: ["web.base"] });
    const early = lesson({
      slug: "early",
      lessonPosition: 2,
      primaryConceptSlugs: ["web.http", "web.extra"],
    });
    const locked = lesson({
      slug: "url",
      lessonPosition: 3,
      modulePosition: 2,
      primaryConceptSlugs: ["web.url"],
    });
    const prerequisites = [
      { conceptSlug: "web.extra", prerequisiteSlug: "web.base" },
      { conceptSlug: "web.url", prerequisiteSlug: "web.http" },
    ];
    const input = {
      now: NOW,
      timeZone: "UTC",
      homework: [],
      sessions: [],
      lessons: [
        { ...base, progress: "completed" as const },
        { ...early, progress: "completed" as const },
        locked,
      ],
      prerequisites,
      masteryByConcept: new Map([
        ["web.base", { score: 40, evidenceCount: 2 }],
        ["web.http", { score: 50, evidenceCount: 1 }],
      ]),
    };
    const action = getNextAction(input);
    expect(action.kind).not.toBe("path_complete");
    expect(action).toMatchObject({
      kind: "review_concept",
      conceptSlug: "web.base",
      lessonId: "base",
    });
    expect(["early", "url"]).not.toContain(
      action.kind === "review_concept" || action.kind === "start_lesson" ? action.lessonId : "",
    );
    expect(sessionWouldOpen(action, input.lessons, prerequisites, input.masteryByConcept)).toBe(
      true,
    );
  });

  it("treats homework as due on the student-local day", () => {
    const action = getNextAction({
      now: new Date("2026-04-01T22:00:00.000Z"),
      timeZone: "Asia/Baku",
      homework: [
        {
          id: "hw-baku",
          lessonId: "page",
          title: "Tonight",
          status: "assigned",
          dueAt: new Date("2026-04-01T21:00:00.000Z"),
        },
      ],
      sessions: [],
      lessons: [first],
      prerequisites: [],
      masteryByConcept: new Map(),
    });
    expect(action.kind).toBe("do_homework");
    expect(
      getNextAction({
        now: new Date("2026-04-01T22:00:00.000Z"),
        timeZone: "UTC",
        homework: [
          {
            id: "hw-utc",
            lessonId: "page",
            title: "Tomorrow",
            status: "assigned",
            dueAt: new Date("2026-04-02T08:00:00.000Z"),
          },
        ],
        sessions: [],
        lessons: [first],
        prerequisites: [],
        masteryByConcept: new Map(),
      }).kind,
    ).toBe("start_lesson");
  });

  it("does not resume a finished review as an open lesson", () => {
    expect(
      getNextAction({
        now: NOW,
        timeZone: "UTC",
        homework: [],
        sessions: [
          {
            id: "review-1",
            lessonId: "page",
            title: "Page",
            state: "review_completed",
            endedAt: NOW,
            lastActivityAt: NOW,
          },
        ],
        lessons: [first, second],
        prerequisites: [{ conceptSlug: "web.url", prerequisiteSlug: "web.http" }],
        masteryByConcept: new Map([["web.http", { score: 59, evidenceCount: 2 }]]),
      }),
    ).toMatchObject({ kind: "start_lesson", lessonId: "page" });
    expect(
      getNextAction({
        now: NOW,
        timeZone: "UTC",
        homework: [],
        sessions: [
          {
            id: "review-1",
            lessonId: "page",
            title: "Page",
            state: "review_completed",
            endedAt: NOW,
            lastActivityAt: NOW,
          },
        ],
        lessons: [{ ...first, progress: "completed" }, second],
        prerequisites: [{ conceptSlug: "web.url", prerequisiteSlug: "web.http" }],
        masteryByConcept: new Map([["web.http", { score: 59, evidenceCount: 2 }]]),
      }),
    ).toMatchObject({ kind: "review_concept", conceptSlug: "web.http", lessonId: "page" });
    expect(UNLOCK_MASTERY).toBe(60);
  });
});

function sessionWouldOpen(
  action: ReturnType<typeof getNextAction>,
  lessons: LessonCandidate[],
  prerequisites: Array<{ conceptSlug: string; prerequisiteSlug: string }>,
  masteryByConcept: ReadonlyMap<string, { score: number; evidenceCount: number }>,
): boolean {
  if (action.kind !== "review_concept" && action.kind !== "start_lesson") {
    return false;
  }
  const lesson = lessons.find((item) => item.id === action.lessonId);
  return (
    lesson !== undefined &&
    lesson.status === "published" &&
    isLessonUnlocked({
      lesson,
      lessons,
      prerequisites,
      masteryByConcept,
    })
  );
}
