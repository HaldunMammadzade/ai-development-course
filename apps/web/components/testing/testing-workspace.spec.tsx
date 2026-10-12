import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { copy } from "@/lib/copy";
import { TestingWorkspace } from "./testing-workspace";

vi.mock("@/components/exercises/exercise-board", () => ({
  ExerciseBoard: () => createElement("p", null, "məşq açıqdır"),
}));

describe("testing workspace", () => {
  it("keeps the workflow readable and does not claim a test run", () => {
    const html = renderToStaticMarkup(
      createElement(TestingWorkspace, {
        lessons: [
          { slug: "testing-why", availability: "practice" },
          { slug: "testing-assertions", availability: "locked" },
        ],
        active: {
          slug: "testing-why",
          title: "Niyə test yazırıq",
          objective: "Testin vəd edilən davranışı yoxladığını izah etmək.",
          availability: "practice",
        },
        reading: ["Test vədi yoxlayır.", "expect(add(2, 3)).toBe(5);"],
        exercises: [
          {
            id: "exercise-1",
            slug: "testing-why-purpose",
            lessonSlug: "testing-why",
            title: "Testin vəzifəsi",
            prompt: "Testin əsas vəzifəsi hansıdır?",
            instructions: "Seç.",
            type: "multiple_choice",
            language: null,
            difficulty: "beginner",
            starterCode: null,
            options: [{ id: "check-behavior", label: "Vəd edilən davranışı yoxlamaq" }],
            executionAvailable: false,
          },
        ],
      }),
    );
    expect(html).toContain("flex-col");
    expect(html).toContain("lg:flex-row");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("expect(add(2, 3)).toBe(5);");
    expect(html).toContain(copy.testing.sandbox);
    expect(html).toContain(copy.testing.statePractice);
    expect(html).toContain(copy.testing.stateLocked);
    expect(html).toContain("məşq açıqdır");
    expect(html).not.toContain("npm test");
  });
});
