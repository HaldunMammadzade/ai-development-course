/**
 * @vitest-environment happy-dom
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExerciseAttemptView, ExerciseView } from "@platform/types";
import { ApiError, NetworkError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

const ids = vi.hoisted(() => ({ n: 0 }));
const mounts = vi.hoisted(() => ({ n: 0 }));

vi.mock("@/lib/api/client", () => ({
  apiGet: api.get,
  apiPost: api.post,
}));

vi.mock("@/lib/teaching/turn-id", () => ({
  createClientTurnId: () => {
    ids.n += 1;
    return `client-${ids.n}`;
  },
}));

vi.mock("@/components/exercises/coding-editor", async () => {
  const { createElement: h } = await import("react");
  return {
    CodingEditor: (props: {
      language: string | null;
      value: string;
      onChange: (value: string) => void;
      readOnly?: boolean;
      disabled?: boolean;
    }) => {
      mounts.n += 1;
      return h("textarea", {
        "aria-label": "Kod redaktoru",
        "data-monaco": "true",
        "data-language": props.language ?? "plaintext",
        value: props.value,
        disabled: props.disabled || props.readOnly,
        onChange: (event: { target: { value: string } }) => props.onChange(event.target.value),
      });
    },
  };
});

import { ExerciseBoard } from "./exercise-board";

const codeExercise: ExerciseView = {
  id: "ex-code",
  slug: "http-three-steps",
  lessonSlug: "how-the-web-delivers-a-page",
  title: "Üç addım",
  prompt: "Sorğunu yaz.",
  instructions: "Üç sözü ardıcıl yaz.",
  type: "code_text",
  language: null,
  difficulty: "beginner",
  starterCode: "sorğu",
  options: [],
  executionAvailable: false,
};

const scriptExercise: ExerciseView = {
  ...codeExercise,
  id: "ex-script",
  language: "javascript",
  starterCode: "<script>alert(1)</script>",
};

const choiceExercise: ExerciseView = {
  id: "ex-choice",
  slug: "http-request-choice",
  lessonSlug: "how-the-web-delivers-a-page",
  title: "HTTP sorğusu",
  prompt: "Hansı doğrudur?",
  instructions: "Bir variant seç.",
  type: "multiple_choice",
  language: null,
  difficulty: "beginner",
  starterCode: null,
  options: [
    { id: "option-a", label: "Sorğu" },
    { id: "option-b", label: "Cavab" },
  ],
  executionAvailable: false,
};

function passedAttempt(submission: string): ExerciseAttemptView {
  return {
    id: "attempt-1",
    exerciseId: "ex-code",
    status: "passed",
    score: 100,
    passed: true,
    feedback: "Üç addım düzgündür.",
    passedRules: [{ feedback: "Sözlər ardıcıllıqla yazılıb." }],
    failedRules: [],
    attemptNumber: 1,
    submission,
    createdAt: "2026-10-07T00:00:00.000Z",
  };
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  ids.n = 0;
  mounts.n = 0;
  api.get.mockReset();
  api.post.mockReset();
  api.get.mockResolvedValue({ attempts: [] });
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

async function renderBoard(exercises: ExerciseView[]): Promise<HTMLDivElement> {
  await act(async () => {
    root?.render(createElement(ExerciseBoard, { exercises }));
  });
  if (container === null) {
    throw new Error("missing container");
  }
  return container;
}

function buttonNamed(scope: ParentNode, name: string): HTMLButtonElement {
  const button = [...scope.querySelectorAll("button")].find((item) => item.textContent === name);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`missing button ${name}`);
  }
  return button;
}

async function click(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click();
  });
}

async function replaceEditor(scope: ParentNode, value: string): Promise<void> {
  const editor = scope.querySelector("textarea");
  if (!(editor instanceof HTMLTextAreaElement)) {
    throw new Error("missing editor");
  }
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter?.call(editor, value);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("coding classroom", () => {
  it("uses a compact field for authored text and Monaco for a real language", async () => {
    const choice = await renderBoard([choiceExercise]);
    expect(choice.querySelector("[data-monaco]")).toBeNull();
    expect(choice.querySelector("textarea")).toBeNull();
    expect(choice.querySelectorAll("input[type=radio]")).toHaveLength(2);
    expect(mounts.n).toBe(0);

    await act(async () => {
      root?.render(createElement(ExerciseBoard, { exercises: [codeExercise] }));
    });
    const field = container?.querySelector("textarea");
    expect(field?.getAttribute("data-monaco")).toBeNull();
    expect(field?.value).toBe("sorğu");
    expect(field?.getAttribute("rows")).toBe("2");
    expect(container?.textContent).toContain(copy.exercise.answerLabel);
    expect(container?.textContent).toContain(copy.exercise.noExecution);
    expect(mounts.n).toBe(0);

    await act(async () => {
      root?.render(createElement(ExerciseBoard, { exercises: [scriptExercise] }));
    });
    expect(container?.querySelector("[data-monaco]")?.getAttribute("data-language")).toBe(
      "javascript",
    );
    expect(mounts.n).toBeGreaterThan(0);
  });

  it("keeps Monaco when the exercise type or execution flag is not an authored text check", async () => {
    const legacy = {
      ...codeExercise,
      id: "ex-legacy",
      type: "legacy",
    } as unknown as ExerciseView;
    const view = await renderBoard([legacy]);
    expect(view.querySelector("[data-monaco]")).not.toBeNull();
    expect(view.querySelector("[data-monaco]")?.getAttribute("data-language")).toBe("plaintext");

    const ambiguous = { ...codeExercise, id: "ex-ambiguous", executionAvailable: true };
    await act(async () => {
      root?.render(createElement(ExerciseBoard, { exercises: [ambiguous] }));
    });
    expect(container?.querySelector("[data-monaco]")).not.toBeNull();
  });

  it("keeps a short answer after the board renders again", async () => {
    const view = await renderBoard([codeExercise]);
    await replaceEditor(view, "5");
    await act(async () => {
      root?.render(createElement(ExerciseBoard, { exercises: [codeExercise] }));
    });
    expect(container?.querySelector("textarea")?.value).toBe("5");
    expect(container?.querySelector("[data-monaco]")).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
  });

  it("submits the current editor text without a score and keeps the same id after a network failure", async () => {
    const view = await renderBoard([codeExercise]);
    await replaceEditor(view, "sorğu\ncavab");
    api.post.mockRejectedValueOnce(new NetworkError());
    await click(buttonNamed(view, copy.exercise.check));

    expect(api.post).toHaveBeenCalledTimes(1);
    const first = api.post.mock.calls[0]?.[1] as { clientAttemptId: string; submission: string };
    expect(Object.keys(first).sort()).toEqual(["clientAttemptId", "submission"]);
    expect(first.submission).toBe("sorğu\ncavab");
    expect(first.clientAttemptId).toBe("client-1");
    expect(view.querySelector("textarea")?.value).toBe("sorğu\ncavab");
    expect(view.textContent).toContain(copy.errors.network);

    api.post.mockResolvedValueOnce(passedAttempt("sorğu\ncavab"));
    await click(buttonNamed(view, copy.exercise.check));
    const second = api.post.mock.calls[1]?.[1] as { clientAttemptId: string };
    expect(second.clientAttemptId).toBe(first.clientAttemptId);
    expect(view.textContent).toContain("Üç addım düzgündür.");
    expect(view.textContent).toContain("100");
    expect(view.textContent).toContain(copy.exercise.passedCheck);
    expect(view.textContent).toContain(copy.exercise.updated);
    expect(view.textContent).toContain(copy.exercise.continueLesson);
    expect(view.querySelector("[data-result]")?.getAttribute("data-result")).toBe("passed");
    expect(view.textContent).toContain(`${copy.exercise.attempt} 1`);
  });

  it("uses a new id after a successful attempt and an edit", async () => {
    const view = await renderBoard([codeExercise]);
    api.post.mockResolvedValueOnce(passedAttempt("sorğu"));
    await click(buttonNamed(view, copy.exercise.check));
    const first = api.post.mock.calls[0]?.[1] as { clientAttemptId: string };
    await replaceEditor(view, "sorğu cavab");
    api.post.mockResolvedValueOnce({
      ...passedAttempt("sorğu cavab"),
      id: "attempt-2",
      attemptNumber: 2,
    });
    await click(buttonNamed(view, copy.exercise.check));
    const second = api.post.mock.calls[1]?.[1] as { clientAttemptId: string; submission: string };
    expect(second.clientAttemptId).not.toBe(first.clientAttemptId);
    expect(second.submission).toBe("sorğu cavab");
    expect(Object.keys(second).sort()).toEqual(["clientAttemptId", "submission"]);
  });

  it("ignores a second click while the first submit is still running", async () => {
    const view = await renderBoard([codeExercise]);
    let release: (value: ExerciseAttemptView) => void = () => undefined;
    api.post.mockImplementation(
      () =>
        new Promise<ExerciseAttemptView>((resolve) => {
          release = resolve;
        }),
    );
    const button = buttonNamed(view, copy.exercise.check);
    await act(async () => {
      button.click();
      button.click();
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(button.disabled).toBe(true);
    await act(async () => {
      release(passedAttempt("sorğu"));
    });
    expect(button.disabled).toBe(false);
  });

  it("restores starter code locally and does not create an attempt", async () => {
    const view = await renderBoard([codeExercise]);
    await click(buttonNamed(view, copy.exercise.reset));
    expect(view.textContent).not.toContain(copy.exercise.resetConfirm);
    expect(api.post).not.toHaveBeenCalled();

    await replaceEditor(view, "dəyişdi");
    await click(buttonNamed(view, copy.exercise.reset));
    expect(view.textContent).toContain(copy.exercise.resetConfirm);
    await click(buttonNamed(view, copy.exercise.resetYes));
    expect(view.querySelector("textarea")?.value).toBe("sorğu");
    expect(api.post).not.toHaveBeenCalled();
  });

  it("shows a failed result and an API error without clearing the editor", async () => {
    const view = await renderBoard([codeExercise]);
    await replaceEditor(view, "yarım");
    api.post.mockResolvedValueOnce({
      ...passedAttempt("yarım"),
      status: "failed",
      score: 40,
      passed: false,
      feedback: "Sıra tam deyil.",
      passedRules: [],
      failedRules: [{ feedback: "Üç sözün hamısı yoxdur." }],
      attemptNumber: 3,
    });
    await click(buttonNamed(view, copy.exercise.check));
    expect(view.textContent).toContain(copy.exercise.notPassed);
    expect(view.textContent).toContain("40");
    expect(view.textContent).toContain(`${copy.exercise.failedCheck}: Üç sözün hamısı yoxdur.`);
    expect(view.textContent).toContain(copy.exercise.retry);
    expect(view.querySelector("[data-result]")?.getAttribute("data-result")).toBe("failed");
    expect(view.textContent).not.toContain(copy.exercise.updated);

    api.post.mockRejectedValueOnce(new ApiError(500, "REQUEST_FAILED"));
    await replaceEditor(view, "yenə yarım");
    await click(buttonNamed(view, copy.exercise.check));
    expect(view.querySelector("textarea")?.value).toBe("yenə yarım");
    expect(view.textContent).toContain(copy.errors.generic);
  });

  it("disables Yoxla until there is text", async () => {
    const blank: ExerciseView = { ...codeExercise, starterCode: "" };
    const view = await renderBoard([blank]);
    expect(buttonNamed(view, copy.exercise.check).disabled).toBe(true);
    await replaceEditor(view, "  ");
    expect(buttonNamed(view, copy.exercise.check).disabled).toBe(true);
    await replaceEditor(view, "kod");
    expect(buttonNamed(view, copy.exercise.check).disabled).toBe(false);
  });

  it("renders a script submission as text and posts a choice id from the radio UI", async () => {
    api.get.mockResolvedValue({
      attempts: [
        {
          ...passedAttempt("<script>alert(1)</script>"),
          submission: "<img src=x onerror=alert(1)>",
        },
      ],
    });
    const view = await renderBoard([scriptExercise]);
    expect(view.querySelector("img")).toBeNull();
    expect(view.querySelector("iframe")).toBeNull();
    expect(view.innerHTML).toContain("&lt;img");
    expect(view.innerHTML).not.toContain("<img");
    expect(view.querySelector("textarea")?.getAttribute("data-language")).toBe("javascript");

    const choice = await renderBoard([choiceExercise]);
    const radio = choice.querySelector("input[value=option-a]");
    if (!(radio instanceof HTMLInputElement)) {
      throw new Error("missing choice");
    }
    await act(async () => {
      radio.click();
    });
    api.post.mockResolvedValueOnce({
      ...passedAttempt("option-a"),
      exerciseId: "ex-choice",
    });
    await click(buttonNamed(choice, copy.exercise.check));
    const body = api.post.mock.calls.at(-1)?.[1] as { submission: string };
    expect(body.submission).toBe("option-a");
    expect(choice.querySelector("[data-monaco]")).toBeNull();
  });

  it("asks for a review of the stored attempt and keeps the editor editable", async () => {
    const runnable: ExerciseView = {
      ...codeExercise,
      id: "ex-run",
      language: "javascript",
      executionAvailable: true,
    };
    const view = await renderBoard([runnable]);
    await replaceEditor(view, "function add(a, b) { return a - b; }");
    api.post.mockResolvedValueOnce({
      ...passedAttempt("function add(a, b) { return a - b; }"),
      id: "attempt-run",
      exerciseId: "ex-run",
      status: "failed",
      score: 34,
      passed: false,
      feedback:
        "1/3 yoxlama keçdi. Qaytarılan nəticə tələb olunan davranışa uyğun gəlmir. Funksiyanın qaytardığı dəyəri tapşırığa görə yenidən yoxla.",
      passedRules: [],
      failedRules: [],
    });
    await click(buttonNamed(view, copy.exercise.check));
    expect(view.textContent).toContain(copy.exercise.notPassed);
    expect(view.textContent).toContain("tələb olunan davranışa uyğun gəlmir");
    expect(view.textContent).not.toContain("add-a");
    expect(view.textContent).not.toContain("7xQ");
    expect(view.querySelector("[data-result='failed']")).not.toBeNull();
    expect(view.textContent).toContain(copy.exercise.explain);
    expect(view.textContent).toContain(copy.exercise.hint);
    expect(view.textContent).not.toContain(copy.exercise.reviewCode);

    api.post.mockResolvedValueOnce({
      review: {
        summary: "Çıxma əməliyyatı var.",
        understanding: "incorrect",
        feedback: "Funksiya <img src=x> qaytarır.",
        strengths: ["Funksiya elan olunub."],
        issues: [{ type: "logic", description: "Operator fərqlidir." }],
        nextQuestion: "2 və 3 üçün fərq nədir?",
      },
    });
    const editor = view.querySelector("textarea");
    await click(buttonNamed(view, copy.exercise.explain));
    const reviewCall = api.post.mock.calls.at(-1);
    expect(reviewCall?.[0]).toBe("/api/v1/exercises/ex-run/review");
    expect(Object.keys(reviewCall?.[1] as object).sort()).toEqual([
      "attemptId",
      "clientReviewId",
      "mode",
    ]);
    expect((reviewCall?.[1] as { attemptId: string; mode: string }).attemptId).toBe("attempt-run");
    expect((reviewCall?.[1] as { mode: string }).mode).toBe("explain");
    expect(view.textContent).toContain("Çıxma əməliyyatı var.");
    expect(view.textContent).toContain(copy.exercise.teacher);
    expect(view.querySelector("img")).toBeNull();
    expect(view.innerHTML).toContain("&lt;img");
    expect(editor?.disabled).toBe(false);

    await replaceEditor(view, "function add(a, b) { return a + b; }");
    api.post.mockResolvedValueOnce({
      ...passedAttempt("function add(a, b) { return a + b; }"),
      id: "attempt-next",
      exerciseId: "ex-run",
      feedback: "3/3 yoxlama keçdi.",
    });
    await click(buttonNamed(view, copy.exercise.check));
    expect(view.textContent).not.toContain("Çıxma əməliyyatı var.");
    expect(view.textContent).toContain(copy.exercise.reviewCode);
    expect(view.textContent).not.toContain(copy.exercise.hint);
  });
});
