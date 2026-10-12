import { describe, expect, it } from "vitest";
import {
  calculateMastery,
  clampCheckEvidence,
  confidenceLevel,
  evidenceWeight,
  homeworkDoneUpdate,
  isWeak,
  masteryBand,
  selectSkillUpdates,
  type MasteryEvent,
} from "./mastery";

const NOW = new Date("2026-03-01T12:00:00.000Z");

function event(id: string, evidence: number, weight: number, occurredAt: string): MasteryEvent {
  return { id, evidence, weight, occurredAt: new Date(occurredAt) };
}

describe("calculateMastery", () => {
  it("returns no projection when there are zero events", () => {
    expect(calculateMastery({ events: [], now: NOW, timeZone: "UTC" })).toBeNull();
    expect(isWeak(null)).toBe(false);
  });

  it("uses only the latest 20 events for the score and counts every event", () => {
    const older = Array.from({ length: 5 }, (_, index) =>
      event(`old-${index}`, 0, 1, `2026-01-0${index + 1}T00:00:00.000Z`),
    );
    const latest = Array.from({ length: 20 }, (_, index) =>
      event(`new-${index}`, 80, 1, `2026-02-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
    );

    const projection = calculateMastery({
      events: [...older, ...latest],
      now: NOW,
      timeZone: "UTC",
    });

    expect(projection?.score).toBe(80);
    expect(projection?.evidenceCount).toBe(25);
    expect(projection?.lastEvidenceAt.toISOString()).toBe("2026-02-20T00:00:00.000Z");
  });

  it("applies the 21-day decay in the student timezone", () => {
    const decayed = calculateMastery({
      events: [
        event("old", 0, 1, "2026-01-01T12:00:00.000Z"),
        event("fresh", 100, 1, "2026-01-22T12:00:00.000Z"),
      ],
      now: new Date("2026-01-22T12:00:00.000Z"),
      timeZone: "UTC",
    });
    expect(decayed?.score).toBe(73);

    const edge = "2026-01-01T21:00:00.000Z";
    const now = "2026-01-02T19:00:00.000Z";
    const baku = calculateMastery({
      events: [event("old", 0, 1, edge), event("fresh", 100, 1, now)],
      now: new Date(now),
      timeZone: "Asia/Baku",
    });
    const utc = calculateMastery({
      events: [event("old", 0, 1, edge), event("fresh", 100, 1, now)],
      now: new Date(now),
      timeZone: "UTC",
    });
    expect(baku?.score).toBe(50);
    expect(utc?.score).toBe(51);
  });

  it("weights an incorrect check more heavily than a correct one", () => {
    const projection = calculateMastery({
      events: [
        event(
          "correct",
          100,
          evidenceWeight("lesson_check", "correct"),
          "2026-03-01T00:00:00.000Z",
        ),
        event(
          "incorrect",
          0,
          evidenceWeight("lesson_check", "incorrect"),
          "2026-03-01T01:00:00.000Z",
        ),
      ],
      now: NOW,
      timeZone: "UTC",
    });
    expect(projection?.score).toBe(45);
    expect(evidenceWeight("homework", "done")).toBe(1);
    expect(homeworkDoneUpdate()).toEqual({ evidence: 80, weight: 1 });
  });

  it("does not call one event under 45 weak", () => {
    const projection = calculateMastery({
      events: [event("only", 20, 1, "2026-03-01T00:00:00.000Z")],
      now: NOW,
      timeZone: "UTC",
    });
    expect(projection?.score).toBe(20);
    expect(projection?.evidenceCount).toBe(1);
    expect(projection?.band).toBeNull();
    expect(isWeak(projection)).toBe(false);
  });

  it("marks two events under 45 as weak", () => {
    const projection = calculateMastery({
      events: [
        event("a", 20, 1, "2026-03-01T00:00:00.000Z"),
        event("b", 20, 1, "2026-03-01T01:00:00.000Z"),
      ],
      now: NOW,
      timeZone: "UTC",
    });
    expect(masteryBand(projection?.score ?? 0, projection?.evidenceCount ?? 0)).toBe("weak");
    expect(isWeak(projection)).toBe(true);
  });

  it("assigns confidence from the full evidence count", () => {
    expect(confidenceLevel(2)).toBe("low");
    expect(confidenceLevel(3)).toBe("medium");
    expect(confidenceLevel(7)).toBe("medium");
    expect(confidenceLevel(8)).toBe("high");
    expect(masteryBand(59, 3)).toBe("fragile");
    expect(masteryBand(60, 3)).toBe("working");
    expect(masteryBand(80, 3)).toBe("strong");
  });
});

describe("check evidence", () => {
  it("clamps a proposed value into the understanding band", () => {
    expect(clampCheckEvidence("correct", 140)).toBe(100);
    expect(clampCheckEvidence("correct", 10)).toBe(80);
    expect(clampCheckEvidence("partial", 90)).toBe(75);
    expect(clampCheckEvidence("partial", 10)).toBe(45);
    expect(clampCheckEvidence("incorrect", 90)).toBe(40);
    expect(clampCheckEvidence("incorrect", -5)).toBe(0);
  });

  it("discards slugs outside the lesson and keeps at most three updates", () => {
    const updates = selectSkillUpdates(
      [
        { conceptSlug: "web.http", understanding: "correct", evidence: 50 },
        { conceptSlug: "web.http", understanding: "incorrect", evidence: 10 },
        { conceptSlug: "other.topic", understanding: "correct", evidence: 100 },
        { conceptSlug: "web.url", understanding: "partial", evidence: 10 },
        { conceptSlug: "web.browser", understanding: "incorrect", evidence: 70 },
        { conceptSlug: "html.text", understanding: "correct", evidence: 90 },
      ],
      new Set(["web.http", "web.url", "web.browser", "html.text"]),
    );

    expect(updates.map((item) => item.conceptSlug)).toEqual(["web.http", "web.url", "web.browser"]);
    expect(updates[0]).toMatchObject({ evidence: 80, weight: 1 });
    expect(updates[1]).toMatchObject({ evidence: 45, weight: 1 });
    expect(updates[2]).toMatchObject({ evidence: 40, weight: 1.2 });
  });
});
