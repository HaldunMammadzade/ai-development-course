/**
 * @vitest-environment happy-dom
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpeakingSessionView } from "@platform/types";
import { ApiError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";

const api = vi.hoisted(() => ({
  post: vi.fn(),
  form: vi.fn(),
}));

vi.mock("@/lib/api/client", () => ({
  apiPost: api.post,
  apiForm: api.form,
}));

vi.mock("@/lib/teaching/turn-id", () => ({
  createClientTurnId: () => "attempt-1",
}));

import { SpeakingRoom } from "./speaking-room";

const session: SpeakingSessionView = {
  id: "session-1",
  mode: "lesson",
  status: "active",
  question: {
    title: "Semantik HTML",
    prompt: "HTML-də semantic element nədir və niyə istifadə olunur?",
    position: 1,
    total: 12,
  },
  feedback: null,
  nextAction: null,
};

let root: Root;
let container: HTMLDivElement;

describe("SpeakingRoom", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    api.post.mockReset();
    api.form.mockReset();
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("does not request the microphone until the student starts speaking", () => {
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    render(session);
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(container.textContent).toContain(copy.speaking.start);
  });

  it("shows the server question and a text fallback", () => {
    render(session);
    expect(container.textContent).toContain("Semantik HTML");
    expect(container.textContent).toContain(copy.speaking.start);
    expect(container.textContent).toContain(copy.speaking.text);
  });

  it("submits typed text and shows the transcript without a score", async () => {
    api.post.mockResolvedValue({
      session: {
        ...session,
        question: { ...session.question, title: "HTML element", position: 2 },
        feedback: {
          transcript: "Semantik element mənası bildirir.",
          speech: "Əsas fikri düzgün izah etdin.",
          feedback: "Bir nümunə əlavə et.",
          understanding: "correct",
          strengths: ["Aydındır."],
          issues: [],
        },
        nextAction: "Növbəti sual hazırdır.",
      },
    });
    render(session);
    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    await act(async () => {
      const setter = Object.keys(textarea ?? {}).find((key) => key.startsWith("__reactProps"));
      const props =
        setter === undefined
          ? null
          : (
              textarea as unknown as Record<
                string,
                { onChange?: (event: { target: { value: string } }) => void }
              >
            )[setter];
      props?.onChange?.({
        target: { value: "Semantik element mənası bildirir və header buna misaldır." },
      });
    });
    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/speaking/sessions/session-1/attempts",
      expect.objectContaining({ clientAttemptId: "attempt-1" }),
    );
    expect(container.textContent).toContain("Əsas fikri düzgün izah etdin.");
    expect(container.textContent).not.toContain("100");
  });

  it("keeps the attempt id when speech is unavailable", async () => {
    api.post.mockRejectedValue(new ApiError(503, "SPEECH_UNAVAILABLE"));
    render(session);
    const textarea = container.querySelector("textarea");
    await act(async () => {
      const setter = Object.keys(textarea ?? {}).find((key) => key.startsWith("__reactProps"));
      const props =
        setter === undefined
          ? null
          : (
              textarea as unknown as Record<
                string,
                { onChange?: (event: { target: { value: string } }) => void }
              >
            )[setter];
      props?.onChange?.({
        target: { value: "Semantik element mənası bildirir və header buna misaldır." },
      });
    });
    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(container.textContent).toContain(copy.speaking.speechDown);
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    const ids = api.post.mock.calls.map(
      (call) => (call[1] as { clientAttemptId: string }).clientAttemptId,
    );
    expect(ids).toEqual(["attempt-1", "attempt-1"]);
  });
});

function render(value: SpeakingSessionView): void {
  act(() => {
    root.render(createElement(SpeakingRoom, { initial: value }));
  });
}
