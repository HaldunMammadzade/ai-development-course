import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { ApiError, friendlyApiMessage, loginFailureMessage } from "./errors";

describe("API error normalization", () => {
  it("hides raw backend text behind Azerbaijani messages", () => {
    expect(friendlyApiMessage(401, "UNAUTHENTICATED")).toBe(copy.errors.unauthenticated);
    expect(friendlyApiMessage(403, "EMAIL_UNVERIFIED")).toBe(copy.errors.unverified);
    expect(friendlyApiMessage(403, "CSRF")).toBe(copy.errors.csrf);
    expect(friendlyApiMessage(404, "NOT_FOUND")).toBe(copy.errors.notFound);
    expect(friendlyApiMessage(409, "SESSION_CLOSED")).toBe(copy.errors.sessionClosed);
    expect(friendlyApiMessage(409, "CONFLICT")).toBe(copy.errors.duplicateEmail);
    expect(friendlyApiMessage(429, "QUOTA_EXCEEDED")).toBe(copy.errors.quota);
    expect(friendlyApiMessage(429, "RATE_LIMITED")).toBe(copy.errors.rate);
    expect(friendlyApiMessage(503, "AI_UNAVAILABLE")).toBe(copy.errors.ai);
    expect(friendlyApiMessage(503, "EXECUTION_UNAVAILABLE")).toBe(copy.errors.execution);
    expect(friendlyApiMessage(503, "EXECUTION_BUSY")).toBe(copy.errors.executionBusy);
    expect(new ApiError(500, "INTERNAL").message).toBe(copy.errors.generic);
    expect(new ApiError(500, "INTERNAL").message).not.toContain("stack");
  });

  it("uses a credential message for a failed login and a quota message without model details", () => {
    expect(loginFailureMessage(new ApiError(401, "UNAUTHENTICATED"))).toBe(
      copy.errors.invalidCredentials,
    );
    expect(loginFailureMessage(new ApiError(403, "EMAIL_UNVERIFIED"))).toBe(copy.errors.unverified);
    expect(friendlyApiMessage(429, "QUOTA_EXCEEDED")).not.toMatch(/strong|model|sql/i);
  });
});
