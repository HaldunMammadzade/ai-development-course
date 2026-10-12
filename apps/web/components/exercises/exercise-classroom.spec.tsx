import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ExerciseView } from "@platform/types";
import { copy } from "@/lib/copy";
import { ExerciseBoard } from "./exercise-board";

const codeExercise: ExerciseView = {
  id: "ex-code",
  slug: "html-link",
  lessonSlug: "html-text",
  title: "Keçid",
  prompt: "Bir keçid yaz.",
  instructions: "href tələb olunan ünvana baxsın.",
  type: "code_text",
  language: "html",
  difficulty: "beginner",
  starterCode: "<script>alert(1)</script>",
  options: [],
  executionAvailable: false,
};

const choiceExercise: ExerciseView = {
  ...codeExercise,
  id: "ex-choice",
  type: "multiple_choice",
  language: null,
  starterCode: null,
  options: [{ id: "option-a", label: "Birinci" }],
};

const webRoot = path.resolve(import.meta.dirname, "../..");

describe("coding classroom markup", () => {
  it("shows starter code as text and does not mount an editor frame for a choice", () => {
    const code = renderToStaticMarkup(createElement(ExerciseBoard, { exercises: [codeExercise] }));
    const again = renderToStaticMarkup(createElement(ExerciseBoard, { exercises: [codeExercise] }));
    expect(code).toBe(again);
    expect(code).toContain("&lt;script&gt;");
    expect(code).not.toContain("<script>");
    expect(code).toContain('data-coding-editor="pending"');
    expect(code).toContain(copy.exercise.reset);
    expect(code).toContain(copy.exercise.noExecution);
    expect(code).toContain("min-w-0");
    expect(code).toContain("overflow-x-hidden");
    expect(code).not.toContain("min-w-[");
    expect(code).not.toContain("iframe");
    expect(code).not.toContain("data-cursor-ref");

    const choice = renderToStaticMarkup(
      createElement(ExerciseBoard, { exercises: [choiceExercise] }),
    );
    expect(choice).not.toContain("data-coding-editor");
    expect(choice).toContain("option-a");
    expect(choice).not.toContain("data-monaco");
  });

  it("keeps Monaco out of the landing, auth, and dashboard pages", () => {
    const pages = [
      "app/page.tsx",
      "app/login/page.tsx",
      "app/register/page.tsx",
      "app/app/(study)/dashboard/page.tsx",
      "components/app-shell/app-shell.tsx",
    ];
    for (const page of pages) {
      const source = readFileSync(path.join(webRoot, page), "utf8");
      expect(source).not.toContain("monaco");
      expect(source).not.toContain("coding-editor");
    }
  });

  it("does not render or execute student code in the classroom sources", () => {
    const directory = import.meta.dirname;
    const sources = readdirSync(directory)
      .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
      .filter((name) => !name.endsWith(".spec.ts") && !name.endsWith(".spec.tsx"))
      .map((name) => readFileSync(path.join(directory, name), "utf8"))
      .join("\n");
    expect(sources).not.toContain("dangerouslySetInnerHTML");
    expect(sources).not.toContain("<iframe");
    expect(sources).not.toContain("eval(");
    expect(sources).not.toContain("new Function");
    expect(sources).not.toContain("child_process");
    expect(sources).not.toContain("WebSocket");
    expect(sources).not.toContain("EventSource");
    const editor = readFileSync(path.join(directory, "coding-editor.tsx"), "utf8");
    expect(editor).toContain('import("./monaco-pane")');
    expect(editor).not.toContain('from "monaco-editor"');
    expect(editor).not.toContain('from "@monaco-editor/react"');
  });
});
