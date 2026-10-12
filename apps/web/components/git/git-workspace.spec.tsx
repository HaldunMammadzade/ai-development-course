import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { copy } from "@/lib/copy";
import { GitWorkspace } from "./git-workspace";

vi.mock("@/components/exercises/exercise-board", () => ({
  ExerciseBoard: () => createElement("p", null, "məşq açıqdır"),
}));

describe("git workspace", () => {
  it("stacks the workflow and keeps a locked step in words", () => {
    const html = renderToStaticMarkup(
      createElement(GitWorkspace, {
        lessons: [
          { slug: "git-repository", availability: "practice" },
          { slug: "git-changes", availability: "locked" },
        ],
        active: {
          slug: "git-repository",
          title: "Repository və iş ağacı",
          objective: "Tarixçəni cari fayllardan ayırd etmək.",
          availability: "practice",
        },
        reading: ["Repository tarixçəni saxlayır."],
        exercises: [
          {
            id: "exercise-1",
            slug: "git-repository-identify",
            lessonSlug: "git-repository",
            title: "Nə repository-dir",
            prompt: "Hansı repository-dir?",
            instructions: "Bir variant seç.",
            type: "multiple_choice",
            language: null,
            difficulty: "beginner",
            starterCode: null,
            options: [],
            executionAvailable: false,
          },
        ],
      }),
    );
    expect(html).toContain("flex-col");
    expect(html).toContain("lg:flex-row");
    expect(html).toContain("Git &amp; GitHub");
    expect(html).toContain(copy.git.sandbox);
    expect(html).toContain(copy.git.statePractice);
    expect(html).toContain(copy.git.stateLocked);
    expect(html).toContain("Repository tarixçəni saxlayır.");
    expect(html).toContain("məşq açıqdır");
    expect(html).not.toContain("GitHub parolu");
    expect(html).not.toContain("token");
  });
});