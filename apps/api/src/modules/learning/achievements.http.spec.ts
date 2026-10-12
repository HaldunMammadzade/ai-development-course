import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SESSION_COOKIE_NAME } from "@platform/config";
import {
  createPlatformPrisma,
  seedCurriculumDatabase,
  type IdentityRepository,
  type PrismaClient,
} from "@platform/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { configureApp } from "../../configure-app";
import { IDENTITY_REPOSITORY } from "../identity/identity.repository";
import { IdentityModule } from "../identity/identity.module";
import { createOpaqueToken, hashOpaqueToken } from "../identity/opaque-token";

const PASSWORD = "correct horse battery";
const EMAIL_PREFIX = "achievement-step41-";
const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = databaseUrl !== undefined && databaseUrl.length > 0;

describe.skipIf(!databaseConfigured)("achievements HTTP", () => {
  let app: INestApplication;
  let repository: IdentityRepository;
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.PORT;
    await seedCurriculumDatabase(requiredDatabaseUrl());
    prisma = createPlatformPrisma(requiredDatabaseUrl());
    const { AppModule } = await import("../../app.module");
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    repository = app.select(IdentityModule).get<IdentityRepository>(IDENTITY_REPOSITORY);
  }, 60_000);

  afterAll(async () => {
    if (repository !== undefined) {
      await repository.deleteUsersByEmailPrefix(EMAIL_PREFIX);
    }
    if (app !== undefined) {
      await app.close();
    }
    if (prisma !== undefined) {
      await prisma.$disconnect();
    }
  });

  it("derives milestones from stored learning and ignores client status", async () => {
    expect((await get("/api/v1/achievements")).status).toBe(401);

    const unverified = await registerOnly("Unverified");
    const token = createOpaqueToken();
    await repository.insertSession({
      userId: unverified.id,
      tokenHash: hashOpaqueToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    expect((await get("/api/v1/achievements", token)).status).toBe(403);

    const student = await signIn("Aysel");
    const beforeEvents = await prisma.learningEvent.count({ where: { userId: student.id } });
    const beforeAction = await get("/api/v1/learning/catalog", student.cookie);
    const empty = await get("/api/v1/achievements", student.cookie);
    const afterRead = await get("/api/v1/learning/catalog", student.cookie);
    expect(afterRead.body.nextAction).toEqual(beforeAction.body.nextAction);
    expect(empty.status).toBe(200);
    expect(byId(empty.body, "first-lesson")?.state).toBe("locked");
    expect(byId(empty.body, "skill-map")?.state).toBe("locked");
    expect(byId(empty.body, "first-exercise")?.state).toBe("locked");
    expect(byId(empty.body, "first-revision")?.state).toBe("locked");
    expect(byId(empty.body, "html-foundations")?.state).toBe("locked");
    expect(byId(empty.body, "first-project")?.state).toBe("locked");
    expect(byId(empty.body, "first-interview")?.state).toBe("locked");
    expect(empty.body.earnedCount).toBe(0);
    expect(empty.body.latest).toBeNull();
    expect(JSON.stringify(empty.body)).not.toContain("evidence");
    expect(JSON.stringify(empty.body)).not.toContain("mastery");
    expect(JSON.stringify(empty.body)).not.toContain("metadata");

    const tamper = await request(app.getHttpServer())
      .post("/api/v1/achievements")
      .set("X-Requested-With", "fetch")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${student.cookie}`)
      .send({ achievementId: "html-foundations", earned: true, earnedAt: "2000-01-01" });
    expect(tamper.status).toBe(404);

    await prisma.skillAssessment.upsert({
      where: { userId: student.id },
      create: {
        userId: student.id,
        status: "skipped",
        completedAt: new Date("2026-10-01T00:00:00.000Z"),
      },
      update: { status: "skipped", completedAt: new Date("2026-10-01T00:00:00.000Z") },
    });
    expect(byId((await get("/api/v1/achievements", student.cookie)).body, "skill-map")?.state).toBe(
      "locked",
    );

    const assessedAt = new Date("2026-10-02T00:00:00.000Z");
    await prisma.skillAssessment.update({
      where: { userId: student.id },
      data: { status: "completed", completedAt: assessedAt },
    });
    expect(
      byId((await get("/api/v1/achievements", student.cookie)).body, "skill-map"),
    ).toMatchObject({
      state: "earned",
      earnedAt: assessedAt.toISOString(),
    });

    const concept = await prisma.concept.findUnique({ where: { slug: "web.http" } });
    expect(concept).not.toBeNull();
    await prisma.learningEvent.create({
      data: {
        userId: student.id,
        conceptId: concept?.id ?? "",
        source: "exercise",
        evidence: 70,
        weight: 1,
        createdAt: new Date("2026-10-04T00:00:00.000Z"),
      },
    });
    const practiced = await get("/api/v1/achievements", student.cookie);
    expect(byId(practiced.body, "first-exercise")?.state).toBe("earned");
    expect(byId(practiced.body, "first-revision")?.state).toBe("locked");

    await prisma.learningEvent.create({
      data: {
        userId: student.id,
        conceptId: concept?.id ?? "",
        source: "exercise",
        evidence: 90,
        weight: 1,
        createdAt: new Date("2026-10-05T00:00:00.000Z"),
      },
    });
    expect(
      byId((await get("/api/v1/achievements", student.cookie)).body, "first-revision")?.state,
    ).toBe("locked");
    await prisma.learningEvent.create({
      data: {
        userId: student.id,
        conceptId: concept?.id ?? "",
        source: "exercise",
        evidence: 90,
        weight: 1,
        createdAt: new Date("2026-10-06T00:00:00.000Z"),
      },
    });
    const reviewed = await get("/api/v1/achievements", student.cookie);
    expect(byId(reviewed.body, "first-revision")).toMatchObject({
      state: "earned",
      earnedAt: "2026-10-06T00:00:00.000Z",
    });

    const htmlLessons = await prisma.lesson.findMany({
      where: { status: "published", module: { slug: "html" } },
      select: { id: true },
    });
    expect(htmlLessons.length).toBeGreaterThan(1);
    const firstHtml = htmlLessons[0];
    expect(firstHtml).toBeDefined();
    await prisma.lessonProgress.create({
      data: {
        userId: student.id,
        lessonId: firstHtml?.id ?? "",
        status: "completed",
        completedAt: new Date("2026-10-03T00:00:00.000Z"),
      },
    });
    expect(
      byId((await get("/api/v1/achievements", student.cookie)).body, "html-foundations")?.state,
    ).toBe("locked");
    expect(
      byId((await get("/api/v1/achievements", student.cookie)).body, "first-lesson")?.state,
    ).toBe("earned");

    const moduleDone = new Date("2026-10-08T00:00:00.000Z");
    for (const lesson of htmlLessons) {
      await prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId: student.id, lessonId: lesson.id } },
        create: {
          userId: student.id,
          lessonId: lesson.id,
          status: "completed",
          completedAt: moduleDone,
        },
        update: { status: "completed", completedAt: moduleDone },
      });
    }
    expect(
      byId((await get("/api/v1/achievements", student.cookie)).body, "html-foundations"),
    ).toMatchObject({
      state: "earned",
      earnedAt: moduleDone.toISOString(),
    });

    const interview = await prisma.interview.findFirst({
      where: { status: "published" },
      select: { id: true },
    });
    expect(interview).not.toBeNull();
    await prisma.interviewSession.create({
      data: { userId: student.id, interviewId: interview?.id ?? "", status: "active" },
    });
    expect(
      byId((await get("/api/v1/achievements", student.cookie)).body, "first-interview")?.state,
    ).toBe("locked");
    const interviewedAt = new Date("2026-10-07T00:00:00.000Z");
    await prisma.interviewSession.create({
      data: {
        userId: student.id,
        interviewId: interview?.id ?? "",
        status: "completed",
        completedAt: interviewedAt,
      },
    });
    expect(
      byId((await get("/api/v1/achievements", student.cookie)).body, "first-interview"),
    ).toMatchObject({
      state: "earned",
      earnedAt: interviewedAt.toISOString(),
    });

    const project = await prisma.project.findFirst({
      where: { status: "published" },
      select: { milestones: { select: { id: true } } },
    });
    expect(project).not.toBeNull();
    expect(project?.milestones.length).toBeGreaterThan(0);
    const projectAt = new Date("2026-10-09T00:00:00.000Z");
    for (const milestone of project?.milestones ?? []) {
      await prisma.projectMilestoneProgress.create({
        data: { userId: student.id, milestoneId: milestone.id, score: 100, passedAt: projectAt },
      });
    }
    const finished = await get("/api/v1/achievements", student.cookie);
    expect(byId(finished.body, "first-project")).toMatchObject({
      state: "earned",
      earnedAt: projectAt.toISOString(),
    });
    expect(finished.body.latest.id).toBe("first-project");
    const again = await get("/api/v1/achievements", student.cookie);
    expect(again.body).toEqual(finished.body);
    expect(await prisma.learningEvent.count({ where: { userId: student.id } })).toBe(
      beforeEvents + 3,
    );
    const reread = await get("/api/v1/achievements", student.cookie);
    expect(reread.body).toEqual(again.body);
  });

  async function signIn(name: string): Promise<{ id: string; cookie: string }> {
    const email = uniqueEmail();
    const created = await post("/api/v1/auth/register").send({
      email,
      password: PASSWORD,
      name,
      timezone: "Asia/Baku",
    });
    expect(created.status).toBe(201);
    const verification = headerValue(created, "x-development-verification-token");
    expect((await post("/api/v1/auth/verify-email").send({ token: verification })).status).toBe(
      200,
    );
    const loggedIn = await post("/api/v1/auth/login").send({ email, password: PASSWORD });
    expect(loggedIn.status).toBe(200);
    return { id: created.body.id as string, cookie: sessionCookie(loggedIn) };
  }

  async function registerOnly(name: string): Promise<{ id: string }> {
    const created = await post("/api/v1/auth/register").send({
      email: uniqueEmail(),
      password: PASSWORD,
      name,
      timezone: "Asia/Baku",
    });
    expect(created.status).toBe(201);
    return { id: created.body.id as string };
  }

  function post(path: string, cookie?: string): request.Test {
    const req = request(app.getHttpServer()).post(path).set("X-Requested-With", "fetch");
    return cookie === undefined ? req : req.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  }

  function get(path: string, cookie?: string): request.Test {
    const req = request(app.getHttpServer()).get(path).set("X-Requested-With", "fetch");
    return cookie === undefined ? req : req.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  }
});

function byId(
  body: { items?: Array<{ id: string; state: string; earnedAt: string | null }> },
  id: string,
): { id: string; state: string; earnedAt: string | null } | undefined {
  return body.items?.find((item) => item.id === id);
}

function uniqueEmail(): string {
  return `${EMAIL_PREFIX}${randomUUID()}@example.com`;
}

function requiredDatabaseUrl(): string {
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required.");
  }
  return databaseUrl;
}

function headerValue(response: request.Response, name: string): string {
  const value = response.headers[name];
  expect(typeof value).toBe("string");
  return value as string;
}

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"];
  const lines = header === undefined ? [] : Array.isArray(header) ? header : [header];
  const match = lines.find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`));
  expect(match).toBeDefined();
  return decodeURIComponent(match?.split(";")[0]?.slice(`${SESSION_COOKIE_NAME}=`.length) ?? "");
}
