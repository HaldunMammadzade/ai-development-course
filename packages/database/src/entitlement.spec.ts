import { describe, expect, it } from "vitest";
import { parseEntitlements, subscriptionGrantsAccess } from "./entitlement";

describe("entitlements", () => {
  it("keeps free capabilities when the stored object is empty", () => {
    const entitlements = parseEntitlements({});
    expect(entitlements.speaking).toBe(true);
    expect(entitlements.strongModel).toBe(false);
    expect(entitlements.dailySpeakingAttempts).toBe(30);
  });

  it("keeps a paid period until it ends, including a scheduled cancellation", () => {
    const future = new Date(Date.now() + 60_000);
    const past = new Date(Date.now() - 60_000);
    expect(
      subscriptionGrantsAccess({
        status: "canceled",
        cancelAtPeriodEnd: true,
        currentPeriodEnd: future,
        now: new Date(),
      }),
    ).toBe(true);
    expect(
      subscriptionGrantsAccess({
        status: "active",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: past,
        now: new Date(),
      }),
    ).toBe(false);
    expect(
      subscriptionGrantsAccess({
        status: "incomplete",
        cancelAtPeriodEnd: false,
        currentPeriodEnd: future,
        now: new Date(),
      }),
    ).toBe(false);
  });
});
