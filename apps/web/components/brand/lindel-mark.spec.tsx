import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LindelMark } from "./lindel-mark";

describe("Lindel mark", () => {
  it("uses the Step geometry and does not add a third bar", () => {
    const html = renderToStaticMarkup(createElement(LindelMark, { className: "size-6" }));
    expect(html).toContain('viewBox="0 0 16 16"');
    expect(html).toContain('x="2" y="5" width="7" height="2"');
    expect(html).toContain('x="2" y="9" width="12" height="2"');
    expect(html.match(/<rect /g)).toHaveLength(2);
  });
});
