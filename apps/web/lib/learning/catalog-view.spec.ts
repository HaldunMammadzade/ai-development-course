import { describe, expect, it } from "vitest";
import type { LearningCatalog } from "@platform/types";
import { lessonPageAccess } from "./catalog-view";

const catalog: LearningCatalog = {
  path: { slug: "frontend", title: "Frontend", description: "Yol" },
  modules: [
    {
      slug: "javascript",
      title: "JavaScript",
      description: "Dil",
      lessons: [
        {
          slug: "js-basics",
          title: "JavaScript əsasları",
          objective: "Başlanğıc",
          estimatedMinutes: 15,
          availability: "current",
        },
        {
          slug: "js-variables",
          title: "Dəyişənlər",
          objective: "Dəyişən",
          estimatedMinutes: 15,
          availability: "locked",
        },
      ],
    },
  ],
  concepts: [],
  focus: null,
  nextAction: { kind: "start_lesson", lessonId: "js-basics", title: "JavaScript əsasları" },
  activity: [],
};

describe("lesson page access", () => {
  it("opens the current lesson and rejects a locked or unknown slug", () => {
    expect(lessonPageAccess(catalog, "js-basics")).toBe("open");
    expect(lessonPageAccess(catalog, "js-variables")).toBe("locked");
    expect(lessonPageAccess(catalog, "components-and-props")).toBe("locked");
  });

  it("opens the review lesson and keeps the next lesson locked", () => {
    const review: LearningCatalog = {
      ...catalog,
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
      nextAction: {
        kind: "review_concept",
        conceptSlug: "web.http",
        lessonId: "lesson-1",
        title: "Brauzer səhifəni necə alır",
      },
    };

    expect(lessonPageAccess(review, "how-the-web-delivers-a-page")).toBe("open");
    expect(lessonPageAccess(review, "what-a-url-is")).toBe("locked");
  });
});
