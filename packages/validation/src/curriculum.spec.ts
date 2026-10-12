import type { CurriculumDocument } from "@platform/types";
import { describe, expect, it } from "vitest";
import { CurriculumValidationError, validateCurriculum } from "./curriculum";

function document(overrides: Partial<CurriculumDocument> = {}): CurriculumDocument {
  const base: CurriculumDocument = {
    concepts: [
      { slug: "web.http", name: "HTTP", domain: "web", summary: "A request and a response." },
      {
        slug: "web.browser",
        name: "Browser",
        domain: "web",
        summary: "The program that shows the page.",
      },
    ],
    prerequisites: [{ conceptSlug: "web.browser", prerequisiteSlug: "web.http" }],
    exercises: [],
    paths: [
      {
        slug: "frontend",
        title: "Frontend",
        description: "Pages in the browser.",
        track: "frontend",
        status: "published",
        position: 1,
        modules: [
          {
            slug: "web-fundamentals",
            title: "Web Fundamentals",
            description: "How a page arrives.",
            position: 1,
            lessons: [
              {
                slug: "how-the-web-delivers-a-page",
                title: "How a page arrives",
                objective: "Explain the request and the response.",
                position: 1,
                estimatedMinutes: 15,
                status: "published",
                concepts: [
                  { conceptSlug: "web.http", role: "primary" },
                  { conceptSlug: "web.browser", role: "primary" },
                ],
                blocks: [
                  {
                    type: "reading",
                    position: 1,
                    markdown: "The browser sends an HTTP request.",
                    conceptSlugs: ["web.http"],
                  },
                  {
                    type: "check_question",
                    position: 2,
                    prompt: "What does the browser send?",
                    rubric: ["An HTTP request"],
                    conceptSlugs: ["web.http"],
                    difficulty: "beginner",
                  },
                  {
                    type: "recap",
                    position: 3,
                    points: ["The browser requests", "The server responds"],
                    practicePrompt: "Say the two steps in your own words.",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  return { ...base, ...overrides };
}

describe("validateCurriculum", () => {
  it("accepts a lesson with a reading, a check, and a recap", () => {
    expect(validateCurriculum(document()).paths[0]?.slug).toBe("frontend");
  });

  it("rejects more than two primary concepts", () => {
    const value = document();
    value.concepts.push({
      slug: "web.url",
      name: "URL",
      domain: "web",
      summary: "An address.",
    });
    const lesson = value.paths[0]?.modules[0]?.lessons[0];
    lesson?.concepts.push({ conceptSlug: "web.url", role: "primary" });

    expect(() => validateCurriculum(value)).toThrow(/more than two primary concepts/);
  });

  it("rejects a lesson with no primary concept", () => {
    const value = document();
    const lesson = value.paths[0]?.modules[0]?.lessons[0];
    if (lesson === undefined) {
      throw new Error("fixture missing");
    }
    lesson.concepts = [{ conceptSlug: "web.http", role: "supporting" }];

    expect(() => validateCurriculum(value)).toThrow(/lesson has no primary concept/);
  });

  it("rejects a duplicate concept link", () => {
    const value = document();
    value.paths[0]?.modules[0]?.lessons[0]?.concepts.push({
      conceptSlug: "web.http",
      role: "supporting",
    });

    expect(() => validateCurriculum(value)).toThrow(/duplicate concept link/);
  });

  it("rejects a prerequisite cycle", () => {
    const value = document();
    value.prerequisites.push({ conceptSlug: "web.http", prerequisiteSlug: "web.browser" });

    expect(() => validateCurriculum(value)).toThrow(/prerequisite cycle/);
  });

  it("rejects a self prerequisite", () => {
    const value = document();
    value.prerequisites = [{ conceptSlug: "web.http", prerequisiteSlug: "web.http" }];

    expect(() => validateCurriculum(value)).toThrow(/prerequisite self-reference/);
  });

  it("rejects a recap without a practice prompt", () => {
    const value = document();
    const blocks = value.paths[0]?.modules[0]?.lessons[0]?.blocks;
    if (blocks === undefined) {
      throw new Error("fixture missing");
    }
    blocks[2] = { type: "recap", position: 3, points: ["One point"], practicePrompt: "  " };

    expect(() => validateCurriculum(value)).toThrow(CurriculumValidationError);
  });

  it("rejects a duplicate lesson slug and an unknown concept", () => {
    const value = document();
    const module = value.paths[0]?.modules[0];
    const lesson = module?.lessons[0];
    if (module === undefined || lesson === undefined) {
      throw new Error("fixture missing");
    }
    module.lessons.push({ ...lesson, position: 2, concepts: [...lesson.concepts] });
    lesson.concepts.push({ conceptSlug: "missing.concept", role: "supporting" });

    try {
      validateCurriculum(value);
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(CurriculumValidationError);
      const issues = (error as CurriculumValidationError).issues.join("\n");
      expect(issues).toContain("duplicate slug: lesson");
      expect(issues).toContain("unknown concept reference");
    }
  });
});
