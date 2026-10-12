import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LearningCatalog, TeachingSessionView } from "@platform/types";
import { copy } from "@/lib/copy";
import { buildLessonWorkspace } from "@/lib/teaching/workspace";
import { LessonWorkspace } from "./lesson-workspace";

function catalog(): LearningCatalog {
  return {
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
          {
            slug: "what-is-a-url",
            title: "URL nədir",
            objective: "URL hissələrini tanımaq.",
            estimatedMinutes: 12,
            availability: "current",
          },
          {
            slug: "html-next",
            title: "Növbəti",
            objective: "Sonra.",
            estimatedMinutes: 10,
            availability: "locked",
          },
        ],
      },
    ],
    concepts: [],
    focus: null,
    nextAction: { kind: "continue_lesson", sessionId: "s", lessonId: "l", title: "URL nədir" },
    activity: [],
  };
}

function session(): TeachingSessionView {
  return {
    id: "session-1",
    lessonSlug: "what-is-a-url",
    lessonTitle: "URL nədir",
    mode: "explain",
    state: "comprehension_check",
    turnNumber: 2,
    completed: false,
    reviewConceptName: null,
    block: { type: "check_question", position: 2, prompt: "Host nədir?" },
    messages: [
      { id: "t1", role: "teacher", speech: "Hostu ayır.", createdAt: "2026-10-08T00:00:00.000Z" },
    ],
    homework: null,
    progress: [],
    nextAction: { kind: "continue_lesson", sessionId: "s", lessonId: "l", title: "URL nədir" },
  };
}

describe("lesson workspace markup", () => {
  it("keeps the question and the next action in the main column", () => {
    const model = buildLessonWorkspace({
      slug: "what-is-a-url",
      catalog: catalog(),
      session: session(),
      phase: "ready",
      pending: false,
      hasError: false,
      adaptive: "HINT",
      notice: [],
    });
    const html = renderToStaticMarkup(
      createElement(
        LessonWorkspace,
        {
          model,
          phase: "ready",
          pending: false,
          error: null,
          onAdvance: () => undefined,
          onRestart: () => undefined,
          composer: createElement("button", { type: "button" }, copy.teacher.send),
        },
        createElement("p", null, "Məşq yeri"),
      ),
    );

    expect(html.indexOf("Host nədir?")).toBeLessThan(html.indexOf("Hostu ayır."));
    expect(html.indexOf("Hostu ayır.")).toBeLessThan(html.indexOf(copy.teacher.send));
    expect(html.indexOf(copy.teacher.send)).toBeLessThan(html.indexOf("Məşq yeri"));
    expect(html).toContain(copy.teacher.adaptiveCue.HINT);
    expect(html).not.toContain("HINT");
    expect(html).toContain("xl:grid-cols-[minmax(0,1fr)_22.5rem]");
    expect(html).toContain("xl:hidden");
    expect(html).toContain("xl:sticky");
    expect(html).not.toContain(copy.teacher.openTeacher);
    expect(html).not.toContain('role="dialog"');
    expect(html).toContain(copy.teacher.lockedWhy);
    expect(html).not.toContain('href="/app/learn/html-next"');
    expect(html).not.toContain('href="/app/learn/what-is-a-url"');
    expect(html).toContain('id="lesson-objective"');
    expect(html).toContain("min-h-11");
    expect(html).not.toContain("32%");
    expect(html).not.toContain("seriya");
    expect(html).not.toContain("skeleton");
  });

  it("shows the current turn in the column and keeps earlier turns folded", () => {
    const model = buildLessonWorkspace({
      slug: "what-is-a-url",
      catalog: catalog(),
      session: session(),
      phase: "ready",
      pending: false,
      hasError: false,
      adaptive: null,
      notice: [],
    });
    const withHistory = {
      ...model,
      teacherMessages: ["Əvvəlki izah.", "Hostu ayır."],
    };
    const html = renderToStaticMarkup(
      createElement(LessonWorkspace, {
        model: withHistory,
        phase: "ready",
        pending: false,
        error: null,
        onAdvance: () => undefined,
        onRestart: () => undefined,
        composer: createElement("button", { type: "button" }, copy.teacher.send),
      }),
    );
    const inline = html.slice(html.indexOf('id="teacher-inline"'), html.indexOf(copy.teacher.send));
    expect(inline).toContain("Hostu ayır.");
    expect(inline).toContain("<details");
    expect(inline.indexOf("<details")).toBeLessThan(inline.indexOf("Əvvəlki izah."));
    expect(inline.indexOf("Hostu ayır.")).toBeLessThan(inline.indexOf("<details"));
    expect(html).toContain("xl:sticky");
  });

  it("keeps the catalog title and one teacher status while the session opens", () => {
    const model = buildLessonWorkspace({
      slug: "what-is-a-url",
      catalog: catalog(),
      session: null,
      phase: "loading",
      pending: false,
      hasError: false,
      adaptive: null,
      notice: [],
    });
    const html = renderToStaticMarkup(
      createElement(LessonWorkspace, {
        model,
        phase: "loading",
        pending: false,
        error: null,
        onAdvance: () => undefined,
        onRestart: () => undefined,
        composer: null,
      }),
    );
    expect(html).toContain("URL nədir");
    expect(html).toContain(copy.teacher.thinking);
    expect(html).not.toContain("skeleton");
    expect(html).not.toContain('aria-busy="true"');
  });

  it("shows the retry control when the session fails", () => {
    const model = buildLessonWorkspace({
      slug: "what-is-a-url",
      catalog: catalog(),
      session: null,
      phase: "error",
      pending: false,
      hasError: true,
      adaptive: null,
      notice: [],
    });
    const html = renderToStaticMarkup(
      createElement(LessonWorkspace, {
        model,
        phase: "error",
        pending: false,
        error: copy.errors.ai,
        onAdvance: () => undefined,
        onRestart: () => undefined,
        composer: null,
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(copy.errors.ai);
    expect(html).toContain(copy.retry);
  });
});
