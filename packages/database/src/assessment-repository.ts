import { PrismaPg } from "@prisma/adapter-pg";
import {
  ASSESSMENT_CONTEXT,
  acceptedAssessmentAnswer,
  assessmentItemById,
  placeAssessment,
  scoreAssessmentAnswer,
  selectAssessmentItem,
  type PlacementLesson,
} from "@platform/curriculum";
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { writeSkillMasteryProjection } from "./progress-repository";

export class AssessmentRuleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface StoredAssessmentAnswer {
  itemId: string;
  submission: string;
  passed: boolean;
  createdAt: Date;
}

export interface AssessmentGraph {
  timeZone: string;
  lessons: PlacementLesson[];
  prerequisites: Array<{ conceptSlug: string; prerequisiteSlug: string }>;
  names: Map<string, string>;
}

export type AssessmentAvailability =
  | { kind: "not_required" }
  | { kind: "skipped" }
  | { kind: "in_progress" | "completed"; answers: StoredAssessmentAnswer[]; graph: AssessmentGraph };

export interface AssessmentRepository {
  availability(userId: string): Promise<AssessmentAvailability>;
  begin(userId: string, now: Date): Promise<void>;
  skip(userId: string, now: Date): Promise<void>;
  answer(input: {
    userId: string;
    itemId: string;
    submission: string;
    clientAttemptId: string;
    now: Date;
  }): Promise<void>;
  disconnect(): Promise<void>;
}

export function createAssessmentRepository(databaseUrl: string): AssessmentRepository {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  return new PrismaAssessmentRepository(prisma);
}

class PrismaAssessmentRepository implements AssessmentRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async availability(userId: string): Promise<AssessmentAvailability> {
    const row = await this.prisma.skillAssessment.findUnique({
      where: { userId },
      include: { answers: { orderBy: { createdAt: "asc" } } },
    });
    if (row?.status === "skipped") {
      return { kind: "skipped" };
    }
    if (row === null && (await this.hasOtherLearning(userId))) {
      return { kind: "not_required" };
    }
    if (row === null) {
      return { kind: "in_progress", answers: [], graph: await this.graph(userId) };
    }
    return {
      kind: row.status === "completed" ? "completed" : "in_progress",
      answers: row.answers.map((answer) => ({
        itemId: answer.itemId,
        submission: answer.submission,
        passed: answer.passed,
        createdAt: answer.createdAt,
      })),
      graph: await this.graph(userId),
    };
  }

  async begin(userId: string, now: Date): Promise<void> {
    const existing = await this.prisma.skillAssessment.findUnique({ where: { userId } });
    if (existing !== null || (await this.hasOtherLearning(userId))) {
      return;
    }
    try {
      await this.prisma.skillAssessment.create({
        data: { userId, status: "in_progress", startedAt: now },
      });
    } catch (error) {
      if (!isUnique(error)) {
        throw error;
      }
    }
  }

  async skip(userId: string, now: Date): Promise<void> {
    const row = await this.prisma.skillAssessment.findUnique({ where: { userId } });
    if (row?.status === "completed" || row?.status === "skipped") {
      throw new AssessmentRuleError(409, "ASSESSMENT_CLOSED", "Assessment is already closed.");
    }
    if (row === null) {
      if (await this.hasOtherLearning(userId)) {
        throw new AssessmentRuleError(409, "ASSESSMENT_CLOSED", "Assessment is not open.");
      }
      await this.prisma.skillAssessment.create({
        data: { userId, status: "skipped", startedAt: now, completedAt: now },
      });
      return;
    }
    await this.prisma.skillAssessment.update({
      where: { userId },
      data: { status: "skipped", completedAt: now },
    });
  }

  async answer(input: {
    userId: string;
    itemId: string;
    submission: string;
    clientAttemptId: string;
    now: Date;
  }): Promise<void> {
    const item = assessmentItemById(input.itemId);
    if (item === null) {
      throw new AssessmentRuleError(400, "VALIDATION", "Unknown assessment item.");
    }
    const scored = scoreAssessmentAnswer(item, input.submission);
    try {
      await this.prisma.$transaction(async (tx) => {
        const row = await tx.skillAssessment.findUnique({
          where: { userId: input.userId },
          include: { answers: { orderBy: { createdAt: "asc" } } },
        });
        if (row === null || row.status !== "in_progress") {
          throw new AssessmentRuleError(409, "ASSESSMENT_CLOSED", "Assessment is not open.");
        }
        const replay = row.answers.find((answer) => answer.clientAttemptId === input.clientAttemptId);
        if (replay !== undefined) {
          if (replay.itemId !== input.itemId || replay.submission !== input.submission) {
            throw new AssessmentRuleError(409, "ATTEMPT_REPLAY", "This attempt id was already used.");
          }
          return;
        }
        const expected = selectAssessmentItem(
          row.answers.map((answer) => ({ itemId: answer.itemId, passed: answer.passed })),
        );
        if (expected === null || expected.id !== item.id) {
          throw new AssessmentRuleError(409, "ITEM_MISMATCH", "That item is not the current question.");
        }
        await tx.skillAssessmentAnswer.create({
          data: {
            userId: input.userId,
            itemId: item.id,
            clientAttemptId: input.clientAttemptId,
            submission: input.submission,
            passed: scored.passed,
            createdAt: input.now,
          },
        });
        const answers = [
          ...row.answers.map((answer) => ({ itemId: answer.itemId, passed: answer.passed })),
          { itemId: item.id, passed: scored.passed },
        ];
        if (selectAssessmentItem(answers) !== null) {
          return;
        }
        await this.finish(tx, input.userId, answers, input.now);
      }, { maxWait: 5_000, timeout: 20_000 });
    } catch (error) {
      if (error instanceof AssessmentRuleError) {
        throw error;
      }
      if (isUnique(error)) {
        throw new AssessmentRuleError(409, "ATTEMPT_REPLAY", "This attempt id was already used.");
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private async finish(
    tx: Prisma.TransactionClient,
    userId: string,
    answers: Array<{ itemId: string; passed: boolean }>,
    now: Date,
  ): Promise<void> {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const graph = await this.graph(userId, tx);
    const concepts = await tx.concept.findMany({
      where: {
        slug: {
          in: [...new Set(answers.flatMap((answer) => assessmentItemById(answer.itemId)?.concepts ?? []))],
        },
      },
      select: { id: true, slug: true },
    });
    const conceptId = new Map(concepts.map((concept) => [concept.slug, concept.id]));
    for (const answer of answers) {
      const source = assessmentItemById(answer.itemId);
      if (source === null) {
        continue;
      }
      const scored = scoreAssessmentAnswer(
        source,
        answer.passed ? acceptedAssessmentAnswer(source) : " ",
      );
      for (const slug of source.concepts) {
        const id = conceptId.get(slug);
        if (id === undefined) {
          continue;
        }
        await tx.learningEvent.create({
          data: {
            userId,
            conceptId: id,
            source: "quiz",
            evidence: scored.evidence,
            weight: scored.weight,
            metadata: { context: ASSESSMENT_CONTEXT, itemId: source.id },
            createdAt: now,
          },
        });
        await writeSkillMasteryProjection(tx, {
          userId,
          conceptId: id,
          now,
          timeZone: user?.timezone ?? "UTC",
        });
      }
    }
    const masteryRows = await tx.skillMastery.findMany({
      where: { userId, conceptId: { in: concepts.map((concept) => concept.id) } },
      include: { concept: { select: { slug: true } } },
    });
    const mastery = new Map(
      masteryRows.map((row) => [
        row.concept.slug,
        { score: row.score, evidenceCount: row.evidenceCount },
      ]),
    );
    const placement = placeAssessment({
      lessons: graph.lessons,
      prerequisites: graph.prerequisites,
      mastery,
    });
    for (const lessonId of placement.lessonIdsToComplete) {
      await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        create: {
          userId,
          lessonId,
          status: "completed",
          startedAt: now,
          completedAt: now,
        },
        update: {},
      });
    }
    await tx.skillAssessment.update({
      where: { userId },
      data: { status: "completed", completedAt: now },
    });
  }

  private async hasOtherLearning(userId: string): Promise<boolean> {
    const [progress, sessions, attempts, events] = await Promise.all([
      this.prisma.lessonProgress.count({ where: { userId } }),
      this.prisma.teachingSession.count({ where: { userId } }),
      this.prisma.exerciseAttempt.count({ where: { userId } }),
      this.prisma.learningEvent.count({ where: { userId, source: { not: "quiz" } } }),
    ]);
    return progress + sessions + attempts + events > 0;
  }

  private async graph(userId: string, db: Prisma.TransactionClient | PrismaClient = this.prisma): Promise<AssessmentGraph> {
    const user = await db.user.findUnique({ where: { id: userId }, select: { timezone: true } });
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
                  include: { concepts: { include: { concept: { select: { slug: true, name: true } } } } },
                },
              },
            },
          },
        },
      },
    });
    const names = new Map<string, string>();
    const lessons: PlacementLesson[] = [];
    const slugs: string[] = [];
    for (const module of enrollment?.path.modules ?? []) {
      for (const lesson of module.lessons) {
        const primary = lesson.concepts.filter((link) => link.role === "primary").map((link) => link.concept.slug);
        for (const link of lesson.concepts) {
          names.set(link.concept.slug, link.concept.name);
          slugs.push(link.concept.slug);
        }
        lessons.push({
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          moduleSlug: module.slug,
          moduleTitle: module.title,
          modulePosition: module.position,
          lessonPosition: lesson.position,
          status: lesson.status,
          primaryConceptSlugs: primary,
          progress: null,
        });
      }
    }
    const [progress, prerequisites] = await Promise.all([
      db.lessonProgress.findMany({
        where: { userId, lessonId: { in: lessons.map((lesson) => lesson.id) } },
      }),
      db.conceptPrerequisite.findMany({
        where: { concept: { slug: { in: slugs } } },
        include: {
          concept: { select: { slug: true } },
          prerequisite: { select: { slug: true } },
        },
      }),
    ]);
    const progressByLesson = new Map(progress.map((row) => [row.lessonId, row.status]));
    return {
      timeZone: user?.timezone ?? "UTC",
      lessons: lessons.map((lesson) => ({
        ...lesson,
        progress: progressByLesson.get(lesson.id) ?? null,
      })),
      prerequisites: prerequisites.map((row) => ({
        conceptSlug: row.concept.slug,
        prerequisiteSlug: row.prerequisite.slug,
      })),
      names,
    };
  }
}

function isUnique(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
