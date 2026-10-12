import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { TeacherMessage } from "./teacher-message";

describe("teacher message rendering", () => {
  it("shows teacher and student speech as text, including markup characters", () => {
    const teacher = renderToStaticMarkup(
      createElement(TeacherMessage, {
        role: "teacher",
        speech: "Salam.\n<script>alert(1)</script>",
      }),
    );
    const student = renderToStaticMarkup(
      createElement(TeacherMessage, { role: "student", speech: "Məncə serverə gedir." }),
    );

    expect(teacher).toContain(copy.teacher.label);
    expect(teacher).toContain("&lt;script&gt;");
    expect(teacher).not.toContain("<script>");
    expect(student).toContain(copy.teacher.studentLabel);
    expect(student).toContain("Məncə serverə gedir.");
  });
});
