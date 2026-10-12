import { describe, expect, it } from "vitest";
import { speakingLogLine, speakingUsageCorrelation } from "./speaking-log";

describe("speaking usage correlation", () => {
  it("keeps a supplied attempt correlation and does not invent one", () => {
    const attemptId = "8d2c1b0a-1111-4222-8333-444455556666";

    expect(speakingUsageCorrelation(attemptId, "speaking")).toBe(attemptId);
    expect(speakingUsageCorrelation(attemptId, "scripted")).toBe(attemptId);
  });

  it("uses the existing static fallback only when no attempt correlation is present", () => {
    expect(speakingUsageCorrelation("", "speaking")).toBe("speaking");
    expect(speakingUsageCorrelation("   ", "scripted")).toBe("scripted");
    expect(speakingUsageCorrelation(null, "speaking")).toBe("speaking");
    expect(speakingUsageCorrelation(undefined, "scripted")).toBe("scripted");
    expect(speakingUsageCorrelation("", "speaking")).not.toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

describe("speaking diagnostic line", () => {
  it("prints the request correlation and the persisted attempt id as different fields", () => {
    const correlationId = "11111111-1111-4111-8111-111111111111";
    const speakingAttemptId = "22222222-2222-4222-8222-222222222222";
    const line = speakingLogLine({
      correlationId,
      speakingAttemptId,
      status: "completed",
      durationMs: 12,
    });

    expect(line).toBe(
      `speaking correlation=${correlationId} speaking_attempt_id=${speakingAttemptId} status=completed durationMs=12`,
    );
    expect(line).toContain(`correlation=${correlationId}`);
    expect(line).toContain(`speaking_attempt_id=${speakingAttemptId}`);
    expect(correlationId).not.toBe(speakingAttemptId);
  });

  it("omits the attempt id when the repository has not created one", () => {
    const correlationId = "33333333-3333-4333-8333-333333333333";
    const secret = "sk-log-secret";

    for (const speakingAttemptId of [undefined, null, "", "   "]) {
      const line = speakingLogLine({
        correlationId,
        speakingAttemptId,
        status: "speech-unavailable",
        durationMs: 4,
        detail: "category=unknown http_status=null",
      });
      expect(line).toBe(
        `speaking correlation=${correlationId} status=speech-unavailable durationMs=4 category=unknown http_status=null`,
      );
      expect(line).not.toContain("speaking_attempt_id=");
      expect(line).not.toContain(secret);
    }
  });
});
