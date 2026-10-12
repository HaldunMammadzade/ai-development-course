import { Prisma } from "./generated/prisma/client";
import {
  adminWindowRange,
  buildFunnel,
  rankLessons,
  type AdminRange,
  type AdminWindow,
  type FunnelStep,
  type LessonHighlights,
} from "./admin-window";
import { createPlatformPrisma, type PrismaClient } from "./platform-prisma";

export interface AdminAnalytics {
  overview(window: AdminWindow, now?: Date): Promise<AdminOverview>;
  learning(window: AdminWindow, now?: Date): Promise<AdminLearning>;
  ai(window: AdminWindow, now?: Date): Promise<AdminAi>;
  billing(window: AdminWindow, now?: Date): Promise<AdminBilling>;
  system(window: AdminWindow, now?: Date): Promise<AdminSystem>;
  searchStudents(input: StudentSearch): Promise<StudentPage>;
  studentDetail(userId: string): Promise<StudentDetail | null>;
  audit(input: AuditWrite): Promise<void>;
  disconnect(): Promise<void>;
}

export interface AdminOverview {
  range: AdminRange;
  students: {
    registered: number;
    verified: number;
    unverified: number;
    active: number;
  };
  learning: LearningCounts;
  ai: AiTotals;
  billing: PlanCounts & SubscriptionCounts & { catalogRecurringMinor: number };
  funnel: FunnelStep[];
  failures: FailureRow[];
}

export interface AdminLearning {
  range: AdminRange;
  counts: LearningCounts;
  funnel: FunnelStep[];
  highlights: LessonHighlights;
  lessons: LessonStat[];
  concepts: ConceptStat[];
  misconceptions: MisconceptionStat[];
}

export interface AdminAi {
  range: AdminRange;
  totals: AiTotals;
  byTask: GroupCount[];
  byProvider: GroupCount[];
  byModel: GroupCount[];
  byPlan: GroupCount[];
  byDay: DayCost[];
  speech: SpeechTotals;
  speechByProvider: GroupCount[];
  speechByDay: DayCost[];
}

export interface AdminBilling {
  range: AdminRange;
  plans: PlanCounts;
  subscriptions: SubscriptionCounts;
  checkoutAttempts: number;
  processedSubscriptionEvents: number;
  failedPaymentEvents: number;
  catalogRecurringMinor: number;
}

export interface AdminSystem {
  range: AdminRange;
  failures: FailureRow[];
}

export interface LearningCounts {
  lessonsStarted: number;
  lessonsCompleted: number;
  exercisesAttempted: number;
  exercisesPassed: number;
  projectsStarted: number;
  projectsCompleted: number;
  interviewsCompleted: number;
  speakingAttempts: number;
}

export interface AiTotals {
  teach: number;
  codeReview: number;
  projectReview: number;
  interview: number;
  speaking: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costMicros: string;
}

export interface SpeechTotals {
  calls: number;
  failures: number | null;
  durationMs: number;
  costMicros: string;
}

export interface PlanCounts {
  free: number;
  starter: number;
  pro: number;
  premium: number;
}

export interface SubscriptionCounts {
  active: number;
  trialing: number;
  pastDue: number;
  canceled: number;
  expired: number;
  incomplete: number;
}

export interface LessonStat {
  slug: string;
  title: string;
  starts: number;
  completions: number;
  completionRate: number | null;
  averageAttempts: number | null;
  averageTimeSeconds: number | null;
  exercisePassRate: number | null;
  averageMastery: number | null;
  weakConcepts: number;
}

export interface ConceptStat {
  slug: string;
  title: string;
  averageMastery: number | null;
  weak: number;
  strong: number;
  evidence: number;
}

export interface MisconceptionStat {
  code: string;
  students: number;
  occurrences: number;
}

export interface GroupCount {
  key: string;
  calls: number;
  costMicros: string;
}

export interface DayCost {
  day: string;
  calls: number;
  costMicros: string;
}

export interface FailureRow {
  category: "AI" | "STT" | "PAYMENT" | "EMAIL" | "DATABASE" | "RUNNER" | "JOB";
  recorded: boolean;
  count: number | null;
  lastAt: string | null;
  code: string | null;
  provider: string | null;
}

export interface StudentSearch {
  query: string;
  limit: number;
  cursor: string | null;
}

export interface StudentListItem {
  id: string;
  email: string;
  name: string | null;
  verified: boolean;
  plan: string;
  createdAt: string;
  lastActivityAt: string | null;
}

export interface StudentPage {
  students: StudentListItem[];
  nextCursor: string | null;
}

export interface StudentDetail {
  id: string;
  email: string;
  name: string | null;
  status: string;
  verified: boolean;
  createdAt: string;
  plan: string;
  subscription: {
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: string | null;
  } | null;
  enrollment: { pathSlug: string; status: string } | null;
  lessons: Array<{ slug: string; title: string; status: string; timeSpentSeconds: number }>;
  mastery: Array<{ slug: string; title: string; score: number; evidence: number }>;
  misconceptions: Array<{ code: string; concept: string; occurrences: number }>;
  exercises: { attempted: number; passed: number };
  projects: { started: number; milestonesPassed: number };
  interviews: { started: number; completed: number };
  speaking: { attempts: number; finished: number };
  ai: AiTotals;
}

export interface AuditWrite {
  adminUserId: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  correlationId: string;
}

interface CountRow {
  count: bigint;
}

export function createAdminAnalytics(databaseUrl: string): AdminAnalytics {
  return new PrismaAdminAnalytics(createPlatformPrisma(databaseUrl));
}

class PrismaAdminAnalytics implements AdminAnalytics {
  constructor(private readonly prisma: PrismaClient) {}

  async overview(window: AdminWindow, now = new Date()): Promise<AdminOverview> {
    const range = adminWindowRange(window, now);
    const [students, learning, ai, billing, funnelCounts, failures, active] = await Promise.all([
      this.studentStock(),
      this.learningCounts(range),
      this.aiTotals(range),
      this.billingCounts(range),
      this.funnelCounts(),
      this.failures(range),
      this.activeStudents(range),
    ]);
    return {
      range,
      students: { ...students, active },
      learning,
      ai,
      billing: {
        ...billing.plans,
        ...billing.subscriptions,
        catalogRecurringMinor: billing.catalogRecurringMinor,
      },
      funnel: buildFunnel(funnelCounts),
      failures,
    };
  }

  async learning(window: AdminWindow, now = new Date()): Promise<AdminLearning> {
    const range = adminWindowRange(window, now);
    const [counts, funnelCounts, lessons, concepts, misconceptions] = await Promise.all([
      this.learningCounts(range),
      this.funnelCounts(),
      this.lessonStats(),
      this.conceptStats(),
      this.misconceptionStats(),
    ]);
    return {
      range,
      counts,
      funnel: buildFunnel(funnelCounts),
      highlights: rankLessons(lessons),
      lessons,
      concepts,
      misconceptions,
    };
  }

  async ai(window: AdminWindow, now = new Date()): Promise<AdminAi> {
    const range = adminWindowRange(window, now);
    const [
      totals,
      byTask,
      byProvider,
      byModel,
      byPlan,
      byDay,
      speech,
      speechByProvider,
      speechByDay,
    ] = await Promise.all([
      this.aiTotals(range),
      this.aiGroups(range, "task_type"),
      this.aiGroups(range, "provider"),
      this.aiGroups(range, "model"),
      this.aiByPlan(range),
      this.aiByDay(range),
      this.speechTotals(range),
      this.speechGroups(range),
      this.speechByDay(range),
    ]);
    return {
      range,
      totals,
      byTask,
      byProvider,
      byModel,
      byPlan,
      byDay,
      speech,
      speechByProvider,
      speechByDay,
    };
  }

  async billing(window: AdminWindow, now = new Date()): Promise<AdminBilling> {
    const range = adminWindowRange(window, now);
    return this.billingCounts(range);
  }

  async system(window: AdminWindow, now = new Date()): Promise<AdminSystem> {
    const range = adminWindowRange(window, now);
    return { range, failures: await this.failures(range) };
  }

  async searchStudents(input: StudentSearch): Promise<StudentPage> {
    const query = input.query.trim();
    const cursor = input.cursor === null ? null : await this.cursorRow(input.cursor);
    const filters: Prisma.UserWhereInput[] = [];
    if (query.length > 0) {
      filters.push({
        OR: [
          ...(isUuid(query) ? [{ id: query }] : []),
          { email: { contains: query, mode: "insensitive" } },
          { name: { contains: query, mode: "insensitive" } },
        ],
      });
    }
    if (cursor !== null) {
      filters.push({
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      });
    }
    const rows = await this.prisma.user.findMany({
      where: filters.length === 0 ? {} : { AND: filters },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: input.limit + 1,
      select: {
        id: true,
        email: true,
        name: true,
        emailVerifiedAt: true,
        createdAt: true,
        userPlan: { select: { planCode: true } },
      },
    });
    const page = rows.slice(0, input.limit);
    const activity = await this.lastActivity(page.map((row) => row.id));
    return {
      students: page.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        verified: row.emailVerifiedAt !== null,
        plan: row.userPlan?.planCode ?? "free",
        createdAt: row.createdAt.toISOString(),
        lastActivityAt: activity.get(row.id) ?? null,
      })),
      nextCursor: rows.length > input.limit ? (page[page.length - 1]?.id ?? null) : null,
    };
  }

  async studentDetail(userId: string): Promise<StudentDetail | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        emailVerifiedAt: true,
        createdAt: true,
        userPlan: { select: { planCode: true } },
        subscription: {
          select: { status: true, cancelAtPeriodEnd: true, currentPeriodEnd: true },
        },
        enrollments: {
          take: 1,
          orderBy: { startedAt: "desc" },
          select: { status: true, path: { select: { slug: true } } },
        },
      },
    });
    if (user === null) {
      return null;
    }
    const [lessons, mastery, misconceptions, exercises, projects, interviews, speaking, ai] =
      await Promise.all([
        this.prisma.lessonProgress.findMany({
          where: { userId },
          orderBy: { updatedAt: "desc" },
          take: 30,
          select: {
            status: true,
            timeSpentSeconds: true,
            lesson: { select: { slug: true, title: true } },
          },
        }),
        this.prisma.skillMastery.findMany({
          where: { userId },
          orderBy: { score: "asc" },
          take: 40,
          select: {
            score: true,
            evidenceCount: true,
            concept: { select: { slug: true, name: true } },
          },
        }),
        this.prisma.misconception.findMany({
          where: { userId },
          orderBy: { occurrenceCount: "desc" },
          take: 20,
          select: { code: true, occurrenceCount: true, concept: { select: { slug: true } } },
        }),
        this.exerciseCounts(userId),
        this.projectCounts(userId),
        this.interviewCounts(userId),
        this.speakingCounts(userId),
        this.aiTotalsForUser(userId),
      ]);
    const enrollment = user.enrollments[0];
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      verified: user.emailVerifiedAt !== null,
      createdAt: user.createdAt.toISOString(),
      plan: user.userPlan?.planCode ?? "free",
      subscription:
        user.subscription === null
          ? null
          : {
              status: user.subscription.status,
              cancelAtPeriodEnd: user.subscription.cancelAtPeriodEnd,
              currentPeriodEnd: user.subscription.currentPeriodEnd?.toISOString() ?? null,
            },
      enrollment:
        enrollment === undefined
          ? null
          : { pathSlug: enrollment.path.slug, status: enrollment.status },
      lessons: lessons.map((row) => ({
        slug: row.lesson.slug,
        title: row.lesson.title,
        status: row.status,
        timeSpentSeconds: row.timeSpentSeconds,
      })),
      mastery: mastery.map((row) => ({
        slug: row.concept.slug,
        title: row.concept.name,
        score: row.score,
        evidence: row.evidenceCount,
      })),
      misconceptions: misconceptions.map((row) => ({
        code: row.code,
        concept: row.concept.slug,
        occurrences: row.occurrenceCount,
      })),
      exercises,
      projects,
      interviews,
      speaking,
      ai,
    };
  }

  async audit(input: AuditWrite): Promise<void> {
    await this.prisma.adminAuditLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        correlationId: input.correlationId.slice(0, 128),
      },
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private async studentStock(): Promise<{
    registered: number;
    verified: number;
    unverified: number;
  }> {
    const [registered, verified] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
    ]);
    return { registered, verified, unverified: registered - verified };
  }

  private async activeStudents(range: AdminRange): Promise<number> {
    return scalar(
      this.prisma,
      Prisma.sql`
        SELECT COUNT(*)::bigint AS count FROM (
          SELECT user_id FROM daily_activity
          WHERE activity_date >= (${range.from} AT TIME ZONE 'Asia/Baku')::date
            AND activity_date <= (${range.to} AT TIME ZONE 'Asia/Baku')::date
          UNION
          SELECT user_id FROM lesson_progress WHERE updated_at >= ${range.from} AND updated_at <= ${range.to}
          UNION
          SELECT user_id FROM exercise_attempts WHERE created_at >= ${range.from} AND created_at <= ${range.to}
          UNION
          SELECT user_id FROM teaching_sessions WHERE last_activity_at >= ${range.from} AND last_activity_at <= ${range.to}
          UNION
          SELECT user_id FROM interview_sessions WHERE started_at >= ${range.from} AND started_at <= ${range.to}
          UNION
          SELECT user_id FROM speaking_attempts WHERE created_at >= ${range.from} AND created_at <= ${range.to}
        ) AS active
      `,
    );
  }

  private async learningCounts(range: AdminRange): Promise<LearningCounts> {
    const [
      lessonsStarted,
      lessonsCompleted,
      exercisesAttempted,
      exercisesPassed,
      projectsStarted,
      projectsCompleted,
      interviewsCompleted,
      speakingAttempts,
    ] = await Promise.all([
      this.prisma.lessonProgress.count({
        where: { startedAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.lessonProgress.count({
        where: { completedAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.exerciseAttempt.count({
        where: { createdAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.exerciseAttempt.count({
        where: { createdAt: { gte: range.from, lte: range.to }, passed: true },
      }),
      scalar(
        this.prisma,
        Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM (
              SELECT DISTINCT user_id, project_id
              FROM project_attempts
              WHERE created_at >= ${range.from} AND created_at <= ${range.to}
            ) AS started
          `,
      ),
      scalar(
        this.prisma,
        Prisma.sql`
            SELECT COUNT(*)::bigint AS count FROM (
              SELECT progress.user_id, milestone.project_id
              FROM project_milestone_progress AS progress
              JOIN project_milestones AS milestone ON milestone.id = progress.milestone_id
              WHERE progress.passed_at >= ${range.from} AND progress.passed_at <= ${range.to}
              GROUP BY progress.user_id, milestone.project_id
              HAVING COUNT(*) = (
                SELECT COUNT(*) FROM project_milestones AS required
                WHERE required.project_id = milestone.project_id
              )
            ) AS finished
          `,
      ),
      this.prisma.interviewSession.count({
        where: { status: "completed", completedAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.speakingAttempt.count({
        where: { createdAt: { gte: range.from, lte: range.to } },
      }),
    ]);
    return {
      lessonsStarted,
      lessonsCompleted,
      exercisesAttempted,
      exercisesPassed,
      projectsStarted,
      projectsCompleted,
      interviewsCompleted,
      speakingAttempts,
    };
  }

  private async funnelCounts() {
    const [
      registered,
      verified,
      firstLesson,
      firstCompletedLesson,
      firstTeacherTurn,
      firstExercise,
      exerciseAfterCompletedLesson,
      firstPassingExercise,
      firstProject,
      completedProject,
      firstInterview,
      completedInterview,
      speakingStarted,
      speakingFinished,
      paid,
      planned,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { emailVerifiedAt: { not: null } } }),
      scalar(
        this.prisma,
        Prisma.sql`SELECT COUNT(DISTINCT user_id)::bigint AS count FROM lesson_progress WHERE status <> 'not_started' OR started_at IS NOT NULL`,
      ),
      scalar(
        this.prisma,
        Prisma.sql`SELECT COUNT(DISTINCT user_id)::bigint AS count FROM lesson_progress WHERE status = 'completed'`,
      ),
      scalar(
        this.prisma,
        Prisma.sql`SELECT COUNT(DISTINCT user_id)::bigint AS count FROM teaching_sessions WHERE turn_count > 0`,
      ),
      scalar(
        this.prisma,
        Prisma.sql`SELECT COUNT(DISTINCT user_id)::bigint AS count FROM exercise_attempts`,
      ),
      scalar(
        this.prisma,
        Prisma.sql`
          SELECT COUNT(DISTINCT progress.user_id)::bigint AS count
          FROM lesson_progress AS progress
          WHERE progress.status = 'completed'
            AND EXISTS (
              SELECT 1 FROM exercise_attempts AS attempt WHERE attempt.user_id = progress.user_id
            )
        `,
      ),
      scalar(
        this.prisma,
        Prisma.sql`SELECT COUNT(DISTINCT user_id)::bigint AS count FROM exercise_attempts WHERE passed = true`,
      ),
      scalar(
        this.prisma,
        Prisma.sql`
          SELECT COUNT(*)::bigint AS count FROM (
            SELECT user_id FROM project_attempts
            UNION
            SELECT user_id FROM project_milestone_progress
          ) AS started
        `,
      ),
      scalar(
        this.prisma,
        Prisma.sql`
          SELECT COUNT(*)::bigint AS count FROM (
            SELECT progress.user_id, milestone.project_id
            FROM project_milestone_progress AS progress
            JOIN project_milestones AS milestone ON milestone.id = progress.milestone_id
            GROUP BY progress.user_id, milestone.project_id
            HAVING COUNT(*) = (
              SELECT COUNT(*) FROM project_milestones AS required
              WHERE required.project_id = milestone.project_id
            )
          ) AS finished
        `,
      ),
      scalar(
        this.prisma,
        Prisma.sql`SELECT COUNT(DISTINCT user_id)::bigint AS count FROM interview_sessions`,
      ),
      scalar(
        this.prisma,
        Prisma.sql`SELECT COUNT(DISTINCT user_id)::bigint AS count FROM interview_sessions WHERE status = 'completed'`,
      ),
      scalar(
        this.prisma,
        Prisma.sql`SELECT COUNT(DISTINCT user_id)::bigint AS count FROM speaking_attempts`,
      ),
      scalar(
        this.prisma,
        Prisma.sql`SELECT COUNT(DISTINCT user_id)::bigint AS count FROM speaking_attempts WHERE status <> 'pending'`,
      ),
      scalar(
        this.prisma,
        Prisma.sql`SELECT COUNT(*)::bigint AS count FROM user_plans WHERE plan_code <> 'free'`,
      ),
      this.prisma.userPlan.count(),
    ]);
    return {
      registered,
      verified,
      firstLesson,
      firstCompletedLesson,
      firstTeacherTurn,
      firstExercise,
      exerciseAfterCompletedLesson,
      firstPassingExercise,
      firstProject,
      completedProject,
      firstInterview,
      completedInterview,
      speakingStarted,
      speakingFinished,
      paid,
      planned,
    };
  }

  private async lessonStats(): Promise<LessonStat[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        slug: string;
        title: string;
        starts: bigint;
        completions: bigint;
        average_time: number | null;
        exercise_attempts: bigint;
        exercise_students: bigint;
        exercise_passes: bigint;
        average_mastery: number | null;
        weak_concepts: bigint;
      }>
    >`
      SELECT
        lesson.slug,
        lesson.title,
        (
          SELECT COUNT(DISTINCT progress.user_id)::bigint
          FROM lesson_progress AS progress
          WHERE progress.lesson_id = lesson.id
            AND (progress.started_at IS NOT NULL OR progress.status <> 'not_started')
        ) AS starts,
        (
          SELECT COUNT(DISTINCT progress.user_id)::bigint
          FROM lesson_progress AS progress
          WHERE progress.lesson_id = lesson.id AND progress.status = 'completed'
        ) AS completions,
        (
          SELECT AVG(progress.time_spent_seconds)::float8
          FROM lesson_progress AS progress
          WHERE progress.lesson_id = lesson.id AND progress.time_spent_seconds > 0
        ) AS average_time,
        (
          SELECT COUNT(attempt.id)::bigint
          FROM exercise_attempts AS attempt
          JOIN exercises AS exercise ON exercise.id = attempt.exercise_id
          WHERE exercise.lesson_id = lesson.id
        ) AS exercise_attempts,
        (
          SELECT COUNT(DISTINCT attempt.user_id)::bigint
          FROM exercise_attempts AS attempt
          JOIN exercises AS exercise ON exercise.id = attempt.exercise_id
          WHERE exercise.lesson_id = lesson.id
        ) AS exercise_students,
        (
          SELECT COUNT(attempt.id)::bigint
          FROM exercise_attempts AS attempt
          JOIN exercises AS exercise ON exercise.id = attempt.exercise_id
          WHERE exercise.lesson_id = lesson.id AND attempt.passed
        ) AS exercise_passes,
        (
          SELECT AVG(mastery.score)::float8
          FROM skill_mastery AS mastery
          JOIN lesson_concepts AS link ON link.concept_id = mastery.concept_id
          WHERE link.lesson_id = lesson.id
        ) AS average_mastery,
        (
          SELECT COUNT(*)::bigint
          FROM skill_mastery AS mastery
          JOIN lesson_concepts AS link ON link.concept_id = mastery.concept_id
          WHERE link.lesson_id = lesson.id AND mastery.score < 60
        ) AS weak_concepts
      FROM lessons AS lesson
      WHERE lesson.status = 'published'
      ORDER BY lesson.title
    `;
    return rows.map((row) => {
      const starts = Number(row.starts);
      const completions = Number(row.completions);
      const attempts = Number(row.exercise_attempts);
      const students = Number(row.exercise_students);
      const passes = Number(row.exercise_passes);
      return {
        slug: row.slug,
        title: row.title,
        starts,
        completions,
        completionRate: starts === 0 ? null : Math.round((completions / starts) * 1000) / 10,
        averageAttempts: students === 0 ? null : Math.round((attempts / students) * 10) / 10,
        averageTimeSeconds: row.average_time === null ? null : Math.round(row.average_time),
        exercisePassRate: attempts === 0 ? null : Math.round((passes / attempts) * 1000) / 10,
        averageMastery: row.average_mastery === null ? null : Math.round(row.average_mastery),
        weakConcepts: Number(row.weak_concepts),
      };
    });
  }

  private async conceptStats(): Promise<ConceptStat[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        slug: string;
        title: string;
        average: number | null;
        weak: bigint;
        strong: bigint;
        evidence: bigint;
      }>
    >`
      SELECT
        concept.slug,
        concept.name AS title,
        AVG(mastery.score) AS average,
        COUNT(*) FILTER (WHERE mastery.score < 60)::bigint AS weak,
        COUNT(*) FILTER (WHERE mastery.score >= 80)::bigint AS strong,
        COALESCE(SUM(mastery.evidence_count), 0)::bigint AS evidence
      FROM concepts AS concept
      JOIN skill_mastery AS mastery ON mastery.concept_id = concept.id
      GROUP BY concept.id, concept.slug, concept.name
      ORDER BY weak DESC, concept.slug
      LIMIT 100
    `;
    return rows.map((row) => ({
      slug: row.slug,
      title: row.title,
      averageMastery: row.average === null ? null : Math.round(row.average),
      weak: Number(row.weak),
      strong: Number(row.strong),
      evidence: Number(row.evidence),
    }));
  }

  private async misconceptionStats(): Promise<MisconceptionStat[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ code: string; students: bigint; occurrences: bigint }>
    >`
      SELECT code, COUNT(*)::bigint AS students, COALESCE(SUM(occurrence_count), 0)::bigint AS occurrences
      FROM misconceptions
      GROUP BY code
      ORDER BY occurrences DESC
      LIMIT 20
    `;
    return rows.map((row) => ({
      code: row.code,
      students: Number(row.students),
      occurrences: Number(row.occurrences),
    }));
  }

  private async aiTotals(range: AdminRange): Promise<AiTotals> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        task_type: string;
        calls: bigint;
        input_tokens: bigint;
        output_tokens: bigint;
        cost_micros: bigint;
      }>
    >`
      SELECT task_type, COUNT(*)::bigint AS calls,
             COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
             COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
             COALESCE(SUM(cost_micros), 0)::bigint AS cost_micros
      FROM ai_usage
      WHERE created_at >= ${range.from} AND created_at <= ${range.to}
      GROUP BY task_type
    `;
    return foldAi(rows);
  }

  private async aiTotalsForUser(userId: string): Promise<AiTotals> {
    const rows = await this.prisma.$queryRaw<
      Array<{
        task_type: string;
        calls: bigint;
        input_tokens: bigint;
        output_tokens: bigint;
        cost_micros: bigint;
      }>
    >`
      SELECT task_type, COUNT(*)::bigint AS calls,
             COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
             COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
             COALESCE(SUM(cost_micros), 0)::bigint AS cost_micros
      FROM ai_usage
      WHERE user_id = ${userId}::uuid
      GROUP BY task_type
    `;
    return foldAi(rows);
  }

  private async aiGroups(
    range: AdminRange,
    column: "task_type" | "provider" | "model",
  ): Promise<GroupCount[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ key: string; calls: bigint; cost_micros: bigint }>
    >`
      SELECT ${Prisma.raw(column)} AS key, COUNT(*)::bigint AS calls, COALESCE(SUM(cost_micros), 0)::bigint AS cost_micros
      FROM ai_usage
      WHERE created_at >= ${range.from} AND created_at <= ${range.to}
      GROUP BY ${Prisma.raw(column)}
      ORDER BY calls DESC
      LIMIT 20
    `;
    return rows.map(group);
  }

  private async aiByPlan(range: AdminRange): Promise<GroupCount[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ key: string; calls: bigint; cost_micros: bigint }>
    >`
      SELECT COALESCE(plan.plan_code::text, 'none') AS key,
             COUNT(*)::bigint AS calls,
             COALESCE(SUM(usage.cost_micros), 0)::bigint AS cost_micros
      FROM ai_usage AS usage
      LEFT JOIN user_plans AS plan ON plan.user_id = usage.user_id
      WHERE usage.created_at >= ${range.from} AND usage.created_at <= ${range.to}
      GROUP BY plan.plan_code
      ORDER BY calls DESC
    `;
    return rows.map(group);
  }

  private async aiByDay(range: AdminRange): Promise<DayCost[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; calls: bigint; cost_micros: bigint }>
    >`
      SELECT (created_at AT TIME ZONE 'Asia/Baku')::date AS day,
             COUNT(*)::bigint AS calls,
             COALESCE(SUM(cost_micros), 0)::bigint AS cost_micros
      FROM ai_usage
      WHERE created_at >= ${range.from} AND created_at <= ${range.to}
      GROUP BY day
      ORDER BY day
    `;
    return rows.map((row) => ({
      day: isoDay(row.day),
      calls: Number(row.calls),
      costMicros: row.cost_micros.toString(),
    }));
  }

  private async speechTotals(range: AdminRange): Promise<SpeechTotals> {
    const rows = await this.prisma.$queryRaw<
      Array<{ calls: bigint; failures: bigint; duration_ms: bigint; cost_micros: bigint }>
    >`
      SELECT COUNT(*)::bigint AS calls,
             COUNT(*) FILTER (WHERE status <> 'succeeded' AND status <> 'success')::bigint AS failures,
             COALESCE(SUM(duration_ms), 0)::bigint AS duration_ms,
             COALESCE(SUM(cost_micros), 0)::bigint AS cost_micros
      FROM transcription_usage
      WHERE created_at >= ${range.from} AND created_at <= ${range.to}
    `;
    const row = rows[0];
    return {
      calls: Number(row?.calls ?? 0),
      failures: null,
      durationMs: Number(row?.duration_ms ?? 0),
      costMicros: (row?.cost_micros ?? 0n).toString(),
    };
  }

  private async speechGroups(range: AdminRange): Promise<GroupCount[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ key: string; calls: bigint; cost_micros: bigint }>
    >`
      SELECT provider AS key, COUNT(*)::bigint AS calls, COALESCE(SUM(cost_micros), 0)::bigint AS cost_micros
      FROM transcription_usage
      WHERE created_at >= ${range.from} AND created_at <= ${range.to}
      GROUP BY provider
      ORDER BY calls DESC
    `;
    return rows.map(group);
  }

  private async speechByDay(range: AdminRange): Promise<DayCost[]> {
    const rows = await this.prisma.$queryRaw<
      Array<{ day: Date; calls: bigint; cost_micros: bigint }>
    >`
      SELECT (created_at AT TIME ZONE 'Asia/Baku')::date AS day,
             COUNT(*)::bigint AS calls,
             COALESCE(SUM(cost_micros), 0)::bigint AS cost_micros
      FROM transcription_usage
      WHERE created_at >= ${range.from} AND created_at <= ${range.to}
      GROUP BY day
      ORDER BY day
    `;
    return rows.map((row) => ({
      day: isoDay(row.day),
      calls: Number(row.calls),
      costMicros: row.cost_micros.toString(),
    }));
  }

  private async billingCounts(range: AdminRange): Promise<AdminBilling> {
    const [
      planRows,
      subscriptionRows,
      checkoutAttempts,
      processedSubscriptionEvents,
      failedPaymentEvents,
      recurring,
    ] = await Promise.all([
      this.prisma.userPlan.groupBy({ by: ["planCode"], _count: { _all: true } }),
      this.prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
      this.prisma.checkoutSession.count({
        where: { createdAt: { gte: range.from, lte: range.to } },
      }),
      this.prisma.paymentEvent.count({
        where: {
          status: "processed",
          eventType: "subscription.upsert",
          receivedAt: { gte: range.from, lte: range.to },
        },
      }),
      this.prisma.paymentEvent.count({
        where: { status: "failed", receivedAt: { gte: range.from, lte: range.to } },
      }),
      scalar(
        this.prisma,
        Prisma.sql`
            SELECT COALESCE(SUM(price.amount_minor), 0)::bigint AS count
            FROM subscriptions AS subscription
            JOIN plan_prices AS price ON price.id = subscription.price_id
            WHERE subscription.status IN ('active', 'trialing', 'past_due')
              AND (subscription.current_period_end IS NULL OR subscription.current_period_end >= NOW())
          `,
      ),
    ]);
    const plans = { free: 0, starter: 0, pro: 0, premium: 0 };
    for (const row of planRows) {
      if (row.planCode in plans) {
        plans[row.planCode as keyof PlanCounts] = row._count._all;
      }
    }
    const subscriptions = {
      active: 0,
      trialing: 0,
      pastDue: 0,
      canceled: 0,
      expired: 0,
      incomplete: 0,
    };
    for (const row of subscriptionRows) {
      if (row.status === "past_due") {
        subscriptions.pastDue = row._count._all;
      } else if (row.status in subscriptions) {
        subscriptions[row.status as "active"] = row._count._all;
      }
    }
    return {
      range,
      plans,
      subscriptions,
      checkoutAttempts,
      processedSubscriptionEvents,
      failedPaymentEvents,
      catalogRecurringMinor: recurring,
    };
  }

  private async failures(range: AdminRange): Promise<FailureRow[]> {
    const [payment, jobs] = await Promise.all([
      this.prisma.paymentEvent.aggregate({
        where: { status: "failed", receivedAt: { gte: range.from, lte: range.to } },
        _count: { _all: true },
        _max: { receivedAt: true },
      }),
      this.prisma.operationalJob.groupBy({
        by: ["name", "lastError"],
        where: { status: "dead", updatedAt: { gte: range.from, lte: range.to } },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
    ]);
    const email = jobs.filter((row) => row.name === "send_email");
    const otherJobs = jobs.filter((row) => row.name !== "send_email");
    return [
      unrecorded("AI"),
      unrecorded("STT"),
      recorded("PAYMENT", payment._count._all, payment._max.receivedAt, "PAYMENT_FAILED", null),
      recorded(
        "EMAIL",
        email.reduce((sum, row) => sum + row._count._all, 0),
        latest(email.map((row) => row._max.updatedAt)),
        safeCode(email[0]?.lastError ?? null),
        null,
      ),
      unrecorded("DATABASE"),
      unrecorded("RUNNER"),
      recorded(
        "JOB",
        otherJobs.reduce((sum, row) => sum + row._count._all, 0),
        latest(otherJobs.map((row) => row._max.updatedAt)),
        safeCode(otherJobs[0]?.lastError ?? null),
        null,
      ),
    ];
  }

  private async exerciseCounts(userId: string): Promise<{ attempted: number; passed: number }> {
    const [attempted, passed] = await Promise.all([
      this.prisma.exerciseAttempt.count({ where: { userId } }),
      this.prisma.exerciseAttempt.count({ where: { userId, passed: true } }),
    ]);
    return { attempted, passed };
  }

  private async projectCounts(
    userId: string,
  ): Promise<{ started: number; milestonesPassed: number }> {
    const [started, milestonesPassed] = await Promise.all([
      this.prisma.projectAttempt.count({ where: { userId } }),
      this.prisma.projectMilestoneProgress.count({ where: { userId } }),
    ]);
    return { started, milestonesPassed };
  }

  private async interviewCounts(userId: string): Promise<{ started: number; completed: number }> {
    const [started, completed] = await Promise.all([
      this.prisma.interviewSession.count({ where: { userId } }),
      this.prisma.interviewSession.count({ where: { userId, status: "completed" } }),
    ]);
    return { started, completed };
  }

  private async speakingCounts(userId: string): Promise<{ attempts: number; finished: number }> {
    const [attempts, finished] = await Promise.all([
      this.prisma.speakingAttempt.count({ where: { userId } }),
      this.prisma.speakingAttempt.count({ where: { userId, status: { not: "pending" } } }),
    ]);
    return { attempts, finished };
  }

  private async lastActivity(ids: string[]): Promise<Map<string, string>> {
    const activity = new Map<string, string>();
    if (ids.length === 0) {
      return activity;
    }
    const rows = await this.prisma.$queryRaw<Array<{ user_id: string; last_at: Date }>>`
      SELECT user_id, MAX(last_at) AS last_at FROM (
        SELECT user_id, created_at AS last_at FROM exercise_attempts WHERE user_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
        UNION ALL
        SELECT user_id, updated_at FROM lesson_progress WHERE user_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
        UNION ALL
        SELECT user_id, last_activity_at FROM teaching_sessions WHERE user_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
        UNION ALL
        SELECT user_id, started_at FROM interview_sessions WHERE user_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
        UNION ALL
        SELECT user_id, created_at FROM speaking_attempts WHERE user_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      ) AS activity
      GROUP BY user_id
    `;
    for (const row of rows) {
      activity.set(row.user_id, row.last_at.toISOString());
    }
    return activity;
  }

  private async cursorRow(id: string): Promise<{ id: string; createdAt: Date }> {
    const row = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, createdAt: true },
    });
    if (row === null) {
      throw new AdminQueryError();
    }
    return row;
  }
}

export class AdminQueryError extends Error {
  constructor() {
    super("The admin query was rejected.");
    this.name = "AdminQueryError";
  }
}

function scalar(prisma: PrismaClient, query: Prisma.Sql): Promise<number> {
  return prisma.$queryRaw<CountRow[]>(query).then((rows) => Number(rows[0]?.count ?? 0));
}

function foldAi(
  rows: Array<{
    task_type: string;
    calls: bigint;
    input_tokens: bigint;
    output_tokens: bigint;
    cost_micros: bigint;
  }>,
): AiTotals {
  const byTask = new Map(rows.map((row) => [row.task_type, Number(row.calls)]));
  const calls = rows.reduce((sum, row) => sum + Number(row.calls), 0);
  const inputTokens = rows.reduce((sum, row) => sum + Number(row.input_tokens), 0);
  const outputTokens = rows.reduce((sum, row) => sum + Number(row.output_tokens), 0);
  const cost = rows.reduce((sum, row) => sum + row.cost_micros, 0n);
  return {
    teach: byTask.get("teach") ?? 0,
    codeReview: byTask.get("code_review") ?? 0,
    projectReview: byTask.get("project_review") ?? 0,
    interview: byTask.get("interview") ?? 0,
    speaking: byTask.get("speaking") ?? 0,
    calls,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    costMicros: cost.toString(),
  };
}

function group(row: { key: string; calls: bigint; cost_micros: bigint }): GroupCount {
  return { key: row.key, calls: Number(row.calls), costMicros: row.cost_micros.toString() };
}

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function latest(values: Array<Date | null>): Date | null {
  const present = values.filter((value): value is Date => value !== null);
  if (present.length === 0) {
    return null;
  }
  return present.reduce((max, value) => (value > max ? value : max));
}

function recorded(
  category: FailureRow["category"],
  count: number,
  lastAt: Date | null,
  code: string | null,
  provider: string | null,
): FailureRow {
  return {
    category,
    recorded: true,
    count,
    lastAt: lastAt?.toISOString() ?? null,
    code,
    provider,
  };
}

function unrecorded(category: FailureRow["category"]): FailureRow {
  return { category, recorded: false, count: null, lastAt: null, code: null, provider: null };
}

function safeCode(value: string | null): string | null {
  return value !== null && /^[A-Z0-9_]{1,80}$/.test(value) ? value : null;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
