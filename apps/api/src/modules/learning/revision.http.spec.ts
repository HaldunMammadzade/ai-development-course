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
const EMAIL_PREFIX = "revision-step40-";
const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = databaseUrl !== undefined && databaseUrl.length > 0;

describe.skipIf(!databaseConfigured)("revision HTTP", () => {
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

  it("requires a verified student and ignores client scheduling input", async () => {
    expect((await get("/api/v1/revision")).status).toBe(401);

    const unverified = await registerOnly("Unverified");
    const token = createOpaqueToken();
    await repository.insertSession({
      userId: unverified.id,
      tokenHash: hashOpaqueToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    expect((await get("/api/v1/revision", token)).status).toBe(403);

    const student = await signIn("Aysel");
    const empty = await get("/api/v1/revision", student.cookie);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({ status: "empty", items: [] });
    expect(JSON.stringify(empty.body)).not.toContain("dueAt");
    expect(JSON.stringify(empty.body)).not.toContain("mastery");
    expect(JSON.stringify(empty.body)).not.toContain("rules");

    const tamper = await request(app.getHttpServer())
      .post("/api/v1/revision")
      .set("X-Requested-With", "fetch")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${student.cookie}`)
      .send({ conceptId: "web.http", dueAt: "2000-01-01", mastery: 100, priority: 1 });
    expect(tamper.status).toBe(404);

    const before = await prisma.learningEvent.count({ where: { userId: student.id } });
    await seedConcept(student.id, "web.http", 90, 1, daysAgo(30));
    await seedConcept(student.id, "web.browser", 30, 2, daysAgo(40));
    await seedConcept(student.id, "js.function", 90, 1, daysAgo(50));
    const queued = await get(
      "/api/v1/revision?dueAt=2000-01-01&conceptId=js.function",
      student.cookie,
    );
    const again = await get("/api/v1/revision", student.cookie);
    expect(queued.status).toBe(200);
    expect(again.body).toEqual(queued.body);
    expect(queued.body.status).toBe("ready");
    expect(queued.body.items.map((item: { name: string }) => item.name)).toEqual(["HTTP"]);
    expect(JSON.stringify(queued.body)).not.toContain("dueAt");
    expect(JSON.stringify(queued.body)).not.toContain("metadata");
    expect(JSON.stringify(queued.body)).not.toContain("interval");

    const [first, second] = await Promise.all([
      get("/api/v1/revision", student.cookie),
      get("/api/v1/revision", student.cookie),
    ]);
    expect(second.body).toEqual(first.body);
    expect(await prisma.learningEvent.count({ where: { userId: student.id } })).toBe(before + 3);

    const locked = await prisma.exercise.findUnique({ where: { slug: "html-heading" } });
    expect(locked).not.toBeNull();
    expect((await get(`/api/v1/exercises/${locked?.id}`, student.cookie)).status).toBe(404);
  });

  async function seedConcept(
    userId: string,
    slug: string,
    score: number,
    evidenceCount: number,
    createdAt: Date,
  ): Promise<void> {
    const concept = await prisma.concept.findUnique({ where: { slug } });
    expect(concept).not.toBeNull();
    const conceptId = concept?.id ?? "";
    await prisma.skillMastery.upsert({
      where: { userId_conceptId: { userId, conceptId } },
      create: { userId, conceptId, score, evidenceCount, lastEvidenceAt: createdAt },
      update: { score, evidenceCount, lastEvidenceAt: createdAt },
    });
    await prisma.learningEvent.create({
      data: {
        userId,
        conceptId,
        source: "quiz",
        evidence: 90,
        weight: 1,
        createdAt,
      },
    });
  }

  async function signIn(name: string): Promise<{ id: string; cookie: string }> {
    const email = uniqueEmail();
    const created = await post("/api/v1/auth/register").send({
      email,
      password: PASSWORD,
      name,
      timezone: "Asia/Baku",
    });
    expect(created.status).toBe(201);
    const token = headerValue(created, "x-development-verification-token");
    expect((await post("/api/v1/auth/verify-email").send({ token })).status).toBe(200);
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

function daysAgo(count: number): Date {
  return new Date(Date.now() - count * 86_400_000);
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
