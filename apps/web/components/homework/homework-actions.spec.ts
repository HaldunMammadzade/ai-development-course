import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { TeachingHomeworkView } from "@platform/types";
import { copy } from "@/lib/copy";
import { HomeworkActions } from "./homework-actions";

const homework: TeachingHomeworkView = {
  id: "homework-1",
  prompt: "URL-i hissələrə ayır.",
  status: "assigned",
  dueAt: "2026-06-03T00:00:00.000Z",
  completedAt: null,
  lessonSlug: "what-a-url-is",
  lessonTitle: "URL nədir",
  title: "URL nədir",
};

describe("homework completion UI", () => {
  it("asks before completing and does not mark the card done itself", () => {
    const markup = renderToStaticMarkup(
      createElement(HomeworkActions, {
        item: homework,
        timeZone: "UTC",
        nowIso: "2026-06-01T00:00:00.000Z",
        confirming: false,
        pending: false,
        onAsk: () => undefined,
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }),
    );
    expect(markup).toContain(copy.homework.complete);
    expect(markup).not.toContain(copy.homework.success);

    const confirming = renderToStaticMarkup(
      createElement(HomeworkActions, {
        item: homework,
        timeZone: "UTC",
        nowIso: "2026-06-01T00:00:00.000Z",
        confirming: true,
        pending: false,
        onAsk: () => undefined,
        onCancel: () => undefined,
        onConfirm: () => undefined,
      }),
    );
    expect(confirming).toContain(copy.homework.confirmYes);
    expect(confirming).not.toContain(copy.homework.statusDone);
  });
});
