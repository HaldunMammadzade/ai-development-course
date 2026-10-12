import { describe, expect, it } from "vitest";
import { selectTeacherMemory } from "./memory-selection";

const lesson = new Set(["web.http"]);
const weak = new Set<string>();

describe("teacher memory selection", () => {
  it("keeps at most three notes, weakness then preference then in-scope learning", () => {
    const selected = selectTeacherMemory({
      notes: [
        {
          category: "learning",
          conceptSlug: "web.http",
          content: "Sorğunu izah edir.",
          createdAt: new Date("2026-03-03T00:00:00.000Z"),
        },
        {
          category: "preference",
          conceptSlug: null,
          content: "Qısa nümunə istəyir.",
          createdAt: new Date("2026-03-02T00:00:00.000Z"),
        },
        {
          category: "mistake",
          conceptSlug: "html.forms",
          content: "Başqa mövzu.",
          createdAt: new Date("2026-03-04T00:00:00.000Z"),
        },
        {
          category: "mistake",
          conceptSlug: "web.http",
          content: "Cavabı sorğu sandı.",
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
        },
        {
          category: "skill",
          conceptSlug: "web.http",
          content: "Ignored category.",
          createdAt: new Date("2026-03-05T00:00:00.000Z"),
        },
      ],
      lessonConceptSlugs: lesson,
      weakConceptSlugs: weak,
    });
    expect(selected.map((note) => note.content)).toEqual([
      "Cavabı sorğu sandı.",
      "Qısa nümunə istəyir.",
      "Sorğunu izah edir.",
    ]);
  });

  it("drops notes outside the lesson and strips markup", () => {
    const selected = selectTeacherMemory({
      notes: [
        {
          category: "learning",
          conceptSlug: "html.forms",
          content: "<script>alert(1)</script>Kənar qeyd",
          createdAt: new Date("2026-03-01T00:00:00.000Z"),
        },
      ],
      lessonConceptSlugs: lesson,
      weakConceptSlugs: weak,
    });
    expect(selected).toEqual([]);
  });
});
