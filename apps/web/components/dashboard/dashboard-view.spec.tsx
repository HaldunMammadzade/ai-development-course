import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CurrentUser } from "@platform/types";
import { copy } from "@/lib/copy";
import { buildDashboard } from "@/lib/learning/dashboard";
import { DashboardView } from "./dashboard-view";

const user = {
  id: "user-1",
  email: "aysel@example.com",
  name: "Aysel",
  locale: "az-AZ",
  timezone: "Asia/Baku",
  emailVerified: true,
  role: "user",
  preferences: null,
  plan: null,
  enrollment: null,
  nextAction: { kind: "start_lesson", lessonId: "lesson-1", title: "Dərs" },
} as CurrentUser;

describe("dashboard view", () => {
  it("puts the next lesson first and does not paint a wall of zeros", () => {
    const model = buildDashboard({
      catalog: {
        path: { slug: "frontend", title: "Frontend", description: "Yol" },
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
        focus: { slug: "web.http", name: "HTTP", decision: "CONTINUE", reason: "baseline" },
        nextAction: {
          kind: "start_lesson",
          lessonId: "lesson-1",
          title: "Brauzer səhifəni necə alır",
        },
        activity: [],
      },
      homework: { homework: [] },
      projects: [],
      projectDetail: null,
    });
    const html = renderToStaticMarkup(createElement(DashboardView, { user, model }));
    const heading = html.indexOf("Brauzer səhifəni necə alır");
    const homework = html.indexOf(copy.dashboard.homework);
    expect(heading).toBeGreaterThan(-1);
    expect(heading).toBeLessThan(homework);
    expect(html).toContain('href="/app/learn/how-the-web-delivers-a-page"');
    expect(html).toContain(copy.dashboard.teacherLine);
    expect(html).toContain(copy.dashboard.more);
    expect(html).toContain("bg-primary");
    expect(html).not.toContain("lg:grid-cols-");
    expect(html).not.toContain(copy.dashboard.skillEmpty);
    expect(html).not.toContain(copy.progress.states.weak);
    expect(html).not.toContain(copy.projects.empty);
    expect(html).not.toContain('id="project-heading"');
    expect(html).toContain("0 / 1");
    expect(html).not.toContain('aria-label="HTTP"');
    expect(html).not.toContain("#");
    expect(html).not.toContain("seriya");
  });

  it("renders the review action for the current lesson and keeps a finished path separate", () => {
    const review = buildDashboard({
      catalog: {
        path: { slug: "frontend", title: "Frontend", description: "Yol" },
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
                slug: "what-a-url-is",
                title: "URL nədir",
                objective: "URL.",
                estimatedMinutes: 12,
                availability: "locked",
              },
            ],
          },
        ],
        concepts: [],
        focus: null,
        nextAction: {
          kind: "review_concept",
          conceptSlug: "web.http",
          lessonId: "lesson-1",
          title: "Brauzer səhifəni necə alır",
        },
        activity: [],
      },
      homework: { homework: [] },
      projects: [],
      projectDetail: null,
    });
    const reviewHtml = renderToStaticMarkup(createElement(DashboardView, { user, model: review }));
    expect(reviewHtml).toContain(copy.dashboard.review);
    expect(reviewHtml).toContain(copy.actions.review_concept);
    expect(reviewHtml).toContain('href="/app/learn/how-the-web-delivers-a-page"');
    expect(reviewHtml).not.toContain('href="/app/learn/what-a-url-is"');
    expect(reviewHtml).not.toContain(copy.dashboard.pathComplete);

    const finished = buildDashboard({
      catalog: {
        path: { slug: "frontend", title: "Frontend", description: "Yol" },
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
        concepts: [],
        focus: null,
        nextAction: { kind: "path_complete" },
        activity: [],
      },
      homework: { homework: [] },
      projects: [],
      projectDetail: null,
    });
    const finishedHtml = renderToStaticMarkup(
      createElement(DashboardView, { user, model: finished }),
    );
    expect(finishedHtml).toContain(copy.dashboard.pathComplete);
    expect(finishedHtml).not.toContain(copy.actions.review_concept);
    expect(finishedHtml).not.toContain('href="/app/learn/');
  });

  it("shows the server path instead of a full lesson count", () => {
    const model = buildDashboard({
      catalog: {
        path: { slug: "frontend", title: "Frontend", description: "Yol" },
        modules: [
          {
            slug: "javascript",
            title: "JavaScript",
            description: "Dil",
            lessons: [
              {
                slug: "js-variables",
                title: "Dəyişənlər",
                objective: "Dəyişən",
                estimatedMinutes: 12,
                availability: "completed",
              },
              {
                slug: "js-arrays",
                title: "Massivlər",
                objective: "Massiv",
                estimatedMinutes: 12,
                availability: "current",
              },
            ],
          },
        ],
        concepts: [],
        focus: null,
        nextAction: { kind: "start_lesson", lessonId: "js-arrays", title: "Massivlər" },
        activity: [],
        personalized: {
          note: null,
          current: { slug: "js-arrays", title: "Massivlər", moduleTitle: "JavaScript" },
          next: [{ slug: "js-objects", title: "Obyektlər", moduleTitle: "JavaScript" }],
          concepts: [
            { slug: "js.variable", name: "Dəyişən", mark: "known" },
            { slug: "js.array", name: "Massiv", mark: "current" },
          ],
          known: ["Dəyişən"],
        },
      },
      homework: { homework: [] },
      projects: [],
      projectDetail: null,
    });
    const html = renderToStaticMarkup(createElement(DashboardView, { user, model }));
    expect(html).toContain("Massivlər");
    expect(html).toContain("Artıq bilir");
    expect(html).toContain('aria-current="step"');
    expect(html).not.toContain("1 / 2");
    expect(html).not.toContain("js.variable");
  });

  it("features revision and keeps the project as a later link", () => {
    const model = buildDashboard({
      catalog: {
        path: { slug: "frontend", title: "Frontend", description: "Yol" },
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
            ],
          },
        ],
        concepts: [],
        focus: null,
        nextAction: {
          kind: "start_lesson",
          lessonId: "lesson-1",
          title: "Brauzer səhifəni necə alır",
        },
        activity: [],
        revision: {
          status: "ready",
          items: [
            {
              slug: "web.http",
              name: "HTTP",
              lessonSlug: "how-the-web-delivers-a-page",
              lessonTitle: "Brauzer səhifəni necə alır",
              state: "due",
            },
          ],
        },
      },
      homework: {
        homework: [
          {
            id: "hw-1",
            prompt: "Yaz",
            status: "assigned",
            dueAt: "2026-10-10T12:00:00.000Z",
            completedAt: null,
            lessonSlug: "how-the-web-delivers-a-page",
            lessonTitle: "Ev işi",
            title: "Ev işi",
          },
        ],
      },
      projects: [
        {
          slug: "taskflow",
          title: "TaskFlow",
          description: "Layihə",
          difficulty: "beginner",
          estimatedMinutes: 90,
          completed: false,
          passedMilestones: 1,
          totalMilestones: 4,
          band: "FOUNDATION",
        },
      ],
      projectDetail: null,
    });
    const html = renderToStaticMarkup(createElement(DashboardView, { user, model }));
    const revision = html.indexOf(copy.dashboard.revisionTitle);
    const more = html.indexOf(copy.dashboard.more);
    const project = html.indexOf("TaskFlow");
    expect(revision).toBeGreaterThan(-1);
    expect(more).toBeGreaterThan(revision);
    expect(project).toBeGreaterThan(more);
    expect(html).toContain("lg:grid-cols-");
    expect(html).toContain(copy.revision.states.due);
    expect(html).not.toContain('id="project-heading"');
  });
});
