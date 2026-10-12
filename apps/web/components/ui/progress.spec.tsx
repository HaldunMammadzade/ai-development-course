import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Progress } from "./progress";

describe("progress track", () => {
  it("is a left-aligned rectangular meter", () => {
    const html = renderToStaticMarkup(
      createElement(Progress, { value: 40, label: "React", valueText: "40%" }),
    );
    expect(html).toContain('role="meter"');
    expect(html).toContain('aria-valuenow="40"');
    expect(html).toContain("width:40%");
    expect(html).not.toContain("rounded-full");
  });
});
