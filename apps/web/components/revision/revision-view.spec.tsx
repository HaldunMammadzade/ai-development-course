import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CurrentUser, RevisionQueue, SkillGraph } from "@platform/types";
import { copy } from "@/lib/copy";
import { buildDashboard } from "@/lib/learning/dashboard";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { SkillMap } from "@/components/progress/skill-map";
import RevisionLoading from "@/app/app/(study)/revision/loading";
import { LoadError } from "@/components/ui/load-error";
import { RevisionView } from "./revision-view";

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

describe("revision view", () => {
  it("shows the empty, waiting, and overdue states without a score", () => {
    const empty = renderToStaticMarkup(
      createElement(RevisionView, { queue: { status: "empty", items: [] } }),
    );
    expect(empty).toContain(copy.revision.empty);
    expect(empty).not.toContain(copy.revision.today);

    const waiting = renderToStaticMarkup(
      createElement(RevisionView, { queue: { status: "waiting", items: [] } }),
    );
    expect(waiting).toContain(copy.revision.waiting);

    const ready = renderToStaticMarkup(
      createElement(RevisionView, {
        queue: {
          status: "ready",
          items: [
            {
              slug: "css.flex",
              name: "Flexbox",
              lessonSlug: "flexbox",
              lessonTitle: "Flexbox",
              state: "overdue",
            },
          ],
        },
      }),
    );
    expect(ready).toContain(copy.revision.states.overdue);
    expect(ready).toContain(copy.revision.ready(1));
    expect(ready).toContain('href="/app/learn/flexbox"');
    expect(ready).toContain("min-h-11");
    expect(ready).not.toContain("css.flex");
    expect(ready).not.toContain("dueAt");
    expect(ready).not.toContain("%");
  });

  it("adds a secondary sentence on the skill map and a dashboard card", () => {
    const graph: SkillGraph = {
      focus: null,
      modules: [
        {
          slug: "css",
          title: "CSS",
          conceptSlugs: ["css.flex"],
          counts: { total: 1, unknown: 0, weak: 0, developing: 0, strong: 1 },
        },
      ],
      concepts: [
        {
          slug: "css.flex",
          name: "Flexbox",
          summary: "Ox boyu düzülüş.",
          moduleSlug: "css",
          moduleTitle: "CSS",
          lessonSlug: "flexbox",
          lessonTitle: "Flexbox",
          lessonAvailability: "completed",
          state: "strong",
          prerequisites: [],
          dependents: [],
          evidenceSource: "exercise",
          revision: "due",
        },
      ],
    };
    const map = renderToStaticMarkup(createElement(SkillMap, { graph }));
    expect(map).toContain(copy.progress.states.strong);
    expect(map).toContain(copy.revision.states.due);

    const queue: RevisionQueue = {
      status: "ready",
      items: [
        {
          slug: "css.flex",
          name: "Flexbox",
          lessonSlug: "flexbox",
          lessonTitle: "Flexbox",
          state: "due",
        },
      ],
    };
    const model = buildDashboard({
      catalog: {
        path: { slug: "frontend", title: "Frontend", description: "Yol" },
        modules: [
          {
            slug: "css",
            title: "CSS",
            description: "Stil",
            lessons: [
              {
                slug: "flexbox",
                title: "Flexbox",
                objective: "Düzülüş",
                estimatedMinutes: 12,
                availability: "current",
              },
            ],
          },
        ],
        concepts: [],
        focus: null,
        nextAction: { kind: "start_lesson", lessonId: "lesson-1", title: "Flexbox" },
        activity: [],
        revision: queue,
      },
      homework: { homework: [] },
      projects: [],
      projectDetail: null,
    });
    const html = renderToStaticMarkup(createElement(DashboardView, { user, model }));
    const lesson = html.indexOf('href="/app/learn/flexbox"');
    const revision = html.indexOf('href="/app/revision"');
    expect(lesson).toBeGreaterThan(-1);
    expect(revision).toBeGreaterThan(lesson);
    expect(html).toContain("Flexbox");
    expect(html).toContain(copy.revision.ready(1));
  });

  it("exposes a loading state and the existing error state", () => {
    const loading = renderToStaticMarkup(createElement(RevisionLoading));
    expect(loading).toContain('aria-busy="true"');
    const error = renderToStaticMarkup(createElement(LoadError, { message: copy.errors.generic }));
    expect(error).toContain(copy.errors.generic);
  });
});
