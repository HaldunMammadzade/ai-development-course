import { describe, expect, it } from "vitest";
import {
  AUTH_RATE_LIMITS,
  assessStrongModelQuota,
  assessTeacherQuota,
  assessTeachingBurst,
  authRateAllowed,
  authRateWindowStart,
} from "./quota";
import { studentCalendarDay, studentDayInterval } from "./time";

const now = new Date("2026-01-01T10:00:00.000Z");

describe("teacher quota windows", () => {
  it("uses the student timezone for the daily boundary", () => {
    expect(studentCalendarDay(now, "Pacific/Kiritimati")).toBe("2026-01-02");
    expect(studentCalendarDay(now, "Pacific/Pago_Pago")).toBe("2025-12-31");

    const usage = [{ activityDate: "2026-01-02", teacherTurns: 40 }];
    expect(
      assessTeacherQuota({
        now,
        timeZone: "Pacific/Kiritimati",
        dailyLimit: 40,
        monthlyLimit: 600,
        usage,
      }),
    ).toEqual({ allowed: false, scope: "day" });
    expect(
      assessTeacherQuota({
        now,
        timeZone: "Pacific/Pago_Pago",
        dailyLimit: 40,
        monthlyLimit: 600,
        usage,
      }),
    ).toEqual({ allowed: true });
  });

  it("counts a 600-turn month without counting another day's turns as today", () => {
    expect(
      assessTeacherQuota({
        now,
        timeZone: "Pacific/Kiritimati",
        dailyLimit: 40,
        monthlyLimit: 600,
        usage: [{ activityDate: "2026-01-03", teacherTurns: 600 }],
      }),
    ).toEqual({ allowed: false, scope: "month" });
  });
});

describe("teaching burst and strong-model windows", () => {
  it("allows 19 reserved-or-successful turns and rejects the 20th already counted", () => {
    expect(assessTeachingBurst({ successfulTurns: 19, reservedTurns: 0 })).toEqual({
      allowed: true,
    });
    expect(assessTeachingBurst({ successfulTurns: 20, reservedTurns: 0 })).toEqual({
      allowed: false,
    });
    expect(assessTeachingBurst({ successfulTurns: 19, reservedTurns: 1 })).toEqual({
      allowed: false,
    });
  });

  it("bounds the student day for a strong-model count", () => {
    const kiritimati = studentDayInterval(now, "Pacific/Kiritimati");
    expect(kiritimati.start.toISOString()).toBe("2026-01-01T10:00:00.000Z");
    expect(now.getTime()).toBeGreaterThanOrEqual(kiritimati.start.getTime());
    expect(now.getTime()).toBeLessThan(kiritimati.end.getTime());
    const pago = studentDayInterval(now, "Pacific/Pago_Pago");
    expect(studentCalendarDay(pago.start, "Pacific/Pago_Pago")).toBe("2025-12-31");
    expect(now.getTime()).toBeGreaterThanOrEqual(pago.start.getTime());
    expect(now.getTime()).toBeLessThan(pago.end.getTime());
    expect(assessStrongModelQuota({ successfulCalls: 1, reservedCalls: 0, limit: 1 })).toEqual({
      allowed: false,
    });
    expect(assessStrongModelQuota({ successfulCalls: 0, reservedCalls: 0, limit: 0 })).toEqual({
      allowed: false,
    });
  });
});

describe("auth rate windows", () => {
  it("aligns a window and rejects the hit past the account limit", () => {
    const start = authRateWindowStart(now, AUTH_RATE_LIMITS.login.windowMs);
    expect(start.getTime() % AUTH_RATE_LIMITS.login.windowMs).toBe(0);
    expect(start.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(
      authRateAllowed(AUTH_RATE_LIMITS.register.account, AUTH_RATE_LIMITS.register.account),
    ).toBe(true);
    expect(
      authRateAllowed(AUTH_RATE_LIMITS.register.account + 1, AUTH_RATE_LIMITS.register.account),
    ).toBe(false);
  });
});
