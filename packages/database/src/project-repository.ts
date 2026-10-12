import { PrismaPg } from "@prisma/adapter-pg";
import {
  EXERCISE_ATTEMPT_LIMIT,
  EXERCISE_ATTEMPT_WINDOW_MS,
  PROJECT_FAILURE_EVIDENCE,
  classifyStoredEvidence,
  decideAdaptive,
  exerciseMasteryUpdate,
  isWeak,
  milestoneWorkflow,
  prerequisiteIsWeak,
  projectBrief,
  projectDifficultyBand,
  projectPortfolio,
  selectProjects,
  UNLOCK_MASTERY,
  type AdaptiveChoice,
} from "@platform/curriculum";
import { EXECUTION_LIMITS } from "@platform/execution";
import type {
  CodeReviewMode,
  Difficulty,
  ExplanationStyle,
  Locale,
  ProjectAttemptView,
  ProjectDetail,
  ProjectFiles,
  ProjectMilestoneStatus,
  ProjectPlanReview,
  ProjectPlanView,
  ProjectSummary,
} from "@platform/types";
import { projectChecksSchema, projectFilesSchema, type ProjectCheck } from "@platform/validation";
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { writeSkillMasteryProjection } from "./progress-repository";
import { assertFeature, CommercialRuleError, readCommercialPlan } from "./commercial-access";

export class ProjectRuleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProjectRuleError";
  }
}

export interface OpenedProject {
  id: string;
  detail: ProjectDetail;
  timeZone: string;
  milestones: Array<{
    id: string;
    slug: string;
    conceptId: string;
    status: ProjectMilestoneStatus;
    checks: ProjectCheck[];
  }>;
}

export interface NewProjectAttempt {
  userId: string;
  projectId: string;
  milestoneId: string;
  conceptId: string;
  milestoneSlug: string;
  clientAttemptId: string;
  files: ProjectFiles;
  score: number;
  passed: boolean;
  feedback: string;
  passedChecks: string[];
  failedChecks: string[];
  timeZone: string;
  now: Date;
}

export type ProjectExecutionPreparation =
  | { kind: "stored"; attempt: ProjectAttemptView }
  | { kind: "claimed" }
  | { kind: "wait" }
  | { kind: "busy" };

export interface ProjectReviewTarget {
  title: string;
  objective: string;
  instructions: string;
  files: ProjectFiles;
  feedback: string;
  score: number;
  passed: boolean;
  passedChecks: string[];
  failedChecks: string[];
  concepts: Array<{ slug: string; name: string; mastery: "weak" | "developing" | "secure" | null }>;
  allowedConceptSlugs: string[];
  locale: Locale;
  explanationStyle: ExplanationStyle;
}

export type ProjectReviewPreparation =
  | { kind: "stored"; review: unknown }
  | { kind: "wait" }
  | { kind: "limited" }
  | { kind: "claimed"; reviewId: string; hintLevel: number; target: ProjectReviewTarget }
  | null;

export interface ProjectRepository {
  list(userId: string): Promise<ProjectSummary[]>;
  open(userId: string, slug: string): Promise<OpenedProject | null>;
  prepareExecution(input: {
    userId: string;
    projectId: string;
    milestoneId: string;
    milestoneSlug: string;
    clientAttemptId: string;
    now: Date;
  }): Promise<ProjectExecutionPreparation>;
  executionPending(input: {
    userId: string;
    projectId: string;
    milestoneId: string;
    clientAttemptId: string;
  }): Promise<boolean>;
  releaseExecution(input: {
    userId: string;
    projectId: string;
    milestoneId: string;
    clientAttemptId: string;
  }): Promise<void>;
  findClientAttempt(
    userId: string,
    milestoneId: string,
    clientAttemptId: string,
  ): Promise<ProjectAttemptView | null>;
  submit(input: NewProjectAttempt): Promise<ProjectAttemptView>;
  listAttempts(
    userId: string,
    milestoneId: string,
    milestoneSlug: string,
  ): Promise<ProjectAttemptView[]>;
  prepareReview(input: {
    userId: string;
    projectId: string;
    milestoneId: string;
    attemptId: string;
    clientReviewId: string;
    mode: CodeReviewMode;
    now: Date;
    limit: number;
    windowMs: number;
  }): Promise<ProjectReviewPreparation>;
  findReview(input: {
    userId: string;
    attemptId: string;
    clientReviewId: string;
    mode: CodeReviewMode;
  }): Promise<{ status: "completed"; review: unknown } | { status: "pending" } | null>;
  completeReview(reviewId: string, result: unknown, now: Date): Promise<void>;
  releaseReview(reviewId: string): Promise<void>;
  recordReviewUsage(input: {
    userId: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costMicros: bigint;
    latencyMs: number;
    correlationId: string;
    taskType?: "project_review" | "project_plan";
  }): Promise<void>;
  savePlan(input: { userId: string; projectId: string; body: string }): Promise<ProjectPlanView>;
  savePlanReview(input: {
    userId: string;
    projectId: string;
    review: ProjectPlanReview;
  }): Promise<ProjectPlanView>;
  countRecentUsage(userId: string, taskType: string, since: Date): Promise<number>;
  learningSignal(userId: string, conceptId: string): Promise<ProjectLearningSignal | null>;
  disconnect(): Promise<void>;
}

export interface ProjectLearningSignal extends AdaptiveChoice {
  conceptSlug: string;
}

export function createProjectRepository(databaseUrl: string): ProjectRepository {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  return new PrismaProjectRepository(prisma);
}

class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async list(userId: string): Promise<ProjectSummary[]> {
    const rows = await this.prisma.project.findMany({
      where: { status: "published" },
      include: {
        requirements: true,
        milestones: { select: { id: true } },
      },
      orderBy: { title: "asc" },
    });
    const mastery = await this.masteryRows(userId);
    const progress = await this.prisma.projectMilestoneProgress.findMany({
      where: { userId },
      select: { milestoneId: true },
    });
    const started = new Set(
      (
        await this.prisma.projectAttempt.findMany({
          where: { userId },
          distinct: ["projectId"],
          select: { projectId: true },
        })
      ).map((row) => row.projectId),
    );
    const passed = new Set(progress.map((row) => row.milestoneId));
    const visible = rows
      .filter((row) => eligible(row.requirements, mastery) || started.has(row.id))
      .map((row) => {
        const passedMilestones = row.milestones.filter((item) => passed.has(item.id)).length;
        const requirementIds = row.requirements.map((item) => item.conceptId);
        return {
          slug: row.slug,
          title: row.title,
          description: row.description,
          difficulty: row.difficulty,
          estimatedMinutes: row.estimatedMinutes,
          completed: row.milestones.length > 0 && passedMilestones === row.milestones.length,
          passedMilestones,
          totalMilestones: row.milestones.length,
          band: projectDifficultyBand(row.difficulty),
          remediation:
            passedMilestones === 0 &&
            requirementIds.some((conceptId) => isWeak(mastery.get(conceptId) ?? null)),
          masteryHigh:
            requirementIds.length > 0 &&
            requirementIds.every((conceptId) => {
              const score = mastery.get(conceptId);
              return score !== undefined && score.score >= 80 && score.evidenceCount >= 8;
            }),
        };
      });
    return selectProjects(visible).map((row) => ({
      slug: row.slug,
      title: row.title,
      description: row.description,
      difficulty: row.difficulty,
      estimatedMinutes: row.estimatedMinutes,
      completed: row.completed,
      passedMilestones: row.passedMilestones,
      totalMilestones: row.totalMilestones,
      band: row.band,
    }));
  }

  async open(userId: string, slug: string): Promise<OpenedProject | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true, status: true },
    });
    if (user === null || user.status !== "active") {
      return null;
    }
    const project = await this.prisma.project.findUnique({
      where: { slug },
      include: {
        requirements: { include: { concept: true } },
        milestones: {
          orderBy: { position: "asc" },
          include: {
            concept: true,
            progress: { where: { userId }, take: 1 },
            attempts: { where: { userId }, orderBy: { createdAt: "desc" }, take: 1 },
            executionClaims: { where: { userId }, take: 1 },
          },
        },
      },
    });
    if (project === null || project.status !== "published" || project.milestones.length === 0) {
      return null;
    }
    const mastery = await this.masteryRows(userId);
    const started = await this.prisma.projectAttempt.findFirst({
      where: { userId, projectId: project.id },
      select: { id: true },
    });
    if (!eligible(project.requirements, mastery) && started === null) {
      return null;
    }
    const passedIds = new Set(
      project.milestones.filter((item) => item.progress.length > 0).map((item) => item.id),
    );
    let sawCurrent = false;
    const milestones = project.milestones.map((milestone) => {
      const status = milestoneStatus(passedIds.has(milestone.id), sawCurrent);
      if (status === "current") {
        sawCurrent = true;
      }
      const checks = projectChecksSchema.safeParse(milestone.checks);
      const starter = projectFilesSchema.safeParse(milestone.starterFiles);
      if (!checks.success || !starter.success) {
        return null;
      }
      const latest = projectFilesSchema.safeParse(milestone.attempts[0]?.files);
      const visibleStatus = allPassed(project.milestones, passedIds) ? ("passed" as const) : status;
      return {
        id: milestone.id,
        slug: milestone.slug,
        position: milestone.position,
        title: milestone.title,
        objective: milestone.objective,
        instructions: milestone.instructions,
        conceptId: milestone.conceptId,
        concept: { slug: milestone.concept.slug, name: milestone.concept.name },
        status: visibleStatus,
        workflow: milestoneWorkflow({
          status: visibleStatus,
          latestPassed: milestone.attempts[0]?.passed ?? null,
          claimed: milestone.executionClaims.length > 0,
        }),
        checks: checks.data,
        files:
          status === "locked" && !allPassed(project.milestones, passedIds)
            ? undefined
            : latest.success
              ? latest.data
              : starter.data,
      };
    });
    if (milestones.some((item) => item === null)) {
      return null;
    }
    const opened = milestones.filter((item) => item !== null);
    const current = opened.find((item) => item.status === "current") ?? opened[opened.length - 1];
    if (current === undefined) {
      return null;
    }
    const completed = opened.every((item) => item.status === "passed");
    const passedAt = project.milestones
      .map((item) => item.progress[0]?.passedAt)
      .filter((item): item is Date => item instanceof Date);
    const completedAt =
      completed && passedAt.length === project.milestones.length
        ? new Date(Math.max(...passedAt.map((item) => item.getTime()))).toISOString()
        : null;
    const plan = await this.prisma.projectPlan.findUnique({
      where: { userId_projectId: { userId, projectId: project.id } },
    });
    const detailMilestones = opened.map((item) =>
      item.status === "locked"
        ? {
            slug: item.slug,
            position: item.position,
            title: item.title,
            status: item.status,
            workflow: item.workflow,
          }
        : {
            slug: item.slug,
            position: item.position,
            title: item.title,
            status: item.status,
            workflow: item.workflow,
            objective: item.objective,
            instructions: item.instructions,
            concepts: [item.concept],
            files: item.files,
          },
    );
    return {
      id: project.id,
      timeZone: user.timezone,
      milestones: opened.map((item) => ({
        id: item.id,
        slug: item.slug,
        conceptId: item.conceptId,
        status: item.status,
        checks: item.checks,
      })),
      detail: {
        slug: project.slug,
        title: project.title,
        description: project.description,
        objective: project.objective,
        difficulty: project.difficulty as Difficulty,
        estimatedMinutes: project.estimatedMinutes,
        completed,
        completedAt,
        currentMilestone: current.slug,
        band: projectDifficultyBand(project.difficulty),
        brief: projectBrief(project.slug) ?? {
          goal: project.objective,
          required: [],
          recommended: [],
          optional: [],
        },
        plan: plan === null ? null : toPlan(plan),
        portfolio: projectPortfolio({
          title: project.title,
          objective: project.objective,
          completed,
          completedAt,
          milestones: detailMilestones,
        }),
        concepts: project.requirements.map((item) => ({
          slug: item.concept.slug,
          name: item.concept.name,
        })),
        milestones: detailMilestones,
      },
    };
  }

  async prepareExecution(input: {
    userId: string;
    projectId: string;
    milestoneId: string;
    milestoneSlug: string;
    clientAttemptId: string;
    now: Date;
  }): Promise<ProjectExecutionPreparation> {
    return this.prisma.$transaction(async (tx) => {
      await lockUser(tx, input.userId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(12, 12)`;
      const existing = await tx.projectAttempt.findUnique({
        where: {
          userId_milestoneId_clientAttemptId: {
            userId: input.userId,
            milestoneId: input.milestoneId,
            clientAttemptId: input.clientAttemptId,
          },
        },
      });
      if (existing !== null) {
        return { kind: "stored", attempt: toAttempt(existing, input.milestoneSlug) };
      }
      const staleBefore = new Date(input.now.getTime() - EXECUTION_LIMITS.claimTtlMs);
      await tx.exerciseExecutionClaim.deleteMany({ where: { createdAt: { lt: staleBefore } } });
      await tx.projectExecutionClaim.deleteMany({ where: { createdAt: { lt: staleBefore } } });
      await tx.interviewExecutionClaim.deleteMany({ where: { createdAt: { lt: staleBefore } } });
      const own = await tx.projectExecutionClaim.findUnique({
        where: { userId_projectId_milestoneId_clientAttemptId: claimKey(input) },
      });
      if (own !== null) {
        return { kind: "wait" };
      }
      await assertProjectFeature(tx, input.userId, input.now);
      const exerciseClaims = await tx.exerciseExecutionClaim.count();
      const projectClaims = await tx.projectExecutionClaim.count();
      const interviewClaims = await tx.interviewExecutionClaim.count();
      if (exerciseClaims + projectClaims + interviewClaims >= EXECUTION_LIMITS.maxConcurrent) {
        return { kind: "busy" };
      }
      await tx.projectExecutionClaim.create({
        data: { ...claimKey(input), createdAt: input.now },
      });
      return { kind: "claimed" };
    });
  }

  async executionPending(input: {
    userId: string;
    projectId: string;
    milestoneId: string;
    clientAttemptId: string;
  }): Promise<boolean> {
    const claim = await this.prisma.projectExecutionClaim.findUnique({
      where: { userId_projectId_milestoneId_clientAttemptId: claimKey(input) },
      select: { clientAttemptId: true },
    });
    return claim !== null;
  }

  async releaseExecution(input: {
    userId: string;
    projectId: string;
    milestoneId: string;
    clientAttemptId: string;
  }): Promise<void> {
    await this.prisma.projectExecutionClaim.deleteMany({ where: claimKey(input) });
  }

  async findClientAttempt(
    userId: string,
    milestoneId: string,
    clientAttemptId: string,
  ): Promise<ProjectAttemptView | null> {
    const row = await this.prisma.projectAttempt.findUnique({
      where: { userId_milestoneId_clientAttemptId: { userId, milestoneId, clientAttemptId } },
      include: { milestone: { select: { slug: true } } },
    });
    return row === null ? null : toAttempt(row, row.milestone.slug);
  }

  async submit(input: NewProjectAttempt): Promise<ProjectAttemptView> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await lockUser(tx, input.userId);
          const existing = await tx.projectAttempt.findUnique({
            where: {
              userId_milestoneId_clientAttemptId: {
                userId: input.userId,
                milestoneId: input.milestoneId,
                clientAttemptId: input.clientAttemptId,
              },
            },
          });
          if (existing !== null) {
            return toAttempt(existing, input.milestoneSlug);
          }
          await assertProjectFeature(tx, input.userId, input.now);
          await assertMilestoneOpen(tx, input);
          const recent = await tx.projectAttempt.count({
            where: {
              userId: input.userId,
              createdAt: { gte: new Date(input.now.getTime() - EXERCISE_ATTEMPT_WINDOW_MS) },
            },
          });
          if (recent >= EXERCISE_ATTEMPT_LIMIT) {
            throw new ProjectRuleError(429, "RATE_LIMITED", "Too many attempts. Try again later.");
          }
          const attemptNumber =
            (await tx.projectAttempt.count({
              where: { userId: input.userId, milestoneId: input.milestoneId },
            })) + 1;
          const created = await tx.projectAttempt.create({
            data: {
              userId: input.userId,
              projectId: input.projectId,
              milestoneId: input.milestoneId,
              clientAttemptId: input.clientAttemptId,
              files: input.files as Prisma.InputJsonValue,
              status: input.passed ? "passed" : "failed",
              score: input.score,
              passed: input.passed,
              feedback: input.feedback,
              passedChecks: input.passedChecks,
              failedChecks: input.failedChecks,
              attemptNumber,
              createdAt: input.now,
            },
          });
          const already = await tx.projectMilestoneProgress.findUnique({
            where: { userId_milestoneId: { userId: input.userId, milestoneId: input.milestoneId } },
          });
          if (!input.passed && already === null) {
            await tx.learningEvent.create({
              data: {
                userId: input.userId,
                conceptId: input.conceptId,
                source: "project",
                sourceId: created.id,
                evidence: PROJECT_FAILURE_EVIDENCE,
                weight: 1,
                metadata: { outcome: "failed" },
              },
            });
            await writeSkillMasteryProjection(tx, {
              userId: input.userId,
              conceptId: input.conceptId,
              now: input.now,
              timeZone: input.timeZone,
            });
          }
          if (input.passed && already === null) {
            await tx.projectMilestoneProgress.create({
              data: {
                userId: input.userId,
                milestoneId: input.milestoneId,
                score: input.score,
                passedAt: input.now,
              },
            });
            const update = exerciseMasteryUpdate(input.score);
            if (update !== null) {
              await tx.learningEvent.create({
                data: {
                  userId: input.userId,
                  conceptId: input.conceptId,
                  source: "project",
                  sourceId: created.id,
                  evidence: update.evidence,
                  weight: update.weight,
                  metadata: { outcome: "passed", score: input.score },
                },
              });
              await writeSkillMasteryProjection(tx, {
                userId: input.userId,
                conceptId: input.conceptId,
                now: input.now,
                timeZone: input.timeZone,
              });
            }
          }
          return toAttempt(created, input.milestoneSlug);
        },
        { maxWait: 5_000, timeout: 10_000 },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existing = await this.findClientAttempt(
          input.userId,
          input.milestoneId,
          input.clientAttemptId,
        );
        if (existing !== null) {
          return existing;
        }
      }
      throw error;
    }
  }

  async listAttempts(
    userId: string,
    milestoneId: string,
    milestoneSlug: string,
  ): Promise<ProjectAttemptView[]> {
    const rows = await this.prisma.projectAttempt.findMany({
      where: { userId, milestoneId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return rows.map((row) => toAttempt(row, milestoneSlug));
  }

  async prepareReview(input: {
    userId: string;
    projectId: string;
    milestoneId: string;
    attemptId: string;
    clientReviewId: string;
    mode: CodeReviewMode;
    now: Date;
    limit: number;
    windowMs: number;
  }): Promise<ProjectReviewPreparation> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await lockUser(tx, input.userId);
        const attempt = await tx.projectAttempt.findFirst({
          where: {
            id: input.attemptId,
            userId: input.userId,
            projectId: input.projectId,
            milestoneId: input.milestoneId,
          },
          include: {
            milestone: {
              include: {
                concept: { include: { prerequisites: { include: { prerequisite: true } } } },
                project: { include: { requirements: { include: { concept: true } } } },
              },
            },
          },
        });
        if (attempt === null) {
          return null;
        }
        const existing = await tx.projectReview.findUnique({
          where: {
            userId_attemptId_clientReviewId_mode: {
              userId: input.userId,
              attemptId: input.attemptId,
              clientReviewId: input.clientReviewId,
              mode: input.mode,
            },
          },
        });
        if (existing?.status === "completed") {
          return { kind: "stored", review: existing.result };
        }
        if (existing?.status === "pending") {
          return { kind: "wait" };
        }
        const windowStart = new Date(
          Math.floor(input.now.getTime() / input.windowMs) * input.windowMs,
        );
        const bucket = await tx.authRateBucket.upsert({
          where: {
            action_subjectHash_windowStart: {
              action: "project_review",
              subjectHash: input.userId,
              windowStart,
            },
          },
          create: {
            action: "project_review",
            subjectHash: input.userId,
            windowStart,
            hits: 1,
          },
          update: { hits: { increment: 1 } },
        });
        if (bucket.hits > input.limit) {
          return { kind: "limited" };
        }
        const hints = await tx.projectReview.count({
          where: { attemptId: input.attemptId, mode: "hint", status: "completed" },
        });
        const user = await tx.user.findUnique({
          where: { id: input.userId },
          select: { locale: true, studentPreferences: { select: { explanationStyle: true } } },
        });
        const concepts = reviewConcepts(attempt.milestone);
        const mastery = await tx.skillMastery.findMany({
          where: {
            userId: input.userId,
            concept: { slug: { in: concepts.map((item) => item.slug) } },
          },
          include: { concept: { select: { slug: true } } },
        });
        const review = await tx.projectReview.create({
          data: {
            userId: input.userId,
            projectId: input.projectId,
            milestoneId: input.milestoneId,
            attemptId: input.attemptId,
            clientReviewId: input.clientReviewId,
            mode: input.mode,
            status: "pending",
          },
        });
        const files = projectFilesSchema.safeParse(attempt.files);
        if (!files.success || user === null) {
          return null;
        }
        const bands = new Map(mastery.map((row) => [row.concept.slug, band(row.score)]));
        return {
          kind: "claimed",
          reviewId: review.id,
          hintLevel: Math.min(3, hints + 1),
          target: {
            title: attempt.milestone.title,
            objective: attempt.milestone.objective,
            instructions: attempt.milestone.instructions,
            files: files.data,
            feedback: attempt.feedback,
            score: attempt.score,
            passed: attempt.passed,
            passedChecks: readStrings(attempt.passedChecks),
            failedChecks: readStrings(attempt.failedChecks),
            concepts: concepts.map((item) => ({
              ...item,
              mastery: bands.get(item.slug) ?? null,
            })),
            allowedConceptSlugs: concepts.map((item) => item.slug),
            locale: toReviewLocale(user.locale),
            explanationStyle: user.studentPreferences?.explanationStyle ?? "clear",
          },
        };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return { kind: "wait" };
      }
      throw error;
    }
  }

  async findReview(input: {
    userId: string;
    attemptId: string;
    clientReviewId: string;
    mode: CodeReviewMode;
  }): Promise<{ status: "completed"; review: unknown } | { status: "pending" } | null> {
    const row = await this.prisma.projectReview.findUnique({
      where: { userId_attemptId_clientReviewId_mode: input },
    });
    if (row === null) {
      return null;
    }
    return row.status === "completed"
      ? { status: "completed", review: row.result }
      : { status: "pending" };
  }

  async completeReview(reviewId: string, result: unknown, now: Date): Promise<void> {
    await this.prisma.projectReview.update({
      where: { id: reviewId },
      data: { status: "completed", result: result as Prisma.InputJsonValue, completedAt: now },
    });
  }

  async releaseReview(reviewId: string): Promise<void> {
    await this.prisma.projectReview.deleteMany({ where: { id: reviewId, status: "pending" } });
  }

  async recordReviewUsage(input: {
    userId: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    costMicros: bigint;
    latencyMs: number;
    correlationId: string;
    taskType?: "project_review" | "project_plan";
  }): Promise<void> {
    await this.prisma.aiUsage.create({
      data: {
        userId: input.userId,
        sessionId: null,
        taskType: input.taskType ?? "project_review",
        provider: input.provider,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costMicros: input.costMicros,
        latencyMs: input.latencyMs,
        cached: false,
        correlationId: input.correlationId,
      },
    });
  }

  async savePlan(input: { userId: string; projectId: string; body: string }): Promise<ProjectPlanView> {
    const row = await this.prisma.projectPlan.upsert({
      where: { userId_projectId: { userId: input.userId, projectId: input.projectId } },
      create: { userId: input.userId, projectId: input.projectId, body: input.body },
      update: { body: input.body },
    });
    return toPlan(row);
  }

  async savePlanReview(input: {
    userId: string;
    projectId: string;
    review: ProjectPlanReview;
  }): Promise<ProjectPlanView> {
    const row = await this.prisma.projectPlan.update({
      where: { userId_projectId: { userId: input.userId, projectId: input.projectId } },
      data: { review: input.review as unknown as Prisma.InputJsonValue },
    });
    return toPlan(row);
  }

  async countRecentUsage(userId: string, taskType: string, since: Date): Promise<number> {
    return this.prisma.aiUsage.count({
      where: { userId, taskType, createdAt: { gte: since } },
    });
  }

  async learningSignal(userId: string, conceptId: string): Promise<ProjectLearningSignal | null> {
    const concept = await this.prisma.concept.findUnique({
      where: { id: conceptId },
      select: { slug: true, prerequisites: { select: { prerequisiteId: true } } },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    if (concept === null || user === null) {
      return null;
    }
    const mastery = await this.prisma.skillMastery.findUnique({
      where: { userId_conceptId: { userId, conceptId } },
      select: { score: true, evidenceCount: true, lastEvidenceAt: true },
    });
    const prerequisiteIds = concept.prerequisites.map((item) => item.prerequisiteId);
    const prerequisites =
      prerequisiteIds.length === 0
        ? []
        : await this.prisma.skillMastery.findMany({
            where: { userId, conceptId: { in: prerequisiteIds } },
            select: { score: true, evidenceCount: true },
          });
    const misconceptions = await this.prisma.misconception.findMany({
      where: { userId, conceptId, status: "active" },
      select: { occurrenceCount: true },
      take: 5,
    });
    const events = await this.prisma.learningEvent.findMany({
      where: { userId, conceptId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { source: true, evidence: true, createdAt: true },
    });
    const choice = decideAdaptive({
      now: new Date(),
      timeZone: user.timezone,
      concept: {
        score: mastery?.score ?? null,
        evidenceCount: mastery?.evidenceCount ?? 0,
        lastEvidenceAt: mastery?.lastEvidenceAt ?? null,
      },
      prerequisiteWeak: prerequisites.some((item) => prerequisiteIsWeak(item)),
      misconceptionOccurrences: misconceptions.reduce(
        (highest, item) => Math.max(highest, item.occurrenceCount),
        0,
      ),
      recent: events.map((event) => ({
        source: event.source,
        outcome: classifyStoredEvidence(event.source, event.evidence),
        occurredAt: event.createdAt,
      })),
    });
    return { conceptSlug: concept.slug, ...choice };
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }

  private async masteryRows(
    userId: string,
  ): Promise<Map<string, { score: number; evidenceCount: number }>> {
    const rows = await this.prisma.skillMastery.findMany({
      where: { userId },
      select: { conceptId: true, score: true, evidenceCount: true },
    });
    return new Map(
      rows.map((row) => [row.conceptId, { score: row.score, evidenceCount: row.evidenceCount }]),
    );
  }
}

function eligible(
  requirements: Array<{ conceptId: string }>,
  mastery: Map<string, { score: number; evidenceCount: number }>,
): boolean {
  return (
    requirements.length > 0 &&
    requirements.every((item) => (mastery.get(item.conceptId)?.score ?? 0) >= UNLOCK_MASTERY)
  );
}

function toPlan(row: { body: string; updatedAt: Date; review: Prisma.JsonValue }): ProjectPlanView {
  return {
    body: row.body,
    updatedAt: row.updatedAt.toISOString(),
    review: readPlanReview(row.review),
  };
}

function readPlanReview(value: Prisma.JsonValue): ProjectPlanReview | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const summary = value.summary;
  const strengths = value.strengths;
  const risks = value.risks;
  const suggestions = value.suggestions;
  const questions = value.questions;
  if (
    typeof summary !== "string" ||
    !isStringList(strengths) ||
    !isStringList(risks) ||
    !isStringList(suggestions) ||
    !isStringList(questions)
  ) {
    return null;
  }
  return { summary, strengths, risks, suggestions, questions };
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function milestoneStatus(passed: boolean, sawCurrent: boolean): ProjectMilestoneStatus {
  if (passed) {
    return "passed";
  }
  return sawCurrent ? "locked" : "current";
}

function allPassed(milestones: Array<{ id: string }>, passedIds: Set<string>): boolean {
  return milestones.length > 0 && milestones.every((item) => passedIds.has(item.id));
}

async function assertMilestoneOpen(
  tx: Prisma.TransactionClient,
  input: { userId: string; projectId: string; milestoneId: string },
): Promise<void> {
  const milestone = await tx.projectMilestone.findUnique({ where: { id: input.milestoneId } });
  if (milestone === null || milestone.projectId !== input.projectId) {
    throw new ProjectRuleError(404, "NOT_FOUND", "That project was not found.");
  }
  if (milestone.position === 1) {
    return;
  }
  const previous = await tx.projectMilestone.findUnique({
    where: { projectId_position: { projectId: input.projectId, position: milestone.position - 1 } },
  });
  if (previous === null) {
    throw new ProjectRuleError(404, "NOT_FOUND", "That project was not found.");
  }
  const progress = await tx.projectMilestoneProgress.findUnique({
    where: { userId_milestoneId: { userId: input.userId, milestoneId: previous.id } },
  });
  if (progress === null) {
    throw new ProjectRuleError(404, "NOT_FOUND", "That project was not found.");
  }
}

function claimKey(input: {
  userId: string;
  projectId: string;
  milestoneId: string;
  clientAttemptId: string;
}): {
  userId: string;
  projectId: string;
  milestoneId: string;
  clientAttemptId: string;
} {
  return {
    userId: input.userId,
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    clientAttemptId: input.clientAttemptId,
  };
}

function toAttempt(
  row: {
    id: string;
    status: "passed" | "failed";
    score: number;
    passed: boolean;
    feedback: string;
    passedChecks: Prisma.JsonValue;
    failedChecks: Prisma.JsonValue;
    files: Prisma.JsonValue;
    attemptNumber: number;
    createdAt: Date;
  },
  milestoneSlug: string,
): ProjectAttemptView {
  const files = projectFilesSchema.safeParse(row.files);
  return {
    id: row.id,
    milestoneSlug,
    status: row.status,
    score: row.score,
    passed: row.passed,
    feedback: row.feedback,
    passedChecks: readStrings(row.passedChecks),
    failedChecks: readStrings(row.failedChecks),
    files: files.success ? files.data : { "index.html": "", "style.css": "", "script.js": "" },
    attemptNumber: row.attemptNumber,
    createdAt: row.createdAt.toISOString(),
  };
}

function readStrings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toReviewLocale(locale: string): Locale {
  if (locale === "az_AZ" || locale === "az-AZ") {
    return "az-AZ";
  }
  if (locale === "en" || locale === "tr" || locale === "ru") {
    return locale;
  }
  return "az-AZ";
}

function band(score: number): "weak" | "developing" | "secure" {
  if (score < 45) {
    return "weak";
  }
  if (score < 75) {
    return "developing";
  }
  return "secure";
}

function reviewConcepts(milestone: {
  concept: {
    slug: string;
    name: string;
    prerequisites: Array<{ prerequisite: { slug: string; name: string } }>;
  };
  project: { requirements: Array<{ concept: { slug: string; name: string } }> };
}): Array<{ slug: string; name: string }> {
  const concepts = [
    { slug: milestone.concept.slug, name: milestone.concept.name },
    ...milestone.concept.prerequisites.map((item) => item.prerequisite),
    ...milestone.project.requirements.map((item) => item.concept),
  ];
  const seen = new Set<string>();
  return concepts.filter((item) => {
    if (seen.has(item.slug)) {
      return false;
    }
    seen.add(item.slug);
    return true;
  });
}

async function assertProjectFeature(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<void> {
  const commercial = await readCommercialPlan(tx, userId, now);
  if (commercial === null) {
    return;
  }
  try {
    assertFeature(commercial, "projects");
  } catch (error) {
    if (error instanceof CommercialRuleError) {
      throw new ProjectRuleError(error.status, error.code, error.message);
    }
    throw error;
  }
}

async function lockUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE id = CAST(${userId} AS uuid) FOR UPDATE
  `;
  if (rows.length === 0) {
    throw new ProjectRuleError(404, "NOT_FOUND", "That project was not found.");
  }
}
