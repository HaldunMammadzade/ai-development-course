import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SkillGraph } from "@platform/types";
import { copy } from "@/lib/copy";
import { SkillMap } from "./skill-map";

const graph: SkillGraph = {
  focus: {
    moduleTitle: "React",
    lessonTitle: "Komponentlər",
    concepts: [
      { slug: "react.component", name: "Komponent", mark: "current" },
      { slug: "js.function", name: "Funksiya", mark: "review" },
    ],
  },
  modules: [
    {
      slug: "javascript",
      title: "JavaScript",
      conceptSlugs: ["js.function"],
      counts: { total: 1, unknown: 0, weak: 1, developing: 0, strong: 0 },
    },
    {
      slug: "react",
      title: "React",
      conceptSlugs: ["react.component"],
      counts: { total: 1, unknown: 1, weak: 0, developing: 0, strong: 0 },
    },
  ],
  concepts: [
    {
      slug: "js.function",
      name: "Funksiya",
      summary: "Funksiya bir işi adla çağırır.",
      moduleSlug: "javascript",
      moduleTitle: "JavaScript",
      lessonSlug: "functions",
      lessonTitle: "Funksiyalar",
      lessonAvailability: "completed",
      state: "weak",
      prerequisites: [],
      dependents: [{ slug: "react.component", name: "Komponent", state: "unknown" }],
      evidenceSource: "quiz",
      revision: null,
    },
    {
      slug: "react.component",
      name: "Komponent",
      summary: "Komponent bir UI parçasını qaytarır.",
      moduleSlug: "react",
      moduleTitle: "React",
      lessonSlug: "components-and-props",
      lessonTitle: "Komponentlər",
      lessonAvailability: "locked",
      state: "unknown",
      prerequisites: [{ slug: "js.function", name: "Funksiya", state: "weak" }],
      dependents: [],
      evidenceSource: null,
      revision: null,
    },
  ],
};

describe("skill map", () => {
  it("shows human states, a real prerequisite, and no internal detail", () => {
    const html = renderToStaticMarkup(createElement(SkillMap, { graph }));
    expect(html).toContain(copy.progress.map);
    expect(html).toContain(copy.progress.states.unknown);
    expect(html).toContain(copy.progress.states.weak);
    expect(html).toContain("Funksiya");
    expect(html).toContain(copy.progress.prerequisites);
    expect(html).toContain(copy.progress.locked);
    expect(html).toContain('href="/app/learn/functions"');
    expect(html).not.toContain("components-and-props");
    expect(html).not.toContain("react.component");
    expect(html).not.toContain("js.function");
    expect(html).not.toContain("%");
    expect(html).not.toContain("metadata");
    expect(html).not.toContain("mastery");
    expect(html).toContain("1 işləmək lazımdır");
    expect(html).toContain("1 yoxlanmayıb");
  });
});
