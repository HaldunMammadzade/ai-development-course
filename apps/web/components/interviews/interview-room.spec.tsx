/**
 * @vitest-environment happy-dom
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InterviewSessionView } from "@platform/types";
import { ApiError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";

const api = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiPost: api.post,
}));

vi.mock("@/lib/teaching/turn-id", () => ({
  createClientTurnId: () => "answer-1",
}));

vi.mock("@/components/exercises/coding-editor", () => ({
  CodingEditor: () => createElement("div", { "data-editor": "monaco" }),
}));

import { InterviewRoom } from "./interview-room";

const session: InterviewSessionView = {
  id: "session-1",
  interviewSlug: "frontend-foundation",
  interviewTitle: "Frontend Developer Interview — Foundation",
  status: "active",
  speech: "<img src=x onerror=alert(1)>",
  question: {
    title: "İstiləşmə",
    prompt: "Brauzer bir səhifəni necə istəyir?",
    type: "verbal",
    position: 1,
    total: 10,
    followUp: false,
    starterCode: null,
  },
  report: null,
};

describe("interview room", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    api.post.mockReset();
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it("submits an answer and keeps interviewer markup as text", async () => {
    await render(host, root, session);
    expect(host.querySelector("img")).toBeNull();
    expect(host.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(host.textContent).toContain(copy.interviews.interviewerNote);
    await typeAnswer(host, "Brauzer HTTP sorğusu göndərir və gələn HTML-i göstərir.");
    api.post.mockResolvedValue({
      session: {
        ...session,
        speech: "Əsas fikir görünür.",
        question: { ...session.question, title: "HTML element", position: 2 },
      },
    });
    await click(host, copy.interviews.submit);
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/interview-sessions/session-1/answers",
      expect.objectContaining({
        clientAnswerId: "answer-1",
        text: "Brauzer HTTP sorğusu göndərir və gələn HTML-i göstərir.",
      }),
    );
    const body = JSON.stringify(api.post.mock.calls[0]?.[1]);
    expect(body).not.toContain("score");
    expect(host.textContent).toContain("HTML element");
  });

  it("keeps the current question when the interviewer is unavailable", async () => {
    await render(host, root, session);
    await typeAnswer(host, "Bu, qısa bir izahdır.");
    api.post.mockRejectedValue(new ApiError(503, "AI_UNAVAILABLE"));
    await click(host, copy.interviews.submit);
    expect(host.textContent).toContain(copy.errors.ai);
    expect(host.textContent).toContain("İstiləşmə");
  });

  it("shows the server score on the report and a code editor for a code question", async () => {
    await render(host, root, {
      ...session,
      question: {
        title: "Cüt ədəd",
        prompt: "isEven adlı function yazın.",
        type: "code",
        position: 7,
        total: 10,
        followUp: false,
        starterCode: "function isEven(n) {\n  \n}\n",
      },
    });
    expect(host.querySelector("[data-editor='monaco']")).not.toBeNull();
    await act(async () => {
      root.unmount();
    });
    root = createRoot(host);
    await render(host, root, {
      ...session,
      status: "completed",
      question: null,
      report: {
        finalScore: 91,
        band: "strong",
        summary: "Əsas anlayışları izah edə bildiniz.",
        strengths: ["Quruluş"],
        weaknesses: [],
        conceptsToReview: [],
        nextAction: "Növbəti dərsə davam edin.",
        scoreSource: "server",
      },
    });
    expect(host.textContent).toContain("91");
    expect(host.textContent).toContain(copy.interviews.scoreNote);
    expect(host.textContent).not.toContain(copy.interviews.submit);
    expect(host.firstElementChild?.className).toContain("overflow-x-hidden");
  });
});

async function render(
  host: HTMLDivElement,
  root: Root,
  value: InterviewSessionView,
): Promise<void> {
  await act(async () => {
    root.render(createElement(InterviewRoom, { initial: value }));
  });
  void host;
}

async function typeAnswer(host: HTMLDivElement, value: string): Promise<void> {
  const area = host.querySelector("textarea");
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  await act(async () => {
    setter?.call(area, value);
    area?.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function click(host: HTMLDivElement, label: string): Promise<void> {
  const button = [...host.querySelectorAll("button")].find((item) =>
    item.textContent?.includes(label),
  );
  await act(async () => {
    button?.click();
  });
}
