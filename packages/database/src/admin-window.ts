export const ADMIN_WINDOWS = ["today", "7d", "30d"] as const;

export type AdminWindow = (typeof ADMIN_WINDOWS)[number];

const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AdminRange {
  from: Date;
  to: Date;
  window: AdminWindow;
  timeZone: "Asia/Baku";
}

export function adminWindowRange(window: AdminWindow, now: Date): AdminRange {
  const shifted = new Date(now.getTime() + BAKU_OFFSET_MS);
  const startOfBakuDay = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  const todayStart = new Date(startOfBakuDay - BAKU_OFFSET_MS);
  const inclusiveDays = window === "today" ? 0 : window === "7d" ? 6 : 29;
  return {
    from: new Date(todayStart.getTime() - inclusiveDays * DAY_MS),
    to: now,
    window,
    timeZone: "Asia/Baku",
  };
}

export function conversionRate(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  const rate = (numerator / denominator) * 100;
  return Math.round(rate * 10) / 10;
}

export interface FunnelCounts {
  registered: number;
  verified: number;
  firstLesson: number;
  firstCompletedLesson: number;
  firstTeacherTurn: number;
  firstExercise: number;
  exerciseAfterCompletedLesson: number;
  firstPassingExercise: number;
  firstProject: number;
  completedProject: number;
  firstInterview: number;
  completedInterview: number;
  speakingStarted: number;
  speakingFinished: number;
  paid: number;
  planned: number;
}

export interface FunnelStep {
  id: string;
  numerator: number;
  denominator: number;
  rate: number | null;
}

export function buildFunnel(counts: FunnelCounts): FunnelStep[] {
  return [
    step("registered_to_verified", counts.verified, counts.registered),
    step("verified_to_first_lesson", counts.firstLesson, counts.verified),
    step("first_lesson_to_completed", counts.firstCompletedLesson, counts.firstLesson),
    step(
      "completed_lesson_to_exercise",
      counts.exerciseAfterCompletedLesson,
      counts.firstCompletedLesson,
    ),
    step("exercise_to_pass", counts.firstPassingExercise, counts.firstExercise),
    step("project_to_completed", counts.completedProject, counts.firstProject),
    step("interview_to_completed", counts.completedInterview, counts.firstInterview),
    step("speaking_to_finished", counts.speakingFinished, counts.speakingStarted),
    step("free_to_paid", counts.paid, counts.planned),
  ];
}

function step(id: string, numerator: number, denominator: number): FunnelStep {
  return { id, numerator, denominator, rate: conversionRate(numerator, denominator) };
}

export interface LessonRankInput {
  slug: string;
  starts: number;
  completions: number;
}

export interface LessonHighlights {
  easiest: string[];
  hardest: string[];
  highestDropOff: string[];
}

export function rankLessons(lessons: LessonRankInput[]): LessonHighlights {
  const measured = lessons.filter((lesson) => lesson.starts > 0);
  const byRate = (direction: "asc" | "desc") =>
    [...measured]
      .sort((left, right) => {
        const leftRate = left.completions / left.starts;
        const rightRate = right.completions / right.starts;
        const rate = direction === "desc" ? rightRate - leftRate : leftRate - rightRate;
        return rate === 0 ? left.slug.localeCompare(right.slug) : rate;
      })
      .slice(0, 3)
      .map((lesson) => lesson.slug);
  const highestDropOff = [...measured]
    .sort((left, right) => {
      const leftDrop = (left.starts - left.completions) / left.starts;
      const rightDrop = (right.starts - right.completions) / right.starts;
      const drop = rightDrop - leftDrop;
      return drop === 0 ? left.slug.localeCompare(right.slug) : drop;
    })
    .slice(0, 3)
    .map((lesson) => lesson.slug);
  return { easiest: byRate("desc"), hardest: byRate("asc"), highestDropOff };
}
