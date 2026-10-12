import type { ChallengeLevel, ExplanationStyle, Locale, NextAction } from "./learning";

export interface RegisteredStudent {
  id: string;
  email: string;
  name: string | null;
  locale: Locale;
  timezone: string;
  emailVerified: false;
}

export interface SignedInStudent {
  id: string;
  email: string;
  name: string | null;
  locale: Locale;
  timezone: string;
  emailVerified: true;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  locale: Locale;
  timezone: string;
  emailVerified: boolean;
  role: "user" | "admin";
  preferences: {
    explanationStyle: ExplanationStyle;
    challengeLevel: ChallengeLevel;
  } | null;
  plan: {
    code: string;
    dailyTeacherTurns: number;
    monthlyTeacherTurns: number;
  } | null;
  enrollment: {
    pathSlug: string;
    pathTitle: string;
    status: "active" | "paused" | "completed";
  } | null;
  nextAction: NextAction;
}
