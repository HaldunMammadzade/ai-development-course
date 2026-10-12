export type AchievementCategory = "learning" | "skill" | "practice" | "project" | "interview";

export type AchievementState = "earned" | "locked";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  state: AchievementState;
  earnedAt: string | null;
}

export interface AchievementList {
  items: Achievement[];
  earnedCount: number;
  latest: Achievement | null;
}
