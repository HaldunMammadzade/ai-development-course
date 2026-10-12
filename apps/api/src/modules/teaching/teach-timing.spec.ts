import { describe, expect, it } from "vitest";
import { elapsedMs, teachTimingEvent } from "./teach-timing";

describe("teach timing event", () => {
  it("keeps durations non-negative and omits sensitive fields", () => {
    expect(elapsedMs(10, 25)).toBe(15);
    expect(elapsedMs(25, 10)).toBe(0);
    expect(elapsedMs(Number.NaN, 10)).toBe(0);

    const event = teachTimingEvent({
      correlationId: "teach-timing-1",
      outcome: "success",
      error: null,
      httpStatus: null,
      schemaIssues: [],
      provider: "fake",
      model: "teach-test",
      prepareMs: 0,
      promptMs: 7,
      providerMs: 107,
      commitMs: null,
      totalMs: 114,
    });

    expect(event).toEqual({
      event: "teach_timing",
      correlationId: "teach-timing-1",
      outcome: "success",
      error: null,
      http_status: null,
      schema_issues: [],
      provider: "fake",
      model: "teach-test",
      prepare_ms: 0,
      prompt_ms: 7,
      provider_ms: 107,
      commit_ms: null,
      total_ms: 114,
    });
    expect(JSON.stringify(event)).not.toContain("speech");
    expect(JSON.stringify(event)).not.toContain("system");
    expect(Object.keys(event).sort()).toEqual([
      "commit_ms",
      "correlationId",
      "error",
      "event",
      "http_status",
      "model",
      "outcome",
      "prepare_ms",
      "prompt_ms",
      "provider",
      "provider_ms",
      "schema_issues",
      "total_ms",
    ]);
  });
});
