import { describe, expect, it } from "vitest";
import { frontendCurriculum } from "./frontend-seed";
import { frontendInterviews } from "./frontend-interview";

describe("frontend interview seed", () => {
  const published = frontendInterviews.find(
    (interview) => interview.slug === "frontend-foundation",
  );
  const hidden = frontendInterviews.find(
    (interview) => interview.slug === "frontend-interview-hidden",
  );

  it("publishes one foundation interview and keeps another draft", () => {
    expect(published?.published).toBe(true);
    expect(hidden?.published).toBe(false);
    expect(published?.requirementSlugs).toEqual([
      "html.elements",
      "html.text",
      "html.links",
      "html.attributes",
    ]);
  });

  it("orders ten published main questions and one authored follow-up", () => {
    const mains = published?.questions.filter(
      (question) => question.published && question.parentSlug === undefined,
    );
    expect(mains?.map((question) => question.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(mains?.map((question) => question.slug)).toEqual([
      "warmup",
      "html",
      "semantic",
      "css",
      "browser",
      "url",
      "even",
      "debugging",
      "links",
      "attributes",
    ]);
    const follow = published?.questions.find((question) => question.slug === "semantic-follow");
    expect(follow).toMatchObject({
      parentSlug: "semantic",
      published: true,
      weight: 0,
      type: "verbal",
    });
    expect(
      published?.questions.find((question) => question.slug === "unpublished-note")?.published,
    ).toBe(false);
  });

  it("uses only concepts taught on a published lesson", () => {
    const taught = publishedConcepts();
    for (const interview of frontendInterviews) {
      for (const slug of interview.requirementSlugs) {
        expect(taught.has(slug)).toBe(true);
      }
      for (const question of interview.questions) {
        expect(taught.has(question.conceptSlug)).toBe(true);
        expect(question.conceptSlug).not.toBe("css.selector");
        expect(question.conceptSlug).not.toBe("js.value");
      }
    }
  });

  it("keeps the code question on the authored even-number task", () => {
    const code = published?.questions.find((question) => question.type === "code");
    expect(code).toMatchObject({ slug: "even", conceptSlug: "web.javascript" });
    expect(code?.execution?.entry).toBe("isEven");
    expect(code?.prompt).not.toContain("even-eight");
    expect(code?.prompt).not.toContain("odd-forty-one");
    expect(code?.starterCode).not.toContain("%");
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
