import { describe, expect, it } from "vitest";
import { httpLog } from "./request-log";

describe("request logs", () => {
  it("keeps a fixed field set and redacts an unsafe path", () => {
    const line = httpLog({
      correlationId: "lesson-123",
      path: "/api/v1/health",
      method: "GET",
      status: 200,
      durationMs: 4,
      now: new Date("2026-10-07T10:00:00.000Z"),
    });
    expect(Object.keys(line).sort()).toEqual([
      "correlationId",
      "durationMs",
      "event",
      "level",
      "method",
      "route",
      "service",
      "status",
      "timestamp",
    ]);
    expect(JSON.stringify(line)).not.toMatch(/password|cookie|authorization|token/i);
    expect(
      httpLog({
        correlationId: "lesson-123",
        path: "/reset-password?token=secret",
        method: "GET",
        status: 200,
        durationMs: 1,
      }).route,
    ).toBe("/redacted");
  });
});
