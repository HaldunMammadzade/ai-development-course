import { describe, expect, it } from "vitest";
import { MASTERY_DECAY_DAYS } from "./time";
import {
  presentLearningCatalog,
  type CatalogContext,
  type CatalogModuleSource,
} from "./learning-catalog";
import {
  REVISION_QUEUE_LIMIT,
  buildRevision,
  revisionIntervalDays,
  revisionScheduleState,
  selectRevisionExercise,
  summarizeSuccesses,
  type RevisionConceptInput,
  type RevisionEvent,
  type RevisionExercise,
} from "./revision";

const now = new Date("2026-06-15T12:00:00.000Z");

function daysBefore(count: number): Date {
  return new Date(now.getTime() - count * 86_400_000);
}

function concept(patch: Partial<RevisionConceptInput> = {}): RevisionConceptInput {
  return {
    slug: "web.http",
    name: "HTTP",
    lessonSlug: "how-the-web-delivers-a-page",
    lessonTitle: "Brauzer səhifəni necə alır",
    lessonAvailability: "current",
    band: "strong",
    ...patch,
  };
}

function exercise(patch: Partial<RevisionExercise> = {}): RevisionExercise {
  return {
    slug: "http-request-choice",
    position: 1,
    conceptSlug: "web.http",
    lessonSlug: "how-the-web-delivers-a-page",
    modulePosition: 1,
    lessonPosition: 1,
    ...patch,
  };
}

function success(conceptSlug: string, days: number, count = 1) {
  return { conceptSlug, successCount: count, lastSuccessAt: daysBefore(days) };
}

function queue(
  concepts: RevisionConceptInput[],
  successes = [success("web.http", 30)],
  exercises = [exercise()],
) {
  return buildRevision({
    now,
    timeZone: "UTC",
    concepts,
    successes,
    exercises,
    lessonTitles: new Map(concepts.map((item) => [item.lessonSlug, item.lessonTitle])),
  });
}

describe("spaced revision", () => {
  it("ignores missing evidence, unknown concepts, and speaking", () => {
    expect(summarizeSuccesses([])).toEqual([]);
    const events: RevisionEvent[] = [
      {
        id: "low",
        conceptSlug: "web.http",
        occurredAt: daysBefore(40),
        evidence: 79,
        source: "exercise",
      },
      {
        id: "speak",
        conceptSlug: "web.http",
        occurredAt: daysBefore(40),
        evidence: 80,
        source: "speaking",
      },
    ];
    expect(summarizeSuccesses(events)).toEqual([]);
    expect(queue([concept({ band: null })], []).status).toBe("empty");
    expect(queue([concept({ band: null })], [success("web.http", 40)]).items).toEqual([]);
  });

  it("keeps a weak concept out of ordinary revision", () => {
    const result = queue([concept({ band: "weak" })], [success("web.http", 40)]);
    expect(result.status).toBe("empty");
    expect(result.items).toEqual([]);
    expect(result.states.has("web.http")).toBe(false);
  });

  it("waits after a recent success and becomes due on the interval boundary", () => {
    expect(
      revisionScheduleState({
        now,
        timeZone: "UTC",
        successCount: 1,
        lastSuccessAt: daysBefore(1),
      }),
    ).toBe("not_due");
    expect(
      revisionScheduleState({
        now,
        timeZone: "UTC",
        successCount: 1,
        lastSuccessAt: daysBefore(MASTERY_DECAY_DAYS),
      }),
    ).toBe("due");
    expect(queue([concept()], [success("web.http", 30)]).items[0]?.state).toBe("due");
  });

  it("marks a concept overdue one decay window after it became due", () => {
    expect(
      revisionScheduleState({
        now,
        timeZone: "UTC",
        successCount: 1,
        lastSuccessAt: daysBefore(MASTERY_DECAY_DAYS * 2),
      }),
    ).toBe("overdue");
    expect(queue([concept()], [success("web.http", 50)]).items[0]?.state).toBe("overdue");
  });

  it("recalculates the window after another success and keeps a same-day review off the queue", () => {
    expect(revisionIntervalDays(1)).toBe(MASTERY_DECAY_DAYS);
    expect(revisionIntervalDays(2)).toBe(MASTERY_DECAY_DAYS * 2);
    expect(revisionIntervalDays(8)).toBe(MASTERY_DECAY_DAYS * 3);
    const reviewed = queue([concept()], [success("web.http", 0, 2)]);
    expect(reviewed.status).toBe("reviewed");
    expect(reviewed.items).toEqual([]);
    expect(reviewed.states.get("web.http")).toBe("recently_reviewed");
    expect(
      revisionScheduleState({
        now,
        timeZone: "UTC",
        successCount: 1,
        lastSuccessAt: now,
      }),
    ).toBe("not_due");
  });

  it("does not treat a failed event as a completed review", () => {
    const events: RevisionEvent[] = [
      {
        id: "pass",
        conceptSlug: "web.http",
        occurredAt: daysBefore(30),
        evidence: 90,
        source: "exercise",
      },
      { id: "fail", conceptSlug: "web.http", occurredAt: now, evidence: 20, source: "exercise" },
    ];
    const summary = summarizeSuccesses(events);
    expect(summary).toEqual([
      { conceptSlug: "web.http", successCount: 1, lastSuccessAt: daysBefore(30) },
    ]);
    const result = queue([concept({ band: "strong" })], summary);
    expect(result.items.map((item) => item.slug)).toEqual(["web.http"]);
    expect(result.items[0]?.state).toBe("due");
  });

  it("orders overdue before due, then stronger and older evidence, with a stable slug", () => {
    const result = queue(
      [
        concept({ slug: "css.flex", name: "Flexbox", band: "fragile" }),
        concept({ slug: "ts.interface", name: "Interface", band: "strong" }),
        concept({ slug: "react.props", name: "Props", band: "working" }),
        concept({ slug: "html.link", name: "Link", band: "strong" }),
      ],
      [
        success("css.flex", 50),
        success("ts.interface", 50, 2),
        success("react.props", 30),
        success("html.link", 40),
      ],
      [
        exercise({ conceptSlug: "css.flex", slug: "flex" }),
        exercise({ conceptSlug: "ts.interface", slug: "interface" }),
        exercise({ conceptSlug: "react.props", slug: "props" }),
        exercise({ conceptSlug: "html.link", slug: "link" }),
      ],
    );
    expect(result.items.map((item) => item.slug)).toEqual([
      "css.flex",
      "html.link",
      "ts.interface",
      "react.props",
    ]);
  });

  it("keeps the queue bounded and leaves the rest untouched", () => {
    const concepts = Array.from({ length: REVISION_QUEUE_LIMIT + 3 }, (_, index) =>
      concept({ slug: `concept-${index}`, name: `Concept ${index}` }),
    );
    const result = queue(
      concepts,
      concepts.map((item) => success(item.slug, 40)),
      concepts.map((item) => exercise({ conceptSlug: item.slug, slug: `exercise-${item.slug}` })),
    );
    expect(result.items).toHaveLength(REVISION_QUEUE_LIMIT);
    expect(result.status).toBe("ready");
    expect(new Set(result.items.map((item) => item.slug)).size).toBe(REVISION_QUEUE_LIMIT);
  });

  it("counts a duplicated event once and drops a duplicated concept", () => {
    const occurredAt = daysBefore(30);
    const summary = summarizeSuccesses([
      { id: "same", conceptSlug: "web.http", occurredAt, evidence: 90, source: "quiz" },
      { id: "same", conceptSlug: "web.http", occurredAt, evidence: 90, source: "quiz" },
      {
        id: "other",
        conceptSlug: "web.http",
        occurredAt: daysBefore(10),
        evidence: 90,
        source: "quiz",
      },
    ]);
    expect(summary[0]).toMatchObject({ successCount: 2 });
    const result = queue([concept(), concept()], summary);
    expect(result.states.size).toBe(1);
    expect(result.items).toEqual([]);
  });

  it("skips a locked lesson and a concept with no published exercise", () => {
    expect(queue([concept({ lessonAvailability: "locked" })]).items).toEqual([]);
    expect(queue([concept()], [success("web.http", 30)], []).items).toEqual([]);
    expect(
      selectRevisionExercise(
        [exercise({ slug: "later", position: 2 }), exercise({ slug: "earlier", position: 1 })],
        "web.http",
        new Set(["how-the-web-delivers-a-page"]),
      )?.slug,
    ).toBe("earlier");
  });

  it("accepts a passed assessment and ignores a failed one", () => {
    const summary = summarizeSuccesses([
      {
        id: "quiz-pass",
        conceptSlug: "web.http",
        occurredAt: daysBefore(30),
        evidence: 90,
        source: "quiz",
      },
      {
        id: "quiz-fail",
        conceptSlug: "web.browser",
        occurredAt: daysBefore(30),
        evidence: 20,
        source: "quiz",
      },
    ]);
    expect(summary.map((item) => item.conceptSlug)).toEqual(["web.http"]);
  });

  it("uses the Baku calendar around a month boundary and ignores a future timestamp", () => {
    const bakuNow = new Date("2026-02-21T20:30:00.000Z");
    const successAt = new Date("2026-01-31T19:30:00.000Z");
    expect(
      revisionScheduleState({
        now: bakuNow,
        timeZone: "Asia/Baku",
        successCount: 1,
        lastSuccessAt: successAt,
      }),
    ).toBe("due");
    expect(
      revisionScheduleState({
        now,
        timeZone: "Asia/Baku",
        successCount: 1,
        lastSuccessAt: new Date("2026-06-16T00:00:00.000Z"),
      }),
    ).toBe("not_due");
  });

  it("does not change the personalized next action when a concept is due", () => {
    const mastery = [
      { conceptSlug: "web.http", score: 90, evidenceCount: 1, lastEvidenceAt: daysBefore(30) },
    ];
    const before = catalog({
      mastery,
      revisionSuccesses: [success("web.http", 1)],
      revisionExercises: [exercise()],
    });
    const after = catalog({
      mastery,
      revisionSuccesses: [success("web.http", 30)],
      revisionExercises: [exercise()],
    });
    expect(after.nextAction).toEqual(before.nextAction);
    expect(before.revision?.items).toEqual([]);
    expect(after.revision?.items.map((item) => item.name)).toEqual(["HTTP"]);
    expect(after.skill?.concepts.find((item) => item.slug === "web.http")?.state).toBe("strong");
    expect(after.skill?.concepts.find((item) => item.slug === "web.http")?.revision).toBe("due");
    expect(JSON.stringify(after.revision)).not.toContain("dueAt");
    expect(JSON.stringify(after.revision)).not.toContain("interval");
  });
});

function catalog(
  patch: {
    mastery?: CatalogContext["mastery"];
    revisionSuccesses?: ReturnType<typeof success>[];
    revisionExercises?: RevisionExercise[];
  } = {},
) {
  const modules: CatalogModuleSource[] = [
    {
      slug: "web",
      title: "Web Fundamentals",
      description: "Səhifə",
      position: 1,
      lessons: [
        {
          id: "lesson-1",
          slug: "how-the-web-delivers-a-page",
          title: "Brauzer səhifəni necə alır",
          objective: "HTTP",
          estimatedMinutes: 15,
          position: 1,
          status: "published",
          primaryConceptSlugs: ["web.http"],
          supportingConceptSlugs: [],
        },
      ],
    },
  ];
  return presentLearningCatalog({
    now,
    path: { slug: "frontend", title: "Frontend", description: "Yol", status: "published" },
    modules,
    concepts: [{ slug: "web.http", name: "HTTP", summary: "Sorğu və cavab." }],
    context: {
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
          supportingConceptSlugs: [],
          progress: null,
        },
      ],
      prerequisites: [],
      mastery: patch.mastery ?? [],
    },
    revisionSuccesses: patch.revisionSuccesses,
    revisionExercises: patch.revisionExercises,
  });
}
