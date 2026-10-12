import { describe, expect, it } from "vitest";
import type { PersonalizedPath } from "@platform/types";
import { buildSkillGraph, skillState, skillStateFromEvidence } from "./skill-graph";
import type { SkillGraphConceptInput } from "./skill-graph";

function concept(
  patch: Partial<SkillGraphConceptInput> & Pick<SkillGraphConceptInput, "slug" | "name">,
): SkillGraphConceptInput {
  return {
    summary: "",
    moduleSlug: "javascript",
    moduleTitle: "JavaScript",
    lessonSlug: "js-functions",
    lessonTitle: "Funksiyalar",
    lessonAvailability: "locked",
    band: null,
    evidenceSource: null,
    ...patch,
  };
}

describe("skill states", () => {
  it("keeps an unchecked concept unknown, including a single low score", () => {
    expect(skillState(null)).toBe("unknown");
    expect(skillStateFromEvidence(0, 0)).toBe("unknown");
    expect(skillStateFromEvidence(44, 1)).toBe("unknown");
  });

  it("uses the existing weak, developing, and strong bands", () => {
    expect(skillStateFromEvidence(44, 2)).toBe("weak");
    expect(skillStateFromEvidence(45, 1)).toBe("developing");
    expect(skillStateFromEvidence(59, 2)).toBe("developing");
    expect(skillStateFromEvidence(60, 2)).toBe("developing");
    expect(skillStateFromEvidence(79, 3)).toBe("developing");
    expect(skillStateFromEvidence(80, 2)).toBe("strong");
    expect(skillState("fragile")).toBe("developing");
    expect(skillState("working")).toBe("developing");
    expect(skillState("strong")).toBe("strong");
  });

  it("does not add a mastered threshold", () => {
    expect(skillStateFromEvidence(100, 20)).toBe("strong");
    expect(["unknown", "weak", "developing", "strong"]).not.toContain("mastered");
  });
});

describe("concept graph", () => {
  const concepts = [
    concept({
      slug: "js.function",
      name: "Funksiya",
      lessonAvailability: "completed",
      band: "weak",
    }),
    concept({
      slug: "react.component",
      name: "Komponent",
      moduleSlug: "react",
      moduleTitle: "React",
      lessonSlug: "components",
      lessonTitle: "Komponentlər",
      lessonAvailability: "locked",
      band: null,
    }),
    concept({
      slug: "react.state",
      name: "State",
      moduleSlug: "react",
      moduleTitle: "React",
      lessonSlug: "state",
      lessonTitle: "State",
      lessonAvailability: "locked",
    }),
    concept({
      slug: "css.selector",
      name: "Selektor",
      moduleSlug: "css",
      moduleTitle: "CSS",
      lessonSlug: "selectors",
      lessonTitle: "Selektorlar",
      lessonAvailability: "completed",
      band: "strong",
      evidenceSource: "exercise",
    }),
  ];

  const graph = buildSkillGraph({
    concepts: [...concepts, concepts[0]!],
    prerequisites: [
      { conceptSlug: "react.component", prerequisiteSlug: "js.function" },
      { conceptSlug: "react.component", prerequisiteSlug: "js.function" },
      { conceptSlug: "react.state", prerequisiteSlug: "react.component" },
      { conceptSlug: "react.state", prerequisiteSlug: "missing.concept" },
    ],
    path: null,
  });

  it("links a prerequisite and its dependent without duplicating nodes", () => {
    expect(graph.concepts.map((item) => item.slug)).toEqual([
      "js.function",
      "react.component",
      "react.state",
      "css.selector",
    ]);
    const component = graph.concepts.find((item) => item.slug === "react.component");
    expect(component?.prerequisites.map((item) => item.slug)).toEqual(["js.function"]);
    expect(component?.prerequisites[0]).toMatchObject({ name: "Funksiya", state: "weak" });
    expect(component?.dependents.map((item) => item.slug)).toEqual(["react.state"]);
    const functions = graph.concepts.find((item) => item.slug === "js.function");
    expect(functions?.dependents.map((item) => item.slug)).toEqual(["react.component"]);
  });

  it("leaves an isolated concept without edges and drops an unknown endpoint", () => {
    const selector = graph.concepts.find((item) => item.slug === "css.selector");
    expect(selector?.prerequisites).toEqual([]);
    expect(selector?.dependents).toEqual([]);
    expect(graph.concepts.some((item) => item.slug === "missing.concept")).toBe(false);
  });

  it("counts real states per module and does not invent a score", () => {
    expect(graph.modules.find((item) => item.slug === "react")?.counts).toEqual({
      total: 2,
      unknown: 2,
      weak: 0,
      developing: 0,
      strong: 0,
    });
    expect(graph.modules.find((item) => item.slug === "javascript")?.counts).toMatchObject({
      total: 1,
      weak: 1,
    });
    const serialized = JSON.stringify(graph);
    expect(serialized).not.toContain("mastery");
    expect(serialized).not.toContain("evidenceCount");
    expect(serialized).not.toContain("metadata");
    expect(serialized).not.toContain("%");
    expect(graph.concepts.find((item) => item.slug === "css.selector")?.evidenceSource).toBe(
      "exercise",
    );
  });
});

describe("path integration", () => {
  const path: PersonalizedPath = {
    note: "Bu mərhələyə keçmək üçün bir əsas mövzu qalıb.",
    current: { slug: "js-functions", title: "Funksiyalar", moduleTitle: "JavaScript" },
    next: [{ slug: "js-arrays", title: "Massivlər", moduleTitle: "JavaScript" }],
    concepts: [
      { slug: "js.function", name: "Funksiya", mark: "current" },
      { slug: "js.array", name: "Massiv", mark: "upcoming" },
      { slug: "not.published", name: "Gizli", mark: "upcoming" },
    ],
    known: ["Selektor"],
  };

  it("copies the current path focus and keeps a locked lesson closed", () => {
    const graph = buildSkillGraph({
      concepts: [
        concept({
          slug: "js.function",
          name: "Funksiya",
          lessonAvailability: "current",
          band: "weak",
        }),
        concept({
          slug: "js.array",
          name: "Massiv",
          lessonSlug: "js-arrays",
          lessonTitle: "Massivlər",
          lessonAvailability: "locked",
        }),
      ],
      prerequisites: [],
      path,
    });

    expect(graph.focus).toEqual({
      moduleTitle: "JavaScript",
      lessonTitle: "Funksiyalar",
      concepts: [
        { slug: "js.function", name: "Funksiya", mark: "current" },
        { slug: "js.array", name: "Massiv", mark: "upcoming" },
      ],
    });
    expect(graph.concepts.find((item) => item.slug === "js.function")?.lessonAvailability).toBe(
      "current",
    );
    expect(graph.concepts.find((item) => item.slug === "js.array")?.lessonAvailability).toBe(
      "locked",
    );
    expect(graph.concepts.some((item) => item.slug === "not.published")).toBe(false);
  });

  it("keeps a returning student's real bands and leaves the rest unknown", () => {
    const graph = buildSkillGraph({
      concepts: [
        concept({
          slug: "html.link",
          name: "Link",
          moduleSlug: "html",
          moduleTitle: "HTML",
          band: "strong",
        }),
        concept({ slug: "js.function", name: "Funksiya", band: "weak", evidenceSource: "quiz" }),
        concept({
          slug: "react.component",
          name: "Komponent",
          moduleSlug: "react",
          moduleTitle: "React",
        }),
      ],
      prerequisites: [{ conceptSlug: "react.component", prerequisiteSlug: "js.function" }],
      path,
    });

    expect(graph.concepts.map((item) => [item.slug, item.state])).toEqual([
      ["html.link", "strong"],
      ["js.function", "weak"],
      ["react.component", "unknown"],
    ]);
    expect(
      graph.concepts.find((item) => item.slug === "react.component")?.prerequisites[0]?.state,
    ).toBe("weak");
  });
});
