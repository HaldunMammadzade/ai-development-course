import { describe, expect, it } from "vitest";
import type { LearningCatalog, ProjectDetail, ProjectSummary } from "@platform/types";
import { copy } from "@/lib/copy";
import { buildDashboard } from "./dashboard";

function catalog(patch: Partial<LearningCatalog> = {}): LearningCatalog {
  return {
    path: {
      slug: "frontend",
      title: "Frontend",
      description: "Frontend yolu",
    },
    modules: [
      {
        slug: "web",
        title: "Web Fundamentals",
        description: "Səhifə",
        lessons: [
          {
            slug: "how-the-web-delivers-a-page",
            title: "Brauzer səhifəni necə alır",
            objective: "HTTP sorğusunu izah etmək.",
            estimatedMinutes: 15,
            availability: "current",
          },
          {
            slug: "what-is-a-url",
            title: "URL nədir",
            objective: "URL hissələrini tanımaq.",
            estimatedMinutes: 12,
            availability: "locked",
          },
        ],
      },
    ],
    concepts: [
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
    ],
    focus: {
      slug: "web.http",
      name: "HTTP",
      decision: "CONTINUE",
      reason: "baseline",
    },
    nextAction: {
      kind: "start_lesson",
      lessonId: "lesson-1",
      title: "Brauzer səhifəni necə alır",
    },
    activity: [],
    ...patch,
  };
}

describe("dashboard model", () => {
  it("starts a new student on the server's next lesson and hides empty metrics", () => {
    const model = buildDashboard({
      catalog: catalog(),
      homework: { homework: [] },
      projects: [],
      projectDetail: null,
    });

    expect(model.hero).toMatchObject({
      eyebrow: copy.dashboard.startHere,
      title: "Brauzer səhifəni necə alır",
      href: "/app/learn/how-the-web-delivers-a-page",
      action: copy.actions.start_lesson,
      minutes: 15,
    });
    expect(model.focus).toBeNull();
    expect(model.path).toMatchObject({ completed: 0, total: 2, moduleTitle: "Web Fundamentals" });
    expect(model.weak).toEqual([]);
    expect(model.homework).toEqual({ status: "ready", items: [] });
    expect(model.project).toEqual({ status: "ready", item: null });
    expect(model.snapshot).toBeNull();
    expect(model.activity).toEqual([]);
    const withoutActivity = catalog();
    delete (withoutActivity as { activity?: unknown }).activity;
    expect(
      buildDashboard({
        catalog: withoutActivity,
        homework: { homework: [] },
        projects: [],
        projectDetail: null,
      }).activity,
    ).toEqual([]);
    expect(model).not.toHaveProperty("streak");
    expect(model).not.toHaveProperty("achievements");
    expect(JSON.stringify(model)).not.toContain("0%");
  });

  it("keeps homework, weak concepts, project progress, and activity on real records", () => {
    const projects: ProjectSummary[] = [
      {
        slug: "personal-portfolio",
        title: "Portfolio",
        description: "Səhifə",
        difficulty: "beginner",
        estimatedMinutes: 90,
        completed: false,
        passedMilestones: 1,
        totalMilestones: 4,
        band: "FOUNDATION",
      },
    ];
    const detail = {
      slug: "personal-portfolio",
      milestones: [
        { slug: "base", position: 1, title: "Əsas", status: "passed", workflow: "PASSED" },
        { slug: "form", position: 2, title: "Forma", status: "current", workflow: "TODO" },
      ],
    } as ProjectDetail;
    const model = buildDashboard({
      catalog: catalog({
        modules: [
          {
            slug: "web",
            title: "Web Fundamentals",
            description: "Səhifə",
            lessons: [
              {
                slug: "how-the-web-delivers-a-page",
                title: "Brauzer səhifəni necə alır",
                objective: "HTTP sorğusunu izah etmək.",
                estimatedMinutes: 15,
                availability: "completed",
              },
              {
                slug: "what-is-a-url",
                title: "URL nədir",
                objective: "URL hissələrini tanımaq.",
                estimatedMinutes: 12,
                availability: "current",
              },
            ],
          },
        ],
        concepts: [
          {
            slug: "web.http",
            name: "HTTP",
            moduleTitle: "Web Fundamentals",
            lessonSlug: "how-the-web-delivers-a-page",
            mastery: 30,
            confidence: "medium",
            band: "weak",
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
        ],
        focus: {
          slug: "web.http",
          name: "HTTP",
          decision: "REEXPLAIN",
          reason: "repeated_failure",
        },
        nextAction: {
          kind: "continue_lesson",
          sessionId: "session-1",
          lessonId: "lesson-2",
          title: "URL nədir",
        },
        activity: [
          {
            id: "event-1",
            source: "exercise",
            conceptName: "HTTP",
            createdAt: "2026-06-01T12:00:00.000Z",
          },
        ],
      }),
      homework: {
        homework: [
          {
            id: "hw-1",
            prompt: "Sorğunu yaz.",
            status: "assigned",
            dueAt: "2026-06-02T00:00:00.000Z",
            completedAt: null,
            lessonSlug: "how-the-web-delivers-a-page",
            lessonTitle: "Brauzer səhifəni necə alır",
            title: "Ev",
          },
        ],
      },
      projects,
      projectDetail: detail,
    });

    expect(model.hero.href).toBe("/app/learn/what-is-a-url");
    expect(model.hero.action).toBe(copy.actions.continue_lesson);
    expect(model.focus).toMatchObject({
      name: "HTTP",
      body: copy.adaptive.repeated_failure,
      href: "/app/learn/how-the-web-delivers-a-page",
    });
    expect(model.path).toMatchObject({ completed: 1, total: 2 });
    expect(model.weak).toEqual([
      {
        slug: "web.http",
        name: "HTTP",
        status: copy.dashboard.weakStatus,
        href: "/app/learn/how-the-web-delivers-a-page",
      },
    ]);
    expect(JSON.stringify(model.weak)).not.toContain("medium");
    expect(model.homework).toMatchObject({
      status: "ready",
      items: [{ id: "hw-1", title: "Brauzer səhifəni necə alır" }],
    });
    expect(model.project).toMatchObject({
      status: "ready",
      item: {
        title: "Portfolio",
        passed: 1,
        total: 4,
        milestoneTitle: "Forma",
        milestonePosition: 2,
      },
    });
    expect(model.snapshot).toBeNull();
    expect(JSON.stringify(model)).not.toContain("30");
    expect(model.activity).toEqual([
      {
        id: "event-1",
        label: copy.dashboard.activitySource.exercise,
        conceptName: "HTTP",
        createdAt: "2026-06-01T12:00:00.000Z",
      },
    ]);
  });

  it("sends a due homework action to homework and keeps a failed section visible", () => {
    const model = buildDashboard({
      catalog: catalog({
        nextAction: {
          kind: "do_homework",
          homeworkId: "hw-1",
          lessonId: "lesson-1",
          title: "Brauzer səhifəni necə alır",
        },
      }),
      homework: {
        homework: [
          {
            id: "hw-1",
            prompt: "Sorğunu yaz.",
            status: "assigned",
            dueAt: "2026-06-02T00:00:00.000Z",
            completedAt: null,
            lessonSlug: "how-the-web-delivers-a-page",
            lessonTitle: "Brauzer səhifəni necə alır",
            title: "Ev",
          },
        ],
      },
      projects: copy.errors.generic,
      projectDetail: null,
    });

    expect(model.hero).toMatchObject({
      href: "/app/homework",
      title: "Brauzer səhifəni necə alır",
      description: "Sorğunu yaz.",
      action: copy.actions.do_homework,
    });
    expect(model.project).toEqual({ status: "error", message: copy.errors.generic });
  });

  it("keeps a locked weak lesson closed and snapshots only real states", () => {
    const locked = buildDashboard({
      catalog: catalog({
        concepts: [
          {
            slug: "web.url",
            name: "URL",
            moduleTitle: "Web Fundamentals",
            lessonSlug: "what-is-a-url",
            mastery: 20,
            confidence: "low",
            band: "weak",
            reviewDue: false,
          },
        ],
      }),
      homework: { homework: [] },
      projects: [],
      projectDetail: null,
    });
    expect(locked.weak).toEqual([
      {
        slug: "web.url",
        name: "URL",
        status: copy.progress.states.weak,
        href: null,
      },
    ]);

    const model = buildDashboard({
      catalog: catalog({
        skill: {
          focus: {
            moduleTitle: "Web Fundamentals",
            lessonTitle: "Brauzer səhifəni necə alır",
            concepts: [],
          },
          modules: [],
          concepts: [
            {
              slug: "web.http",
              name: "HTTP",
              summary: "Brauzer serverə sorğu göndərir.",
              moduleSlug: "web",
              moduleTitle: "Web Fundamentals",
              lessonSlug: "how-the-web-delivers-a-page",
              lessonTitle: "Brauzer səhifəni necə alır",
              lessonAvailability: "completed",
              state: "weak",
              prerequisites: [],
              dependents: [],
              evidenceSource: "exercise",
              revision: null,
            },
            {
              slug: "web.url",
              name: "URL",
              summary: "",
              moduleSlug: "web",
              moduleTitle: "Web Fundamentals",
              lessonSlug: "what-is-a-url",
              lessonTitle: "URL nədir",
              lessonAvailability: "locked",
              state: "unknown",
              prerequisites: [],
              dependents: [],
              evidenceSource: null,
              revision: null,
            },
          ],
        },
      }),
      homework: { homework: [] },
      projects: [],
      projectDetail: null,
    });
    expect(model.snapshot).toEqual({
      moduleTitle: "Web Fundamentals",
      weak: ["HTTP"],
      strong: [],
      unknown: 1,
    });
    expect(JSON.stringify(model.snapshot)).not.toContain("%");
    expect(JSON.stringify(model.snapshot)).not.toContain("mastery");
  });

  it("links a review action to the current lesson from the server", () => {
    const model = buildDashboard({
      catalog: catalog({
        nextAction: {
          kind: "review_concept",
          conceptSlug: "web.http",
          lessonId: "lesson-1",
          title: "Brauzer səhifəni necə alır",
        },
      }),
      homework: { homework: [] },
      projects: [],
      projectDetail: null,
    });

    expect(model.hero).toMatchObject({
      eyebrow: copy.dashboard.review,
      title: "Brauzer səhifəni necə alır",
      href: "/app/learn/how-the-web-delivers-a-page",
      action: copy.actions.review_concept,
    });
    expect(model.hero.title).not.toBe(copy.dashboard.pathComplete);
  });

  it("does not turn an incomplete review action into a finished path", () => {
    const model = buildDashboard({
      catalog: catalog({
        modules: [
          {
            slug: "web",
            title: "Web Fundamentals",
            description: "Səhifə",
            lessons: [
              {
                slug: "how-the-web-delivers-a-page",
                title: "Brauzer səhifəni necə alır",
                objective: "HTTP sorğusunu izah etmək.",
                estimatedMinutes: 15,
                availability: "locked",
              },
            ],
          },
        ],
        concepts: [
          {
            slug: "web.http",
            name: "HTTP",
            moduleTitle: "Web Fundamentals",
            lessonSlug: "how-the-web-delivers-a-page",
            mastery: 59,
            confidence: "medium",
            band: "fragile",
            reviewDue: false,
          },
        ],
        nextAction: {
          kind: "review_concept",
          conceptSlug: "web.http",
          lessonId: "missing",
        } as LearningCatalog["nextAction"],
      }),
      homework: { homework: [] },
      projects: [],
      projectDetail: null,
    });

    expect(model.hero.title).toBe(copy.actions.review_concept);
    expect(model.hero.title).not.toBe(copy.dashboard.pathComplete);
    expect(model.hero.href).toBeNull();
  });

  it("keeps the completion state for a finished path", () => {
    const model = buildDashboard({
      catalog: catalog({
        modules: [
          {
            slug: "web",
            title: "Web Fundamentals",
            description: "Səhifə",
            lessons: [
              {
                slug: "how-the-web-delivers-a-page",
                title: "Brauzer səhifəni necə alır",
                objective: "HTTP sorğusunu izah etmək.",
                estimatedMinutes: 15,
                availability: "completed",
              },
            ],
          },
        ],
        nextAction: { kind: "path_complete" },
      }),
      homework: { homework: [] },
      projects: [],
      projectDetail: null,
    });

    expect(model.hero.title).toBe(copy.dashboard.pathComplete);
    expect(model.hero.href).toBeNull();
    expect(model.hero.action).toBe(copy.actions.path_complete);
  });
});
