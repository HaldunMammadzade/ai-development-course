import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AssessmentView } from "@platform/types";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));
import { AssessmentScreen } from "./assessment-screen";
import { copy } from "@/lib/copy";

const question: AssessmentView = {
  status: "in_progress",
  answered: 4,
  limit: 15,
  item: {
    id: "request",
    kind: "mcq",
    prompt: "Brauzer nə göndərir?",
    options: [
      { id: "option-a", label: "HTTP sorğusu" },
      { id: "option-b", label: "SQL" },
    ],
  },
  previous: { prompt: "Əvvəlki", submission: "SQL", passed: false },
  result: null,
};

describe("assessment screen", () => {
  it("renders the question, progress, and previous control without a score", () => {
    const html = renderToStaticMarkup(createElement(AssessmentScreen, { view: question }));
    expect(html).toContain(copy.assessment.title);
    expect(html).toContain("5 / 15");
    expect(html).toContain("Brauzer nə göndərir?");
    expect(html).toContain("HTTP sorğusu");
    expect(html).toContain('type="radio"');
    expect(html).toContain(copy.assessment.previous);
    expect(html).toContain(copy.assessment.submit);
    expect(html).not.toContain("73%");
    expect(html).not.toContain("Mastery");
  });

  it("renders the placement result and the next lesson link", () => {
    const html = renderToStaticMarkup(
      createElement(AssessmentScreen, {
        view: {
          status: "completed",
          answered: 12,
          limit: 15,
          item: null,
          previous: null,
          result: {
            label: "Orta səviyyə",
            lesson: { slug: "js-basics", title: "JavaScript-in əsası", moduleTitle: "JavaScript" },
            known: [{ name: "HTTP" }],
            gaps: [{ name: "Funksiya", weak: true }],
          },
        },
      }),
    );
    expect(html).toContain(copy.assessment.resultTitle);
    expect(html).toContain("Orta səviyyə");
    expect(html).toContain("JavaScript-in əsası");
    expect(html).toContain(copy.dashboard.weakStatus);
    expect(html).toContain('href="/app/learn/js-basics"');
    expect(html).toContain(copy.assessment.notAssessed);
    expect(html).not.toContain("73%");
  });

  it("uses the live path for the starting point, known topics, and first action", () => {
    const html = renderToStaticMarkup(
      createElement(AssessmentScreen, {
        view: {
          status: "completed",
          answered: 15,
          limit: 15,
          item: null,
          previous: null,
          result: {
            label: "İrəli səviyyə",
            lesson: { slug: "components-and-props", title: "Komponentlər", moduleTitle: "React" },
            known: [{ name: "React" }],
            gaps: [],
          },
        },
        route: {
          note: "Bu mərhələyə keçmək üçün bir əsas mövzu qalıb.",
          current: { slug: "js-basics", title: "JavaScript əsasları", moduleTitle: "JavaScript" },
          next: [{ slug: "js-variables", title: "Dəyişənlər", moduleTitle: "JavaScript" }],
          concepts: [
            { slug: "web.javascript", name: "JavaScript", mark: "current" },
            { slug: "js.function", name: "Funksiya", mark: "known" },
          ],
          known: ["Funksiya"],
        },
      }),
    );
    expect(html).toContain("JavaScript əsasları");
    expect(html).toContain('href="/app/learn/js-basics"');
    expect(html).not.toContain('href="/app/learn/components-and-props"');
    expect(html).toContain("Bu mərhələyə keçmək üçün bir əsas mövzu qalıb.");
    expect(html).toContain("Funksiya");
    expect(html).toContain('aria-current="step"');
    expect(html).not.toContain("REMEDIATE_PREREQUISITE");
  });
});
