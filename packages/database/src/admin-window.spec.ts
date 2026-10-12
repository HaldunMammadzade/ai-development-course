import { describe, expect, it } from "vitest";
import {
  adminWindowRange,
  buildFunnel,
  conversionRate,
  rankLessons,
  type FunnelCounts,
} from "./admin-window";

const empty: FunnelCounts = {
  registered: 0,
  verified: 0,
  firstLesson: 0,
  firstCompletedLesson: 0,
  firstTeacherTurn: 0,
  firstExercise: 0,
  exerciseAfterCompletedLesson: 0,
  firstPassingExercise: 0,
  firstProject: 0,
  completedProject: 0,
  firstInterview: 0,
  completedInterview: 0,
  speakingStarted: 0,
  speakingFinished: 0,
  paid: 0,
  planned: 0,
};

describe("admin windows", () => {
  it("uses Asia/Baku calendar days and does not include tomorrow", () => {
    const now = new Date("2026-10-07T20:30:00.000Z");
    const today = adminWindowRange("today", now);
    expect(today.timeZone).toBe("Asia/Baku");
    expect(today.from.toISOString()).toBe("2026-10-07T20:00:00.000Z");
    expect(today.to).toBe(now);
    expect(adminWindowRange("7d", now).from.toISOString()).toBe("2026-10-01T20:00:00.000Z");
    expect(adminWindowRange("30d", now).from.toISOString()).toBe("2026-09-08T20:00:00.000Z");
  });

  it("returns null instead of dividing by zero", () => {
    expect(conversionRate(1, 0)).toBeNull();
    expect(conversionRate(0, 0)).toBeNull();
    const steps = buildFunnel(empty);
    expect(steps.every((step) => step.rate === null)).toBe(true);
    expect(buildFunnel({ ...empty, registered: 4, verified: 1 })[0]).toEqual({
      id: "registered_to_verified",
      numerator: 1,
      denominator: 4,
      rate: 25,
    });
  });

  it("ranks published lessons without treating an unstarted lesson as hard", () => {
    expect(
      rankLessons([
        { slug: "none", starts: 0, completions: 0 },
        { slug: "easy", starts: 10, completions: 9 },
        { slug: "hard", starts: 10, completions: 1 },
      ]),
    ).toEqual({
      easiest: ["easy", "hard"],
      hardest: ["hard", "easy"],
      highestDropOff: ["hard", "easy"],
    });
  });
});
