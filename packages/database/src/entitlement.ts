import type { Prisma } from "./generated/prisma/client";

export interface PlanEntitlements {
  codeReview: boolean;
  projects: boolean;
  interviews: boolean;
  speaking: boolean;
  sandbox: boolean;
  strongModel: boolean;
  dailyCodeReviews: number;
  dailySpeakingAttempts: number;
  dailySpeakingAi: number;
  dailyTranscriptions: number;
  dailyInterviews: number;
  weeklyInterviewStarts: number;
  interviewAiCalls: number;
}

export const FREE_ENTITLEMENTS: PlanEntitlements = {
  codeReview: true,
  projects: true,
  interviews: true,
  speaking: true,
  sandbox: true,
  strongModel: false,
  dailyCodeReviews: 40,
  dailySpeakingAttempts: 30,
  dailySpeakingAi: 20,
  dailyTranscriptions: 20,
  dailyInterviews: 2,
  weeklyInterviewStarts: 10,
  interviewAiCalls: 30,
};

const FLAGS = [
  "codeReview",
  "projects",
  "interviews",
  "speaking",
  "sandbox",
  "strongModel",
] as const;

const COUNTS = [
  "dailyCodeReviews",
  "dailySpeakingAttempts",
  "dailySpeakingAi",
  "dailyTranscriptions",
  "dailyInterviews",
  "weeklyInterviewStarts",
  "interviewAiCalls",
] as const;

export type EntitlementFeature = (typeof FLAGS)[number];

export function parseEntitlements(value: Prisma.JsonValue | null | undefined): PlanEntitlements {
  const record = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
  const entitlements = { ...FREE_ENTITLEMENTS };
  for (const flag of FLAGS) {
    const candidate = record[flag];
    if (typeof candidate === "boolean") {
      entitlements[flag] = candidate;
    }
  }
  for (const count of COUNTS) {
    const candidate = record[count];
    if (typeof candidate === "number" && Number.isInteger(candidate) && candidate >= 0) {
      entitlements[count] = candidate;
    }
  }
  return entitlements;
}

export function entitlementRank(code: string): number {
  if (code === "starter") {
    return 1;
  }
  if (code === "pro") {
    return 2;
  }
  if (code === "premium") {
    return 3;
  }
  return 0;
}

export function subscriptionGrantsAccess(input: {
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  now: Date;
}): boolean {
  if (input.currentPeriodEnd !== null && input.currentPeriodEnd.getTime() <= input.now.getTime()) {
    return false;
  }
  return (
    input.status === "active" ||
    input.status === "trialing" ||
    input.status === "past_due" ||
    input.status === "canceled"
  );
}
