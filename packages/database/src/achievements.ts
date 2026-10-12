import type { AchievementFacts, AchievementLessonFact } from "@platform/curriculum";
import { REVISION_SUCCESS_EVIDENCE } from "@platform/curriculum";
import type { PrismaClient } from "./generated/prisma/client";
import { readStudentAccount } from "./student-onboarding";

const EVENT_SOURCES = [
  "lesson_check",
  "exercise",
  "quiz",
  "code_review",
  "interview",
  "homework",
  "project",
  "speaking",
] as const;

export async function readAchievementFacts(
  db: PrismaClient,
  userId: string,
): Promise<AchievementFacts> {
  const account = await readStudentAccount(db, userId);
  const pathSlug = account?.enrollment?.pathSlug;
  const [path, events, assessment, projects, passes, interviewCount, interview] = await Promise.all(
    [
      pathSlug === undefined
        ? Promise.resolve(null)
        : db.learningPath.findUnique({
            where: { slug: pathSlug },
            select: {
              modules: {
                orderBy: { position: "asc" },
                select: {
                  slug: true,
                  position: true,
                  lessons: {
                    select: {
                      id: true,
                      status: true,
                      progress: { where: { userId }, select: { status: true, completedAt: true } },
                    },
                  },
                },
              },
            },
          }),
      db.learningEvent.findMany({
        where: {
          userId,
          OR: [
            { source: "exercise" },
            { evidence: { gte: REVISION_SUCCESS_EVIDENCE }, source: { not: "speaking" } },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          source: true,
          evidence: true,
          createdAt: true,
          concept: { select: { slug: true } },
        },
      }),
      db.skillAssessment.findUnique({
        where: { userId },
        select: { status: true, completedAt: true },
      }),
      db.project.findMany({
        where: { status: "published" },
        select: { slug: true, milestones: { select: { id: true } } },
      }),
      db.projectMilestoneProgress.findMany({
        where: { userId, milestone: { project: { status: "published" } } },
        select: { milestoneId: true, passedAt: true },
      }),
      db.interview.count({ where: { status: "published" } }),
      db.interviewSession.findFirst({
        where: {
          userId,
          status: "completed",
          completedAt: { not: null },
          interview: { status: "published" },
        },
        orderBy: [{ completedAt: "asc" }, { id: "asc" }],
        select: { completedAt: true },
      }),
    ],
  );

  return {
    modules: (path?.modules ?? []).map((module) => ({
      slug: module.slug,
      position: module.position,
      lessons: module.lessons.map((lesson) => lessonFact(lesson)),
    })),
    events: events.flatMap((event) => {
      if (!isSource(event.source)) {
        return [];
      }
      return [
        {
          id: event.id,
          conceptSlug: event.concept.slug,
          occurredAt: event.createdAt,
          evidence: event.evidence,
          source: event.source,
        },
      ];
    }),
    assessment:
      assessment === null
        ? null
        : { status: assessment.status, completedAt: assessment.completedAt },
    projects: projects.map((project) => ({
      slug: project.slug,
      milestoneIds: project.milestones.map((milestone) => milestone.id),
    })),
    passes,
    interviewPublished: interviewCount > 0,
    interviewCompletedAt: interview?.completedAt ?? null,
  };
}

function lessonFact(lesson: {
  status: "draft" | "published";
  progress: Array<{
    status: "not_started" | "in_progress" | "completed";
    completedAt: Date | null;
  }>;
}): AchievementLessonFact {
  const progress = lesson.progress[0] ?? null;
  return {
    status: lesson.status,
    progress: progress?.status ?? null,
    completedAt: progress?.status === "completed" ? progress.completedAt : null,
  };
}

function isSource(value: string): value is (typeof EVENT_SOURCES)[number] {
  return (EVENT_SOURCES as readonly string[]).includes(value);
}
