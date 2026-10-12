import { validateCurriculum } from "@platform/validation";
import { describe, expect, it } from "vitest";
import { frontendCurriculum } from "./frontend-seed";
import { lessonHasHarderCheck, recapPracticePrompt } from "./graph";

describe("frontend curriculum seed", () => {
  it("publishes the frontend path through Next.js fundamentals", () => {
    const document = validateCurriculum(frontendCurriculum);
    const frontend = document.paths.find((path) => path.slug === "frontend");
    const backend = document.paths.find((path) => path.slug === "backend");
    expect(frontend?.status).toBe("published");
    expect(backend?.status).toBe("draft");

    const publishedModules = frontend?.modules.filter((module) =>
      module.lessons.some((lesson) => lesson.status === "published"),
    );
    expect(publishedModules?.map((module) => module.title)).toEqual([
      "Web Fundamentals",
      "HTML",
      "CSS",
      "JavaScript",
      "TypeScript Fundamentals",
      "React Fundamentals",
      "Next.js Fundamentals",
      "Git & GitHub",
      "Testing Fundamentals",
    ]);

    const publishedLessons = frontend?.modules.flatMap((module) =>
      module.lessons.filter((lesson) => lesson.status === "published"),
    );
    expect(publishedLessons?.map((lesson) => lesson.slug)).toEqual([
      "how-the-web-delivers-a-page",
      "what-a-url-is",
      "html-css-and-javascript",
      "html-document-structure",
      "html-elements",
      "html-text",
      "links-and-attributes",
      "semantic-html",
      "images-and-accessibility",
      "css-selectors",
      "css-box-model",
      "css-display",
      "css-flexbox",
      "css-responsive",
      "js-basics",
      "js-variables",
      "js-values",
      "js-conditions",
      "js-loops",
      "js-functions",
      "js-arrays",
      "js-objects",
      "what-typescript-is",
      "type-annotations",
      "primitive-types",
      "arrays-and-tuples",
      "objects-and-type-aliases",
      "unions-and-literals",
      "typescript-interfaces",
      "function-types",
      "optional-and-readonly",
      "type-narrowing",
      "generics-basics",
      "what-react-is",
      "react-project-and-jsx",
      "components-and-props",
      "typescript-react-props",
      "state-and-use-state",
      "react-events",
      "conditional-rendering",
      "lists-and-keys",
      "forms-and-controlled-inputs",
      "effects-and-side-effects",
      "fetching-api-data",
      "component-composition",
      "lifting-state-up",
      "custom-hooks-basics",
      "what-nextjs-is",
      "nextjs-project-structure",
      "nextjs-app-router",
      "nextjs-file-routing",
      "nextjs-dynamic-routes",
      "nextjs-layouts",
      "nextjs-navigation",
      "nextjs-server-and-client",
      "nextjs-use-client",
      "nextjs-data-fetching",
      "nextjs-loading-and-error",
      "nextjs-params",
      "nextjs-metadata",
      "nextjs-rendering",
      "nextjs-route-handlers",
      "nextjs-environment",
      "git-repository",
      "git-changes",
      "git-commits",
      "git-branches",
      "git-conflicts",
      "git-remote",
      "git-pull-request",
      "testing-why",
      "testing-assertions",
      "testing-unit",
      "testing-component",
      "testing-integration",
      "testing-isolation",
      "testing-failures",
      "testing-regression",
      "testing-taskflow",
    ]);
    for (const lesson of publishedLessons ?? []) {
      expect(lesson.blocks.some((block) => block.type === "reading")).toBe(true);
      expect(lesson.blocks.some((block) => block.type === "check_question")).toBe(true);
      expect(recapPracticePrompt(lesson.blocks)).toEqual(expect.any(String));
      expect(lesson.concepts.filter((link) => link.role === "primary").length).toBeLessThanOrEqual(
        2,
      );
    }

    const links = publishedLessons?.find((lesson) => lesson.slug === "links-and-attributes");
    expect(lessonHasHarderCheck(links?.blocks ?? [])).toBe(true);
    expect(
      backend?.modules.every((module) =>
        module.lessons.every((lesson) => lesson.status === "draft"),
      ),
    ).toBe(true);
  });
});
