import { randomUUID } from "node:crypto";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";
import { seedCurriculum } from "./curriculum-seed";
import { PrismaClient } from "./generated/prisma/client";
import { createIdentityRepository } from "./prisma-identity-repository";
import { writeSkillMasteryProjection } from "./progress-repository";

loadEnv({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = databaseUrl !== undefined && databaseUrl.length > 0;

if (!databaseConfigured) {
  console.warn("Learning repository integration tests skipped: DATABASE_URL is not set.");
}

describe.skipIf(!databaseConfigured)("learning schema", () => {
  it("seeds the curriculum once, projects mastery, and enforces one active enrollment", async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: requiredDatabaseUrl() }),
    });
    const repository = createIdentityRepository(requiredDatabaseUrl());
    const email = `learner-${randomUUID()}@example.com`;
    try {
      await seedCurriculum(prisma);
      const firstCount = await prisma.concept.count();
      await seedCurriculum(prisma);
      expect(await prisma.concept.count()).toBe(firstCount);

      const quotas = await prisma.$queryRaw<Array<{ name: string | null }>>`
        SELECT to_regclass('public.quotas')::text AS name
      `;
      expect(quotas[0]?.name).toBeNull();

      const free = await prisma.plan.findUniqueOrThrow({ where: { code: "free" } });
      expect(free.dailyTeacherTurns).toBe(40);
      expect(free.monthlyTeacherTurns).toBe(600);
      expect(await prisma.plan.count({ where: { code: { not: "free" } } })).toBe(3);
      expect(await prisma.planPrice.count()).toBe(4);

      const frontend = await prisma.learningPath.findUniqueOrThrow({
        where: { slug: "frontend" },
        include: { modules: { include: { lessons: { include: { blocks: true } } } } },
      });
      expect(frontend.status).toBe("published");
      const publishedLessons = frontend.modules.flatMap((module) =>
        module.lessons.filter((lesson) => lesson.status === "published"),
      );
      expect(publishedLessons).toHaveLength(79);
      expect(publishedLessons.every((lesson) => lesson.blocks.length >= 3)).toBe(true);

      const backend = await prisma.learningPath.findUniqueOrThrow({
        where: { slug: "backend" },
        include: { modules: { include: { lessons: true } } },
      });
      expect(backend.status).toBe("draft");
      expect(
        backend.modules.every((module) =>
          module.lessons.every((lesson) => lesson.status === "draft"),
        ),
      ).toBe(true);

      const user = await repository.createUser({ email, passwordHash: "argon2id-hash" });
      expect(await prisma.enrollment.count({ where: { userId: user.id } })).toBe(0);
      expect(await prisma.userPlan.count({ where: { userId: user.id } })).toBe(0);

      const concept = await prisma.concept.findUniqueOrThrow({ where: { slug: "web.http" } });
      const now = new Date("2026-04-02T12:00:00.000Z");
      await prisma.learningEvent.createMany({
        data: [
          {
            userId: user.id,
            conceptId: concept.id,
            source: "lesson_check",
            evidence: 20,
            weight: 1.2,
            metadata: { kind: "check" },
            createdAt: new Date("2026-04-02T10:00:00.000Z"),
          },
          {
            userId: user.id,
            conceptId: concept.id,
            source: "lesson_check",
            evidence: 20,
            weight: 1,
            metadata: { kind: "check" },
            createdAt: new Date("2026-04-02T11:00:00.000Z"),
          },
        ],
      });
      const projection = await writeSkillMasteryProjection(prisma, {
        userId: user.id,
        conceptId: concept.id,
        now,
        timeZone: "UTC",
      });
      expect(projection).toMatchObject({ score: 20, evidenceCount: 2 });
      const stored = await prisma.skillMastery.findUniqueOrThrow({
        where: { userId_conceptId: { userId: user.id, conceptId: concept.id } },
      });
      expect(stored.evidenceCount).toBe(2);
      expect(stored.score).toBe(20);

      await prisma.enrollment.create({
        data: { userId: user.id, pathId: frontend.id, status: "active" },
      });
      await expect(
        prisma.enrollment.create({
          data: { userId: user.id, pathId: backend.id, status: "active" },
        }),
      ).rejects.toMatchObject({ code: "P2002" });

      const lesson = publishedLessons[0];
      if (lesson === undefined) {
        throw new Error("published lesson missing");
      }
      await prisma.teachingSession.create({
        data: { userId: user.id, lessonId: lesson.id, mode: "explain", state: "created" },
      });
      await expect(
        prisma.teachingSession.create({
          data: { userId: user.id, lessonId: lesson.id, mode: "socratic", state: "explain" },
        }),
      ).rejects.toMatchObject({ code: "P2002" });
    } finally {
      await prisma.user.deleteMany({ where: { email } });
      await repository.disconnect();
      await prisma.$disconnect();
    }
  });
});

function requiredDatabaseUrl(): string {
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required.");
  }
  return databaseUrl;
}
