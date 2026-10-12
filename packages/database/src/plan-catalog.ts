import type { PlanCode } from "./generated/prisma/client";
import type { PlanEntitlements } from "./entitlement";
import { FREE_ENTITLEMENTS } from "./entitlement";

export interface PlanSeed {
  code: PlanCode;
  name: string;
  description: string;
  monthlyPriceMinor: number;
  dailyTeacherTurns: number;
  monthlyTeacherTurns: number;
  dailyStrongCalls: number;
  entitlements: PlanEntitlements;
  priceSlug: string;
  providerPriceId: string | null;
}

const starter: PlanEntitlements = {
  ...FREE_ENTITLEMENTS,
  strongModel: true,
  dailyCodeReviews: 80,
  dailySpeakingAttempts: 60,
  dailySpeakingAi: 40,
  dailyTranscriptions: 40,
  dailyInterviews: 4,
  weeklyInterviewStarts: 20,
  interviewAiCalls: 40,
};

const pro: PlanEntitlements = {
  ...starter,
  dailyCodeReviews: 200,
  dailySpeakingAttempts: 120,
  dailySpeakingAi: 80,
  dailyTranscriptions: 80,
  dailyInterviews: 8,
  weeklyInterviewStarts: 40,
  interviewAiCalls: 60,
};

const premium: PlanEntitlements = {
  ...pro,
  dailyCodeReviews: 400,
  dailySpeakingAttempts: 200,
  dailySpeakingAi: 150,
  dailyTranscriptions: 150,
  dailyInterviews: 12,
  weeklyInterviewStarts: 60,
  interviewAiCalls: 100,
};

export const PLAN_CATALOG: readonly PlanSeed[] = [
  {
    code: "free",
    name: "Free",
    description: "Dərslər, məhdud müəllim və əsas məşqlər.",
    monthlyPriceMinor: 0,
    dailyTeacherTurns: 40,
    monthlyTeacherTurns: 600,
    dailyStrongCalls: 0,
    entitlements: FREE_ENTITLEMENTS,
    priceSlug: "free-monthly",
    providerPriceId: null,
  },
  {
    code: "starter",
    name: "Starter",
    description: "Daha çox müəllim vaxtı, məhdud güclü model və danışıq.",
    monthlyPriceMinor: 990,
    dailyTeacherTurns: 120,
    monthlyTeacherTurns: 2_000,
    dailyStrongCalls: 5,
    entitlements: starter,
    priceSlug: "starter-monthly",
    providerPriceId: "price_starter_month",
  },
  {
    code: "pro",
    name: "Pro",
    description: "Yüksək AI limiti, layihə, müsahibə və danışıq.",
    monthlyPriceMinor: 1_990,
    dailyTeacherTurns: 300,
    monthlyTeacherTurns: 6_000,
    dailyStrongCalls: 30,
    entitlements: pro,
    priceSlug: "pro-monthly",
    providerPriceId: "price_pro_month",
  },
  {
    code: "premium",
    name: "Premium",
    description: "Ən yüksək AI, icra və məşq limitləri.",
    monthlyPriceMinor: 3_490,
    dailyTeacherTurns: 600,
    monthlyTeacherTurns: 12_000,
    dailyStrongCalls: 80,
    entitlements: premium,
    priceSlug: "premium-monthly",
    providerPriceId: "price_premium_month",
  },
];
