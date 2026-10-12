import { studentCalendarDay } from "./time";

export interface TeacherQuotaUsage {
  activityDate: string;
  teacherTurns: number;
}

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

export function assessTeacherQuota(input: {
  now: Date;
  timeZone: string;
  dailyLimit: number;
  monthlyLimit: number;
  usage: readonly TeacherQuotaUsage[];
}): { allowed: true } | { allowed: false; scope: "day" | "month" } {
  const today = studentCalendarDay(input.now, input.timeZone);
  const month = today.slice(0, 7);
  let daily = 0;
  let monthly = 0;
  for (const row of input.usage) {
    if (!CALENDAR_DAY.test(row.activityDate) || !Number.isFinite(row.teacherTurns)) {
      continue;
    }
    if (row.activityDate === today) {
      daily += row.teacherTurns;
    }
    if (row.activityDate.slice(0, 7) === month) {
      monthly += row.teacherTurns;
    }
  }
  if (daily >= input.dailyLimit) {
    return { allowed: false, scope: "day" };
  }
  if (monthly >= input.monthlyLimit) {
    return { allowed: false, scope: "month" };
  }
  return { allowed: true };
}

export const TEACHING_BURST_LIMIT = 20;

export const TEACHING_BURST_WINDOW_MS = 10 * 60 * 1000;

export function assessTeachingBurst(input: {
  successfulTurns: number;
  reservedTurns: number;
  limit?: number;
}): { allowed: true } | { allowed: false } {
  const limit = input.limit ?? TEACHING_BURST_LIMIT;
  if (input.successfulTurns + input.reservedTurns >= limit) {
    return { allowed: false };
  }
  return { allowed: true };
}

export const AUTH_RATE_LIMITS = {
  register: { ip: 200, account: 5, windowMs: 15 * 60 * 1000 },
  login: { ip: 400, account: 20, windowMs: 15 * 60 * 1000 },
  password_reset: { ip: 100, account: 5, windowMs: 60 * 60 * 1000 },
} as const;

export type AuthRateAction = keyof typeof AUTH_RATE_LIMITS;

export function authRateWindowStart(now: Date, windowMs: number): Date {
  const width = Math.max(1, Math.floor(windowMs));
  return new Date(Math.floor(now.getTime() / width) * width);
}

export function authRateAllowed(hits: number, limit: number): boolean {
  return hits <= limit;
}

export function assessStrongModelQuota(input: {
  successfulCalls: number;
  reservedCalls: number;
  limit: number;
}): { allowed: true } | { allowed: false } {
  if (input.successfulCalls + input.reservedCalls >= input.limit) {
    return { allowed: false };
  }
  return { allowed: true };
}
