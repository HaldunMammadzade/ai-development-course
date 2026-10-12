import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { TeacherComposer } from "./teacher-composer";

describe("teacher composer", () => {
  it("renders a labeled answer field that can be disabled", () => {
    const markup = renderToStaticMarkup(
      createElement(TeacherComposer, {
        disabled: true,
        pending: false,
        onSubmit: () => Promise.resolve(true),
      }),
    );
    expect(markup).toContain(copy.teacher.placeholder);
    expect(markup).toContain('maxLength="2000"');
    expect(markup).toContain("disabled");
  });
});
