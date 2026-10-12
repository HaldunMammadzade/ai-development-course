/**
 * @vitest-environment happy-dom
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LearningCatalog, TeachingOpenResponse } from "@platform/types";
import { copy } from "@/lib/copy";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

const router = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

vi.mock("@/lib/api/client", () => ({
  apiGet: api.get,
  apiPost: api.post,
}));

import { LessonExperience } from "./lesson-experience";

const catalog: LearningCatalog = {
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
          slug: "what-is-a-url",
          title: "URL nədir",
          objective: "URL.",
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
      mastery: 32,
      confidence: "low",
      band: "weak",
      reviewDue: false,
    },
  ],
  focus: { slug: "web.http", name: "HTTP", decision: "CONTINUE", reason: "baseline" },
  nextAction: {
    kind: "continue_lesson",
    sessionId: "session-1",
    lessonId: "lesson-1",
    title: "Brauzer",
  },
  activity: [],
};

const opened: TeachingOpenResponse = {
  kind: "session",
  nextAction: catalog.nextAction,
  session: {
    id: "session-1",
    lessonSlug: "how-the-web-delivers-a-page",
    lessonTitle: "Brauzer səhifəni necə alır",
    mode: "explain",
    state: "created",
    turnNumber: 0,
    completed: false,
    reviewConceptName: null,
    block: { type: "reading", position: 1, markdown: "Brauzer sorğu göndərir." },
    messages: [],
    homework: null,
    progress: [{ slug: "web.http", mastery: 32 }],
    nextAction: catalog.nextAction,
  },
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  api.get.mockReset();
  api.post.mockReset();
  api.post.mockResolvedValue(opened);
  router.push.mockReset();
  router.replace.mockReset();
  router.refresh.mockReset();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  root = null;
  container = null;
});

describe("lesson experience", () => {
  it("renders the server lesson and does not show a mastery number", async () => {
    await act(async () => {
      root?.render(
        createElement(LessonExperience, {
          slug: "how-the-web-delivers-a-page",
          catalog,
        }),
      );
    });
    const view = container;
    if (view === null) {
      throw new Error("missing view");
    }
    expect(view.querySelector("h1")?.textContent).toBe("Brauzer səhifəni necə alır");
    expect(view.textContent).toContain("HTTP sorğusunu izah etmək.");
    expect(view.textContent).toContain("Brauzer sorğu göndərir.");
    expect(view.textContent).toContain(copy.teacher.begin);
    expect(view.textContent).toContain(copy.dashboard.weakStatus);
    expect(view.textContent).toContain(copy.teacher.lockedWhy);
    expect(view.textContent).not.toContain("32");
    expect(view.innerHTML).not.toContain('href="/app/learn/what-is-a-url"');
    expect(view.textContent).not.toContain("REEXPLAIN");
    expect(api.post).toHaveBeenCalledWith("/api/v1/teaching/sessions", {});
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("follows the server lesson when the page slug is a different lesson", async () => {
    await act(async () => {
      root?.render(
        createElement(LessonExperience, {
          slug: "what-a-url-is",
          catalog,
        }),
      );
    });
    expect(api.post).toHaveBeenCalledWith("/api/v1/teaching/sessions", {});
    expect(router.replace).toHaveBeenCalledWith("/app/learn/how-the-web-delivers-a-page");
    expect(container?.textContent).not.toContain("Brauzer sorğu göndərir.");
    expect(container?.textContent).not.toContain(copy.teacher.begin);
  });

  it("does not send a second turn while the first is in flight", async () => {
    const turnUrls: string[] = [];
    api.post.mockImplementation((url: string) => {
      if (String(url).includes("/turns")) {
        turnUrls.push(String(url));
        return new Promise(() => undefined);
      }
      return Promise.resolve(opened);
    });
    await act(async () => {
      root?.render(
        createElement(LessonExperience, {
          slug: "how-the-web-delivers-a-page",
          catalog,
        }),
      );
    });
    const button = [...(container?.querySelectorAll("button") ?? [])].find(
      (item) => item.textContent === copy.teacher.begin,
    );
    if (button === undefined) {
      throw new Error("missing begin");
    }
    await act(async () => {
      button.click();
      button.click();
    });
    expect(turnUrls).toHaveLength(1);
  });

  it("retries a failed session open on the same lesson", async () => {
    api.post.mockRejectedValueOnce(new Error("Şəbəkə kəsildi"));
    await act(async () => {
      root?.render(
        createElement(LessonExperience, {
          slug: "how-the-web-delivers-a-page",
          catalog,
        }),
      );
    });
    expect(container?.textContent).toContain("Şəbəkə kəsildi");
    expect(container?.textContent).toContain(copy.retry);
    const retry = [...(container?.querySelectorAll("button") ?? [])].find(
      (item) => item.textContent === copy.retry,
    );
    if (retry === undefined) {
      throw new Error("missing retry");
    }
    await act(async () => {
      retry.click();
    });
    expect(container?.textContent).toContain("Brauzer sorğu göndərir.");
    expect(container?.textContent).not.toContain("Şəbəkə kəsildi");
  });

  it("keeps a typed answer when the lesson renders again", async () => {
    const answering: TeachingOpenResponse = {
      ...opened,
      session: {
        ...opened.session,
        state: "comprehension_check",
        block: { type: "check_question", position: 2, prompt: "Host nədir?" },
        messages: [
          {
            id: "t1",
            role: "teacher",
            speech: "Hostu ayır.",
            createdAt: "2026-10-08T00:00:00.000Z",
          },
        ],
      },
    };
    api.post.mockResolvedValue(answering);
    const props = { slug: "how-the-web-delivers-a-page", catalog };
    await act(async () => {
      root?.render(createElement(LessonExperience, props));
    });
    const field = container?.querySelector("textarea");
    if (field === null || field === undefined) {
      throw new Error("missing field");
    }
    await act(async () => {
      const prototype = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        "value",
      );
      prototype?.set?.call(field, "Host serverin adıdır");
      field.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => {
      root?.render(createElement(LessonExperience, props));
    });
    expect(container?.querySelector("textarea")?.value).toBe("Host serverin adıdır");
    const turnCalls = api.post.mock.calls.filter((call) => String(call[0]).includes("/turns"));
    expect(turnCalls).toHaveLength(0);
  });
});
