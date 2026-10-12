import { describe, expect, it } from "vitest";
import { newSessionReviewFocus, reviewSlugIfPrimary } from "./review-focus";

const primaries = ["web.http", "web.url"];

describe("review focus persistence", () => {
  it("leaves a normal lesson without a review slug", () => {
    expect(
      newSessionReviewFocus({ kind: "start_lesson", lessonId: "page", title: "Page" }, primaries),
    ).toEqual({ ok: true, slug: null });
    expect(
      newSessionReviewFocus(
        { kind: "continue_lesson", sessionId: "session", lessonId: "page", title: "Page" },
        primaries,
      ),
    ).toEqual({ ok: true, slug: null });
  });

  it("keeps a review slug only when it is a primary of the selected lesson", () => {
    expect(
      newSessionReviewFocus(
        {
          kind: "review_concept",
          conceptSlug: "web.url",
          lessonId: "page",
          title: "Page",
        },
        primaries,
      ),
    ).toEqual({ ok: true, slug: "web.url" });
  });

  it("rejects a review slug that is not a primary of the selected lesson", () => {
    expect(
      newSessionReviewFocus(
        {
          kind: "review_concept",
          conceptSlug: "web.browser",
          lessonId: "page",
          title: "Page",
        },
        primaries,
      ),
    ).toEqual({ ok: false });
    expect(reviewSlugIfPrimary("web.forged", primaries)).toBeNull();
    expect(reviewSlugIfPrimary(null, primaries)).toBeNull();
    expect(reviewSlugIfPrimary("web.http", primaries)).toBe("web.http");
  });
});
