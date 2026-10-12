import { FRONTEND_PATH_SLUG } from "@platform/curriculum";
import {
  OnboardingUnavailableError,
  type LearningCatalogSource,
  type Locale,
  type NextActionContext,
  type OnboardingCounts,
  type StudentAccount,
} from "./identity";
import { Prisma, type PrismaClient } from "./generated/prisma/client";

const PLAN_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

type Db = Prisma.TransactionClient;

export async function ensureStudentOnboarding(db: Db, userId: string, now: Date): Promise<void> {
  const plan = await db.plan.findUnique({ where: { code: "free" } });
  const path = await db.learningPath.findUnique({ where: { slug: FRONTEND_PATH_SLUG } });
  if (plan === null || !plan.active || path === null) {
    throw new OnboardingUnavailableError();
  }

  const existingPlan = await db.userPlan.findUnique({ where: { userId } });
  if (existingPlan === null) {
    try {
      await db.userPlan.create({
        data: {
          userId,
          planCode: "free",
          status: "active",
          periodStart: now,
          periodEnd: new Date(now.getTime() + PLAN_PERIOD_MS),
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  const existingEnrollment = await db.enrollment.findUnique({
    where: { userId_pathId: { userId, pathId: path.id } },
  });
  if (existingEnrollment === null) {
    try {
      await db.enrollment.create({
        data: {
          userId,
          pathId: path.id,
          status: "active",
          startedAt: now,
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }

  const preferences = await db.studentPreferences.findUnique({ where: { userId } });
  if (preferences === null) {
    try {
      await db.studentPreferences.create({
        data: {
          userId,
          explanationStyle: "clear",
          challengeLevel: "adaptive",
        },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }
}

export function toPrismaLocale(locale: Locale): "az_AZ" | "en" | "tr" | "ru" {
  return locale === "az-AZ" ? "az_AZ" : locale;
}

export async function readStudentAccount(
  db: PrismaClient,
  userId: string,
): Promise<StudentAccount | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (user === null) {
    return null;
  }

  const [preferences, plan, enrollment] = await Promise.all([
    db.studentPreferences.findUnique({ where: { userId } }),
    db.userPlan.findUnique({ where: { userId }, include: { plan: true } }),
    db.enrollment.findFirst({
      where: { userId, status: "active" },
      include: { path: true },
    }),
  ]);

  return {
    user: {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      name: user.name,
      locale: applicationLocale(user.locale),
      timezone: user.timezone,
      emailVerifiedAt: user.emailVerifiedAt,
      status: applicationStatus(user.status),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    preferences:
      preferences === null
        ? null
        : {
            userId: preferences.userId,
            explanationStyle: preferences.explanationStyle,
            challengeLevel: preferences.challengeLevel,
          },
    plan:
      plan === null
        ? null
        : {
            code: plan.planCode,
            dailyTeacherTurns: plan.plan.dailyTeacherTurns,
            monthlyTeacherTurns: plan.plan.monthlyTeacherTurns,
            status: plan.status,
          },
    enrollment:
      enrollment === null
        ? null
        : {
            pathSlug: enrollment.path.slug,
            pathTitle: enrollment.path.title,
            status: enrollment.status,
          },
  };
}

export async function readOnboardingCounts(
  db: PrismaClient,
  userId: string,
): Promise<OnboardingCounts> {
  const [plans, activeEnrollments, enrollments, preferences, rows] = await Promise.all([
    db.userPlan.count({ where: { userId } }),
    db.enrollment.count({ where: { userId, status: "active" } }),
    db.enrollment.count({ where: { userId } }),
    db.studentPreferences.count({ where: { userId } }),
    db.enrollment.findMany({
      where: { userId },
      include: { path: { select: { slug: true } } },
    }),
  ]);

  return {
    plans,
    activeEnrollments,
    enrollments,
    preferences,
    pathSlugs: rows.map((row) => row.path.slug),
  };
}

export async function readNextActionContext(
  db: PrismaClient | Db,
  userId: string,
): Promise<NextActionContext> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
  const timeZone = user?.timezone ?? "UTC";
  const enrollment = await db.enrollment.findFirst({
    where: { userId, status: "active" },
    include: {
      path: {
        include: {
          modules: {
            orderBy: { position: "asc" },
            include: {
              lessons: {
                orderBy: { position: "asc" },
                include: {
                  concepts: { include: { concept: { select: { slug: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (enrollment === null) {
    return emptyContext(timeZone);
  }

  const lessons = enrollment.path.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      modulePosition: module.position,
      lessonPosition: lesson.position,
      status: lesson.status,
      primaryConceptSlugs: lesson.concepts
        .filter((link) => link.role === "primary")
        .map((link) => link.concept.slug),
      supportingConceptSlugs: lesson.concepts
        .filter((link) => link.role === "supporting")
        .map((link) => link.concept.slug),
    })),
  );
  const lessonIds = lessons.map((lesson) => lesson.id);
  const conceptSlugs = [
    ...new Set(
      lessons.flatMap((lesson) => [
        ...lesson.primaryConceptSlugs,
        ...lesson.supportingConceptSlugs,
      ]),
    ),
  ];

  const [progressRows, masteryRows, prerequisiteRows, homeworkRows, sessionRows] =
    await Promise.all([
      db.lessonProgress.findMany({ where: { userId, lessonId: { in: lessonIds } } }),
      db.skillMastery.findMany({
        where: { userId, concept: { slug: { in: conceptSlugs } } },
        include: { concept: { select: { slug: true } } },
      }),
      db.conceptPrerequisite.findMany({
        where: { concept: { slug: { in: conceptSlugs } } },
        include: {
          concept: { select: { slug: true } },
          prerequisite: { select: { slug: true } },
        },
      }),
      db.homeworkAssignment.findMany({
        where: { userId, lessonId: { in: lessonIds } },
        include: { lesson: { select: { title: true } } },
      }),
      db.teachingSession.findMany({
        where: { userId, lessonId: { in: lessonIds }, endedAt: null },
        include: { lesson: { select: { title: true } } },
      }),
    ]);

  const progressByLesson = new Map(progressRows.map((row) => [row.lessonId, row.status]));

  return {
    timeZone,
    lessons: lessons.map((lesson) => ({
      ...lesson,
      progress: progressByLesson.get(lesson.id) ?? null,
    })),
    prerequisites: prerequisiteRows.map((row) => ({
      conceptSlug: row.concept.slug,
      prerequisiteSlug: row.prerequisite.slug,
    })),
    mastery: masteryRows.map((row) => ({
      conceptSlug: row.concept.slug,
      score: row.score,
      evidenceCount: row.evidenceCount,
      lastEvidenceAt: row.lastEvidenceAt,
    })),
    homework: homeworkRows.map((row) => ({
      id: row.id,
      lessonId: row.lessonId,
      title: row.lesson.title,
      status: row.status,
      dueAt: row.dueAt,
    })),
    sessions: sessionRows.map((row) => ({
      id: row.id,
      lessonId: row.lessonId,
      title: row.lesson.title,
      state: row.state,
      endedAt: row.endedAt,
      lastActivityAt: row.lastActivityAt,
    })),
  };
}

export async function readLearningCatalogSource(
  db: PrismaClient,
  userId: string,
): Promise<LearningCatalogSource> {
  const context = await readNextActionContext(db, userId);
  const [activity, evidence] = await Promise.all([
    readRecentActivity(db, userId),
    readLatestEvidence(db, userId),
  ]);
  const account = await readStudentAccount(db, userId);
  const slug = account?.enrollment?.pathSlug;
  if (slug === undefined) {
    return { path: null, modules: [], concepts: [], context, activity, evidence };
  }

  const path = await db.learningPath.findUnique({
    where: { slug },
    include: {
      modules: {
        orderBy: { position: "asc" },
        include: {
          lessons: {
            orderBy: { position: "asc" },
            include: {
              concepts: {
                include: { concept: { select: { slug: true, name: true, summary: true } } },
              },
            },
          },
        },
      },
    },
  });
  if (path === null) {
    return { path: null, modules: [], concepts: [], context, activity, evidence };
  }

  const concepts = new Map<string, { name: string; summary: string }>();
  const modules = path.modules.map((module) => ({
    slug: module.slug,
    title: module.title,
    description: module.description,
    position: module.position,
    lessons: module.lessons.map((lesson) => {
      const primaryConceptSlugs: string[] = [];
      const supportingConceptSlugs: string[] = [];
      for (const link of lesson.concepts) {
        if (!concepts.has(link.concept.slug)) {
          concepts.set(link.concept.slug, {
            name: link.concept.name,
            summary: link.concept.summary,
          });
        }
        if (link.role === "primary") {
          primaryConceptSlugs.push(link.concept.slug);
        } else {
          supportingConceptSlugs.push(link.concept.slug);
        }
      }
      return {
        id: lesson.id,
        slug: lesson.slug,
        title: lesson.title,
        objective: lesson.objective,
        estimatedMinutes: lesson.estimatedMinutes,
        position: lesson.position,
        status: lesson.status,
        primaryConceptSlugs,
        supportingConceptSlugs,
      };
    }),
  }));

  const revision = await readRevisionInputs(db, userId, [...concepts.keys()]);
  return {
    path: {
      slug: path.slug,
      title: path.title,
      description: path.description,
      status: path.status,
    },
    modules,
    concepts: [...concepts.entries()].map(([conceptSlug, concept]) => ({
      slug: conceptSlug,
      name: concept.name,
      summary: concept.summary,
    })),
    context,
    activity,
    evidence,
    revisionSuccesses: revision.successes,
    revisionExercises: revision.exercises,
  };
}

const RECENT_ACTIVITY_LIMIT = 6;
const REVISION_SUCCESS_EVIDENCE = 80;

async function readRevisionInputs(
  db: PrismaClient,
  userId: string,
  conceptSlugs: string[],
): Promise<{
  successes: NonNullable<LearningCatalogSource["revisionSuccesses"]>;
  exercises: NonNullable<LearningCatalogSource["revisionExercises"]>;
}> {
  if (conceptSlugs.length === 0) {
    return { successes: [], exercises: [] };
  }
  const [groups, exercises] = await Promise.all([
    db.learningEvent.groupBy({
      by: ["conceptId"],
      where: {
        userId,
        evidence: { gte: REVISION_SUCCESS_EVIDENCE },
        source: { not: "speaking" },
        concept: { slug: { in: conceptSlugs } },
      },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    db.exercise.findMany({
      where: {
        published: true,
        rules: { not: Prisma.DbNull },
        concept: { slug: { in: conceptSlugs } },
        lesson: { status: "published" },
      },
      select: {
        slug: true,
        position: true,
        concept: { select: { slug: true } },
        lesson: {
          select: {
            slug: true,
            position: true,
            module: { select: { position: true } },
          },
        },
      },
    }),
  ]);
  const conceptIds = groups.map((group) => group.conceptId);
  const conceptRows =
    conceptIds.length === 0
      ? []
      : await db.concept.findMany({
          where: { id: { in: conceptIds } },
          select: { id: true, slug: true },
        });
  const slugById = new Map(conceptRows.map((row) => [row.id, row.slug]));
  return {
    successes: groups.flatMap((group) => {
      const conceptSlug = slugById.get(group.conceptId);
      if (conceptSlug === undefined || group._max.createdAt === null || group._count._all < 1) {
        return [];
      }
      return [
        {
          conceptSlug,
          successCount: group._count._all,
          lastSuccessAt: group._max.createdAt,
        },
      ];
    }),
    exercises: exercises.map((exercise) => ({
      slug: exercise.slug,
      position: exercise.position,
      conceptSlug: exercise.concept.slug,
      lessonSlug: exercise.lesson.slug,
      modulePosition: exercise.lesson.module.position,
      lessonPosition: exercise.lesson.position,
    })),
  };
}

async function readLatestEvidence(
  db: PrismaClient,
  userId: string,
): Promise<NonNullable<LearningCatalogSource["evidence"]>> {
  const rows = await db.learningEvent.findMany({
    where: { userId },
    distinct: ["conceptId"],
    orderBy: [{ conceptId: "asc" }, { createdAt: "desc" }],
    select: {
      source: true,
      concept: { select: { slug: true } },
    },
  });
  return rows.map((row) => ({
    conceptSlug: row.concept.slug,
    source: row.source,
  }));
}

async function readRecentActivity(
  db: PrismaClient,
  userId: string,
): Promise<NonNullable<LearningCatalogSource["activity"]>> {
  const rows = await db.learningEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: RECENT_ACTIVITY_LIMIT,
    select: {
      id: true,
      source: true,
      createdAt: true,
      concept: { select: { name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    source: row.source,
    conceptName: row.concept.name,
    createdAt: row.createdAt,
  }));
}

function emptyContext(timeZone: string): NextActionContext {
  return {
    timeZone,
    homework: [],
    sessions: [],
    lessons: [],
    prerequisites: [],
    mastery: [],
  };
}

function applicationLocale(locale: string): Locale {
  if (locale === "az_AZ" || locale === "az-AZ") {
    return "az-AZ";
  }
  if (locale === "en" || locale === "tr" || locale === "ru") {
    return locale;
  }
  throw new Error("Unexpected locale.");
}

function applicationStatus(status: string): "active" | "disabled" {
  if (status === "active" || status === "disabled") {
    return status;
  }
  throw new Error("Unexpected user status.");
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
