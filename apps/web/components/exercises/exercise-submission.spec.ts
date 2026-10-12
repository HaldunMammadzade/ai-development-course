import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExerciseSubmission } from "./exercise-submission";

describe("exercise submission rendering", () => {
  it("shows the student submission as escaped text", () => {
    const html = renderToStaticMarkup(
      createElement(ExerciseSubmission, { submission: "<script>alert(1)</script>" }),
    );
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
});
