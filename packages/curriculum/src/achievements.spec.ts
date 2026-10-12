import { describe, expect, it } from "vitest";
import { buildAchievements, type AchievementFacts } from "./achievements";
import type { RevisionEvent } from "./revision";

const at = (iso: string): Date => new Date(iso);

function facts(overrides: Partial<AchievementFacts> = {}): AchievementFacts {
  return {
    modules: [],
    events: [],
    assessment: null,
    projects: [],
    passes: [],
    interviewPublished: false,
    interviewCompletedAt: null,
    ...overrides,
  };
}

function event(
  partial: Partial<RevisionEvent> & Pick<RevisionEvent, "id" | "source">,
): RevisionEvent {
  return {
    conceptSlug: "web.http",
    occurredAt: at("2026-10-01T08:00:00.000Z"),
    evidence: 90,
    ...partial,
  };
}

describe("achievements", () => {
  it("keeps a new learner locked and omits milestones the curriculum does not publish", () => {
    const list = buildAchievements(facts());
    expect(list.earnedCount).toBe(0);
    expect(list.latest).toBeNull();
    expect(list.items.map((item) => item.id)).toEqual([
      "first-revision",
      "skill-map",
      "first-exercise",
    ]);
    expect(list.items.every((item) => item.state === "locked" && item.earnedAt === null)).toBe(
      true,
    );
  });

  it("earns the first lesson from published completion and ignores a draft", () => {
    const list = buildAchievements(
      facts({
        modules: [
          {
            slug: "html",
            position: 2,
            lessons: [
              {
                status: "draft",
                progress: "completed",
                completedAt: at("2026-01-01T00:00:00.000Z"),
              },
              {
                status: "published",
                progress: "completed",
                completedAt: at("2026-10-02T00:00:00.000Z"),
              },
              { status: "published", progress: "in_progress", completedAt: null },
            ],
          },
        ],
      }),
    );
    const first = list.items.find((item) => item.id === "first-lesson");
    const html = list.items.find((item) => item.id === "html-foundations");
    expect(first).toMatchObject({
      state: "earned",
      earnedAt: "2026-10-02T00:00:00.000Z",
    });
    expect(html).toMatchObject({ state: "locked", earnedAt: null });
  });

  it("earns a module only when every published lesson is completed", () => {
    const completed = at("2026-10-08T12:00:00.000Z");
    const earlier = at("2026-10-03T12:00:00.000Z");
    const list = buildAchievements(
      facts({
        modules: [
          {
            slug: "css",
            position: 3,
            lessons: [
              { status: "published", progress: "completed", completedAt: earlier },
              { status: "published", progress: "completed", completedAt: completed },
              { status: "draft", progress: null, completedAt: null },
            ],
          },
          {
            slug: "not-a-milestone",
            position: 9,
            lessons: [{ status: "published", progress: "completed", completedAt: completed }],
          },
        ],
      }),
    );
    expect(list.items.find((item) => item.id === "css-foundations")).toMatchObject({
      state: "earned",
      earnedAt: completed.toISOString(),
      title: "CSS əsasları",
    });
    expect(list.items.some((item) => item.id.includes("not-a-milestone"))).toBe(false);
  });

  it("does not earn the skill map when assessment is skipped", () => {
    const skipped = buildAchievements(
      facts({ assessment: { status: "skipped", completedAt: at("2026-10-08T00:00:00.000Z") } }),
    );
    expect(skipped.items.find((item) => item.id === "skill-map")).toMatchObject({
      state: "locked",
      earnedAt: null,
    });
    const done = buildAchievements(
      facts({ assessment: { status: "completed", completedAt: at("2026-10-08T00:00:00.000Z") } }),
    );
    expect(done.items.find((item) => item.id === "skill-map")).toMatchObject({
      state: "earned",
      earnedAt: "2026-10-08T00:00:00.000Z",
    });
    expect(done.latest?.id).toBe("skill-map");
  });

  it("earns the first exercise from a pass and the first revision from a second success", () => {
    const once = buildAchievements(
      facts({
        events: [
          event({
            id: "e1",
            source: "exercise",
            evidence: 70,
            occurredAt: at("2026-10-04T00:00:00.000Z"),
          }),
        ],
      }),
    );
    expect(once.items.find((item) => item.id === "first-exercise")).toMatchObject({
      state: "earned",
      earnedAt: "2026-10-04T00:00:00.000Z",
    });
    expect(once.items.find((item) => item.id === "first-revision")?.state).toBe("locked");

    const twice = buildAchievements(
      facts({
        events: [
          event({ id: "e1", source: "exercise", occurredAt: at("2026-10-04T00:00:00.000Z") }),
          event({ id: "e1", source: "exercise", occurredAt: at("2026-10-09T00:00:00.000Z") }),
          event({ id: "e2", source: "exercise", occurredAt: at("2026-10-06T00:00:00.000Z") }),
          event({
            id: "speak",
            source: "speaking",
            evidence: 40,
            occurredAt: at("2026-10-01T00:00:00.000Z"),
          }),
        ],
      }),
    );
    expect(twice.items.find((item) => item.id === "first-exercise")?.earnedAt).toBe(
      "2026-10-04T00:00:00.000Z",
    );
    expect(twice.items.find((item) => item.id === "first-revision")).toMatchObject({
      state: "earned",
      earnedAt: "2026-10-06T00:00:00.000Z",
    });
    expect(twice.latest?.id).toBe("first-revision");
    const forward = [
      event({ id: "e1", source: "exercise", occurredAt: at("2026-10-04T00:00:00.000Z") }),
      event({ id: "e2", source: "exercise", occurredAt: at("2026-10-06T00:00:00.000Z") }),
    ];
    expect(buildAchievements(facts({ events: forward }))).toEqual(
      buildAchievements(facts({ events: [...forward].reverse() })),
    );
  });

  it("earns the first project only when every milestone of a published project has passed", () => {
    const open = buildAchievements(
      facts({
        projects: [{ slug: "personal-portfolio", milestoneIds: ["a", "b"] }],
        passes: [{ milestoneId: "a", passedAt: at("2026-10-01T00:00:00.000Z") }],
      }),
    );
    expect(open.items.find((item) => item.id === "first-project")).toMatchObject({
      state: "locked",
    });
    const done = buildAchievements(
      facts({
        projects: [
          { slug: "personal-portfolio", milestoneIds: ["a", "b"] },
          { slug: "taskflow", milestoneIds: ["c"] },
        ],
        passes: [
          { milestoneId: "a", passedAt: at("2026-10-01T00:00:00.000Z") },
          { milestoneId: "b", passedAt: at("2026-10-05T00:00:00.000Z") },
          { milestoneId: "c", passedAt: at("2026-10-02T00:00:00.000Z") },
        ],
      }),
    );
    expect(done.items.find((item) => item.id === "first-project")).toMatchObject({
      state: "earned",
      earnedAt: "2026-10-02T00:00:00.000Z",
    });
  });

  it("earns the first interview only from a completed session", () => {
    const locked = buildAchievements(facts({ interviewPublished: true }));
    expect(locked.items.find((item) => item.id === "first-interview")).toMatchObject({
      state: "locked",
    });
    const earned = buildAchievements(
      facts({
        interviewPublished: true,
        interviewCompletedAt: at("2026-10-07T00:00:00.000Z"),
      }),
    );
    expect(earned.items.find((item) => item.id === "first-interview")).toMatchObject({
      state: "earned",
      earnedAt: "2026-10-07T00:00:00.000Z",
    });
  });
});
