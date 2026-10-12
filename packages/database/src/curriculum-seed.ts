import { PrismaPg } from "@prisma/adapter-pg";
import { FREE_DAILY_TEACHER_TURNS, FREE_MONTHLY_TEACHER_TURNS } from "@platform/config";
import {
  frontendCurriculum,
  frontendInterviews,
  frontendProjects,
  frontendSpeakingQuestions,
} from "@platform/curriculum";
import {
  interviewSeedSchema,
  projectSeedSchema,
  type InterviewSeedInput,
  type ProjectSeed,
} from "@platform/validation";
import type { ExerciseDefinition, LessonBlock } from "@platform/types";
import { validateCurriculum } from "@platform/validation";
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { PLAN_CATALOG } from "./plan-catalog";

export async function seedCurriculum(prisma: PrismaClient): Promise<void> {
  const document = validateCurriculum(frontendCurriculum);

  await prisma.$transaction(
    async (tx) => {
      const conceptIds = new Map<string, string>();
      const lessonIds = new Map<string, string>();
      for (const concept of document.concepts) {
        const row = await tx.concept.upsert({
          where: { slug: concept.slug },
          create: concept,
          update: {
            name: concept.name,
            domain: concept.domain,
            summary: concept.summary,
          },
        });
        conceptIds.set(concept.slug, row.id);
      }

      for (const path of document.paths) {
        const pathRow = await tx.learningPath.upsert({
          where: { slug: path.slug },
          create: {
            slug: path.slug,
            title: path.title,
            description: path.description,
            track: path.track,
            status: path.status,
            position: path.position,
          },
          update: {
            title: path.title,
            description: path.description,
            track: path.track,
            status: path.status,
            position: path.position,
          },
        });

        for (const module of path.modules) {
          const moduleRow = await tx.module.upsert({
            where: { pathId_slug: { pathId: pathRow.id, slug: module.slug } },
            create: {
              pathId: pathRow.id,
              slug: module.slug,
              title: module.title,
              description: module.description,
              position: module.position,
            },
            update: {
              title: module.title,
              description: module.description,
              position: module.position,
            },
          });

          await tx.lesson.updateMany({
            where: { moduleId: moduleRow.id },
            data: { position: { increment: 1000 } },
          });

          for (const lesson of module.lessons) {
            const existing = await tx.lesson.findFirst({ where: { slug: lesson.slug } });
            const lessonRow =
              existing === null
                ? await tx.lesson.create({
                    data: {
                      moduleId: moduleRow.id,
                      slug: lesson.slug,
                      title: lesson.title,
                      objective: lesson.objective,
                      position: lesson.position,
                      estimatedMinutes: lesson.estimatedMinutes,
                      status: lesson.status,
                    },
                  })
                : await tx.lesson.update({
                    where: { id: existing.id },
                    data: {
                      moduleId: moduleRow.id,
                      title: lesson.title,
                      objective: lesson.objective,
                      position: lesson.position,
                      estimatedMinutes: lesson.estimatedMinutes,
                      status: lesson.status,
                    },
                  });

            await tx.lessonBlock.deleteMany({ where: { lessonId: lessonRow.id } });
            if (lesson.blocks.length > 0) {
              await tx.lessonBlock.createMany({
                data: lesson.blocks.map((block) => ({
                  lessonId: lessonRow.id,
                  position: block.position,
                  type: block.type,
                  body: blockBody(block),
                })),
              });
            }

            await tx.lessonConcept.deleteMany({ where: { lessonId: lessonRow.id } });
            await tx.lessonConcept.createMany({
              data: lesson.concepts.map((link) => ({
                lessonId: lessonRow.id,
                conceptId: requiredId(conceptIds, link.conceptSlug),
                role: link.role,
              })),
            });
            lessonIds.set(lesson.slug, lessonRow.id);
          }
        }
      }

      const seededConceptIds = [...conceptIds.values()];
      await tx.conceptPrerequisite.deleteMany({
        where: { conceptId: { in: seededConceptIds } },
      });
      if (document.prerequisites.length > 0) {
        await tx.conceptPrerequisite.createMany({
          data: document.prerequisites.map((edge) => ({
            conceptId: requiredId(conceptIds, edge.conceptSlug),
            prerequisiteId: requiredId(conceptIds, edge.prerequisiteSlug),
          })),
        });
      }

      for (const exercise of document.exercises) {
        await upsertExercise(tx, exercise, lessonIds, conceptIds);
      }

      for (const project of frontendProjects) {
        await upsertProject(tx, projectSeedSchema.parse(project), conceptIds);
      }

      for (const interview of frontendInterviews) {
        await upsertInterview(tx, interviewSeedSchema.parse(interview), conceptIds);
      }

      for (const question of frontendSpeakingQuestions) {
        const data = {
          conceptId: requiredId(conceptIds, question.conceptSlug),
          position: question.position,
          title: question.title,
          prompt: question.prompt,
          published: question.published,
        };
        await tx.speakingQuestion.upsert({
          where: { slug: question.slug },
          create: { slug: question.slug, ...data },
          update: data,
        });
      }

      for (const plan of PLAN_CATALOG) {
        const teacher =
          plan.code === "free"
            ? {
                dailyTeacherTurns: FREE_DAILY_TEACHER_TURNS,
                monthlyTeacherTurns: FREE_MONTHLY_TEACHER_TURNS,
              }
            : {
                dailyTeacherTurns: plan.dailyTeacherTurns,
                monthlyTeacherTurns: plan.monthlyTeacherTurns,
                dailyStrongCalls: plan.dailyStrongCalls,
              };
        await tx.plan.upsert({
          where: { code: plan.code },
          create: {
            code: plan.code,
            name: plan.name,
            description: plan.description,
            monthlyPriceMinor: plan.monthlyPriceMinor,
            currency: "AZN",
            dailyTeacherTurns:
              plan.code === "free" ? FREE_DAILY_TEACHER_TURNS : plan.dailyTeacherTurns,
            monthlyTeacherTurns:
              plan.code === "free" ? FREE_MONTHLY_TEACHER_TURNS : plan.monthlyTeacherTurns,
            dailyStrongCalls: plan.dailyStrongCalls,
            entitlements: plan.entitlements as unknown as Prisma.InputJsonValue,
            active: true,
          },
          update: {
            name: plan.name,
            description: plan.description,
            monthlyPriceMinor: plan.monthlyPriceMinor,
            entitlements: plan.entitlements as unknown as Prisma.InputJsonValue,
            active: true,
            ...teacher,
          },
        });
        await tx.planPrice.upsert({
          where: { slug: plan.priceSlug },
          create: {
            planCode: plan.code,
            slug: plan.priceSlug,
            currency: "AZN",
            amountMinor: plan.monthlyPriceMinor,
            billingInterval: "month",
            providerPriceId: plan.providerPriceId,
            active: true,
          },
          update: {
            amountMinor: plan.monthlyPriceMinor,
            currency: "AZN",
            providerPriceId: plan.providerPriceId,
            active: true,
          },
        });
      }
    },
    { maxWait: 20_000, timeout: 20_000 },
  );
}

function blockBody(block: LessonBlock): Prisma.InputJsonValue {
  if (block.type === "reading") {
    return { markdown: block.markdown, conceptSlugs: block.conceptSlugs };
  }
  if (block.type === "check_question") {
    return {
      prompt: block.prompt,
      rubric: block.rubric,
      conceptSlugs: block.conceptSlugs,
      difficulty: block.difficulty,
      ...(block.harder === true ? { harder: true } : {}),
    };
  }
  return { points: block.points, practicePrompt: block.practicePrompt };
}

export async function seedCurriculumDatabase(databaseUrl: string): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  try {
    await seedCurriculum(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

async function upsertExercise(
  tx: Prisma.TransactionClient,
  exercise: ExerciseDefinition,
  lessonIds: Map<string, string>,
  conceptIds: Map<string, string>,
): Promise<void> {
  const data = {
    lessonId: requiredId(lessonIds, exercise.lessonSlug),
    conceptId: requiredId(conceptIds, exercise.conceptSlug),
    title: exercise.title,
    prompt: exercise.prompt,
    instructions: exercise.instructions,
    type: exercise.type,
    language: exercise.language,
    difficulty: exercise.difficulty,
    position: exercise.position,
    starterCode: exercise.starterCode,
    rules: JSON.parse(JSON.stringify(exercise.rules)) as Prisma.InputJsonValue,
    options: JSON.parse(JSON.stringify(exercise.options)) as Prisma.InputJsonValue,
    execution:
      exercise.execution == null
        ? Prisma.DbNull
        : (JSON.parse(JSON.stringify(exercise.execution)) as Prisma.InputJsonValue),
    published: exercise.published,
  };
  await tx.exercise.upsert({
    where: { slug: exercise.slug },
    create: { slug: exercise.slug, ...data },
    update: data,
  });
}

async function upsertProject(
  tx: Prisma.TransactionClient,
  project: ProjectSeed,
  conceptIds: Map<string, string>,
): Promise<void> {
  const positions = new Set(project.milestones.map((milestone) => milestone.position));
  if (positions.size !== project.milestones.length) {
    throw new Error(`Project ${project.slug} has duplicate milestone positions.`);
  }
  const row = await tx.project.upsert({
    where: { slug: project.slug },
    create: {
      slug: project.slug,
      title: project.title,
      description: project.description,
      objective: project.objective,
      difficulty: project.difficulty,
      estimatedMinutes: project.estimatedMinutes,
      status: project.status,
    },
    update: {
      title: project.title,
      description: project.description,
      objective: project.objective,
      difficulty: project.difficulty,
      estimatedMinutes: project.estimatedMinutes,
      status: project.status,
    },
  });
  await tx.projectRequirement.deleteMany({ where: { projectId: row.id } });
  await tx.projectRequirement.createMany({
    data: project.requiredConcepts.map((slug) => ({
      projectId: row.id,
      conceptId: requiredId(conceptIds, slug),
    })),
  });
  for (const milestone of project.milestones) {
    const data = {
      conceptId: requiredId(conceptIds, milestone.conceptSlug),
      position: milestone.position,
      title: milestone.title,
      objective: milestone.objective,
      instructions: milestone.instructions,
      starterFiles: JSON.parse(JSON.stringify(milestone.starterFiles)) as Prisma.InputJsonValue,
      checks: JSON.parse(JSON.stringify(milestone.checks)) as Prisma.InputJsonValue,
    };
    await tx.projectMilestone.upsert({
      where: { projectId_slug: { projectId: row.id, slug: milestone.slug } },
      create: { projectId: row.id, slug: milestone.slug, ...data },
      update: data,
    });
  }
}

async function upsertInterview(
  tx: Prisma.TransactionClient,
  interview: InterviewSeedInput,
  conceptIds: Map<string, string>,
): Promise<void> {
  const row = await tx.interview.upsert({
    where: { slug: interview.slug },
    create: {
      slug: interview.slug,
      title: interview.title,
      description: interview.description,
      objective: interview.objective,
      difficulty: interview.difficulty,
      estimatedMinutes: interview.estimatedMinutes,
      status: interview.published ? "published" : "draft",
    },
    update: {
      title: interview.title,
      description: interview.description,
      objective: interview.objective,
      difficulty: interview.difficulty,
      estimatedMinutes: interview.estimatedMinutes,
      status: interview.published ? "published" : "draft",
    },
  });
  await tx.interviewRequirement.deleteMany({ where: { interviewId: row.id } });
  await tx.interviewRequirement.createMany({
    data: interview.requirementSlugs.map((slug) => ({
      interviewId: row.id,
      conceptId: requiredId(conceptIds, slug),
    })),
  });
  const ids = new Map<string, string>();
  for (const question of interview.questions) {
    const data = {
      conceptId: requiredId(conceptIds, question.conceptSlug),
      position: question.position,
      title: question.title,
      prompt: question.prompt,
      type: question.type,
      difficulty: question.difficulty,
      status: question.published ? ("published" as const) : ("draft" as const),
      criteria: question.criteria,
      weight: question.weight,
      starterCode: question.starterCode ?? null,
      execution:
        question.execution === undefined
          ? Prisma.DbNull
          : (JSON.parse(JSON.stringify(question.execution)) as Prisma.InputJsonValue),
    };
    const saved = await tx.interviewQuestion.upsert({
      where: { interviewId_slug: { interviewId: row.id, slug: question.slug } },
      create: { interviewId: row.id, slug: question.slug, ...data },
      update: data,
    });
    ids.set(question.slug, saved.id);
  }
  for (const question of interview.questions) {
    const id = ids.get(question.slug);
    const parentId =
      question.parentSlug === undefined ? null : (ids.get(question.parentSlug) ?? null);
    if (id !== undefined) {
      await tx.interviewQuestion.update({ where: { id }, data: { parentId } });
    }
  }
}

function requiredId(ids: Map<string, string>, slug: string): string {
  const id = ids.get(slug);
  if (id === undefined) {
    throw new Error(`Curriculum seed is missing ${slug}.`);
  }
  return id;
}
