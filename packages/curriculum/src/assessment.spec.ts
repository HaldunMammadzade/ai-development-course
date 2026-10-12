import { describe, expect, it } from "vitest";
import {
  acceptedAssessmentAnswer,
  assessmentItems,
  placeAssessment,
  projectAssessmentMastery,
  scoreAssessmentAnswer,
  selectAssessmentItem,
  type AssessmentAnswerMark,
  type AssessmentItem,
  type PlacementLesson,
} from "./assessment";
import { frontendCurriculum } from "./frontend-seed";

const now = new Date("2026-10-08T08:00:00.000Z");

function pathLessons(): PlacementLesson[] {
  const path = frontendCurriculum.paths.find((entry) => entry.slug === "frontend");
  if (path === undefined) {
    throw new Error("Frontend path is missing.");
  }
  return path.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      id: lesson.slug,
      slug: lesson.slug,
      title: lesson.title,
      moduleSlug: module.slug,
      moduleTitle: module.title,
      modulePosition: module.position,
      lessonPosition: lesson.position,
      status: lesson.status,
      primaryConceptSlugs: lesson.concepts
        .filter((link) => link.role === "primary")
        .map((link) => link.conceptSlug),
      progress: null,
    })),
  );
}

function answerUntil(
  choose: (item: AssessmentItem, index: number) => "pass" | "fail" | "stop",
): AssessmentAnswerMark[] {
  const answered: AssessmentAnswerMark[] = [];
  for (let index = 0; index < 20; index += 1) {
    const next = selectAssessmentItem(answered);
    if (next === null) {
      break;
    }
    const choice = choose(next, index);
    if (choice === "stop") {
      break;
    }
    const submission = choice === "pass" ? acceptedAssessmentAnswer(next) : "yanlis";
    answered.push({
      itemId: next.id,
      passed: scoreAssessmentAnswer(next, submission).passed,
    });
  }
  return answered;
}

function placed(answered: AssessmentAnswerMark[]) {
  const mastery = projectAssessmentMastery({
    answers: answered.map((entry, index) => ({ ...entry, at: new Date(now.getTime() + index) })),
    now,
    timeZone: "UTC",
  });
  return {
    mastery,
    placement: placeAssessment({
      lessons: pathLessons(),
      prerequisites: frontendCurriculum.prerequisites,
      mastery,
    }),
  };
}

describe("initial skill assessment", () => {
  it("scores a choice, a short answer, and code without a client score", () => {
    const request = assessmentItems.find((entry) => entry.id === "request");
    const structure = assessmentItems.find((entry) => entry.id === "structure");
    const fn = assessmentItems.find((entry) => entry.id === "function");
    expect(request && scoreAssessmentAnswer(request, "option-a").passed).toBe(true);
    expect(request && scoreAssessmentAnswer(request, "option-b").passed).toBe(false);
    expect(structure && scoreAssessmentAnswer(structure, "main").passed).toBe(true);
    expect(fn && scoreAssessmentAnswer(fn, "function add(a, b) { return a + b }").passed).toBe(true);
    expect(fn && scoreAssessmentAnswer(fn, "yalniz").passed).toBe(false);
  });

  it("places a beginner at the first lesson and leaves later concepts unknown", () => {
    const answered = answerUntil(() => "fail");
    expect(answered.map((entry) => entry.itemId)).toEqual(["request", "request-again"]);
    const { mastery, placement } = placed(answered);
    expect(placement.start?.slug).toBe("how-the-web-delivers-a-page");
    expect(placement.label).toBe("Başlanğıc");
    expect(placement.lessonIdsToComplete).toEqual([]);
    expect(mastery.get("web.http")?.evidenceCount).toBe(2);
    expect(mastery.get("web.http")?.score).toBeLessThan(45);
    expect(mastery.has("react.component")).toBe(false);
    expect(mastery.has("next.app-router")).toBe(false);
  });

  it("moves a strong HTML and CSS profile to the first JavaScript lesson", () => {
    const answered = answerUntil((item) => (item.domain === "javascript" ? "fail" : "pass"));
    const { mastery, placement } = placed(answered);
    expect(placement.start?.slug).toBe("js-basics");
    expect(placement.label).toBe("Orta səviyyə");
    expect(placement.lessonIdsToComplete).not.toContain("js-basics");
    expect(mastery.get("css.responsive")?.score).toBeGreaterThanOrEqual(60);
    expect(mastery.has("ts.primitive")).toBe(false);
    expect(mastery.has("react.component")).toBe(false);
  });

  it("keeps a strong JavaScript profile behind an unassessed JavaScript lesson", () => {
    const answered = answerUntil((item) => (item.domain === "typescript" ? "stop" : "pass"));
    const { mastery, placement } = placed(answered);
    expect(selectAssessmentItem(answered)?.domain).toBe("typescript");
    expect(placement.start?.slug).toBe("js-basics");
    expect(mastery.get("js.function")?.score).toBeGreaterThanOrEqual(60);
    expect(mastery.has("ts.primitive")).toBe(false);
    expect(mastery.has("web.javascript")).toBe(false);
  });

  it("records React evidence without skipping the unassessed JavaScript lesson", () => {
    const answered = answerUntil(() => "pass");
    const { mastery, placement } = placed(answered);
    expect(answered.some((entry) => entry.itemId === "react")).toBe(true);
    expect(answered.some((entry) => entry.itemId === "next")).toBe(true);
    expect(placement.start?.slug).toBe("js-basics");
    expect(placement.lessonIdsToComplete).not.toContain("components-and-props");
    expect(mastery.get("react.component")?.score).toBeGreaterThanOrEqual(60);
    expect(mastery.get("next.app-router")?.score).toBeGreaterThanOrEqual(60);
    expect(mastery.has("web.javascript")).toBe(false);
  });

  it("bases a mixed profile on the first weak prerequisite, not a later strength", () => {
    const answered = answerUntil((item) =>
      item.domain === "html" || item.domain === "css" ? "pass" : "fail",
    );
    const { mastery, placement } = placed(answered);
    expect(placement.start?.slug).toBe("js-basics");
    expect(mastery.get("html.semantic")?.score).toBeGreaterThanOrEqual(60);
    expect(mastery.get("js.function")?.score).toBeLessThan(60);
    expect(mastery.has("next.app-router")).toBe(false);
  });

  it("does not place a student from one answer or from an unassessed concept", () => {
    expect(selectAssessmentItem([])?.id).toBe("request");
    const open = placed([]);
    expect(open.placement.start?.slug).toBe("how-the-web-delivers-a-page");
    expect(open.placement.lessonIdsToComplete).toEqual([]);
    const partial = answerUntil((_item, index) => (index === 0 ? "pass" : "stop"));
    expect(selectAssessmentItem(partial)?.id).toBe("url");
    const { mastery, placement } = placed(partial);
    expect(placement.lessonIdsToComplete).toContain("how-the-web-delivers-a-page");
    expect(placement.start?.slug).toBe("what-a-url-is");
    expect(mastery.has("web.url")).toBe(false);
    expect(mastery.has("react.state")).toBe(false);
  });
});
