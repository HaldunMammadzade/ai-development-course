import { describe, expect, it } from "vitest";
import { frontendCurriculum } from "./frontend-seed";
import { frontendSpeakingQuestions } from "./frontend-speaking";

describe("speaking questions", () => {
  it("publishes twelve short questions from the published curriculum", () => {
    const taught = publishedConcepts();
    const published = frontendSpeakingQuestions.filter((question) => question.published);
    expect(published).toHaveLength(12);
    expect(published.map((question) => question.position)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    for (const question of frontendSpeakingQuestions) {
      expect(taught.has(question.conceptSlug)).toBe(true);
      expect(question.conceptSlug).not.toBe("css.selector");
      expect(question.conceptSlug).not.toBe("js.value");
      expect(question.prompt.length).toBeLessThan(180);
    }
    expect(
      frontendSpeakingQuestions.some(
        (question) => question.title === "Gizli danışıq" && !question.published,
      ),
    ).toBe(true);
  });
});

function publishedConcepts(): Set<string> {
  const slugs = new Set<string>();
  for (const path of frontendCurriculum.paths) {
    if (path.status !== "published") {
      continue;
    }
    for (const module of path.modules) {
      for (const lesson of module.lessons) {
        if (lesson.status !== "published") {
          continue;
        }
        for (const link of lesson.concepts) {
          slugs.add(link.conceptSlug);
        }
      }
    }
  }
  return slugs;
}
