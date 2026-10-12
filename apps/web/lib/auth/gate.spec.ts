import { describe, expect, it } from "vitest";
import { appGate } from "./gate";

describe("protected route gate", () => {
  it("sends anonymous students to login and unverified students to verification", () => {
    expect(appGate(null)).toBe("login");
    expect(appGate({ emailVerified: false })).toBe("verify");
    expect(appGate({ emailVerified: true })).toBe("app");
  });
});
