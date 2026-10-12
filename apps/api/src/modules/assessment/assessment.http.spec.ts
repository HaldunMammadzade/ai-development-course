import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SESSION_COOKIE_NAME } from "@platform/config";
import { acceptedAssessmentAnswer, assessmentItemById } from "@platform/curriculum";
import {
  createPlatformPrisma,
  seedCurriculumDatabase,
  type IdentityRepository,
  type PrismaClient,
} from "@platform/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../configure-app";
import { IDENTITY_REPOSITORY } from "../identity/identity.repository";
import { IdentityModule } from "../identity/identity.module";

const PASSWORD = "correct horse battery";
const EMAIL_PREFIX = "assess-step37-";
const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = databaseUrl !== undefined && databaseUrl.length > 0;

describe.skipIf(!databaseConfigured)("assessment HTTP", () => {
  let app: INestApplication;
  let repository: IdentityRepository;
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.PORT;
    await seedCurriculumDatabase(requiredDatabaseUrl());
    prisma = createPlatformPrisma(requiredDatabaseUrl());
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

  it("rejects anonymous students and client-owned scores", async () => {
    const missing = await get("/api/v1/assessment");
    expect(missing.status).toBe(401);
    const student = await signIn("Tamper");
    const opened = await get("/api/v1/assessment", student.cookie);
    expect(opened.status).toBe(200);
    expect(opened.body.status).toBe("in_progress");
    expect(JSON.stringify(opened.body)).not.toContain("choice_equals");
    const empty = await post("/api/v1/assessment/answers", student.cookie).send({
      itemId: opened.body.item.id,
      answer: "",
      clientAttemptId: randomUUID(),
    });
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("VALIDATION");
    const unknown = await post("/api/v1/assessment/answers", student.cookie).send({
      itemId: "not-a-real-item",
      answer: "option-a",
      clientAttemptId: randomUUID(),
    });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe("VALIDATION");
    const tampered = await post("/api/v1/assessment/answers", student.cookie).send({
      itemId: opened.body.item.id,
      answer: "option-a",
      clientAttemptId: randomUUID(),
      score: 100,
      placement: "react-fundamentals",
      startLessonSlug: "components-and-props",
      path: ["components-and-props"],
      completion: true,
      mastery: 100,
    });
    expect(tampered.status).toBe(400);
    expect(tampered.body.error.code).toBe("VALIDATION");
    expect(
      await prisma.learningEvent.count({ where: { userId: student.id, source: "quiz" } }),
    ).toBe(0);
  });

  it("does not force a student who already has lesson progress", async () => {
    const student = await signIn("Returning");
    const lesson = await prisma.lesson.findFirstOrThrow({
      where: { slug: "how-the-web-delivers-a-page" },
    });
    await prisma.lessonProgress.create({
      data: { userId: student.id, lessonId: lesson.id, status: "in_progress" },
    });
    const response = await get("/api/v1/assessment", student.cookie);
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("not_required");
    expect(await prisma.skillAssessment.findUnique({ where: { userId: student.id } })).toBeNull();
  });

  it("keeps a wrong answer, rejects a mismatched item, and replays the same attempt id", async () => {
    const student = await signIn("Retry");
    const opened = await get("/api/v1/assessment", student.cookie);
    const attemptId = randomUUID();
    const wrong = await post("/api/v1/assessment/answers", student.cookie).send({
      itemId: opened.body.item.id,
      answer: "yanlis",
      clientAttemptId: attemptId,
    });
    expect(wrong.status).toBe(200);
    expect(wrong.body.previous.passed).toBe(false);
    expect(wrong.body.item.id).not.toBe(opened.body.item.id);
    const mismatch = await post("/api/v1/assessment/answers", student.cookie).send({
      itemId: opened.body.item.id,
      answer: "option-a",
      clientAttemptId: randomUUID(),
    });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.error.code).toBe("ITEM_MISMATCH");
    const replay = await post("/api/v1/assessment/answers", student.cookie).send({
      itemId: opened.body.item.id,
      answer: "yanlis",
      clientAttemptId: attemptId,
    });
    expect(replay.status).toBe(200);
    expect(await prisma.skillAssessmentAnswer.count({ where: { userId: student.id } })).toBe(1);
  });

  it("places a beginner on the first lesson and an experienced student past it", async () => {
    const beginner = await signIn("Beginner");
    let view = await get("/api/v1/assessment", beginner.cookie);
    while (view.body.status === "in_progress") {
      view = await post("/api/v1/assessment/answers", beginner.cookie).send({
        itemId: view.body.item.id,
        answer: "yanlis",
        clientAttemptId: randomUUID(),
      });
    }
    expect(view.body.status).toBe("completed");
    expect(view.body.result.lesson.slug).toBe("how-the-web-delivers-a-page");
    expect(view.body.result.label).toBe("Başlanğıc");
    expect(JSON.stringify(view.body.result)).not.toContain("73");
    const weak = await prisma.skillMastery.findFirst({
      where: { userId: beginner.id, concept: { slug: "web.http" } },
    });
    expect(weak?.evidenceCount).toBeGreaterThanOrEqual(2);
    expect(weak?.score).toBeLessThan(45);
    expect(
      await prisma.skillMastery.findFirst({
        where: { userId: beginner.id, concept: { slug: "react.component" } },
      }),
    ).toBeNull();

    const experienced = await signIn("Experienced");
    view = await get("/api/v1/assessment", experienced.cookie);
    while (view.body.status === "in_progress") {
      const item = assessmentItemById(view.body.item.id as string);
      expect(item).not.toBeNull();
      view = await post("/api/v1/assessment/answers", experienced.cookie).send({
        itemId: view.body.item.id,
        answer: acceptedAssessmentAnswer(item!),
        clientAttemptId: randomUUID(),
      });
    }
    expect(view.body.result.lesson.slug).toBe("js-basics");
    expect(view.body.result.known.some((entry: { name: string }) => entry.name.length > 0)).toBe(
      true,
    );
    const catalog = await get("/api/v1/learning/catalog", experienced.cookie);
    expect(catalog.body.nextAction).toMatchObject({ kind: "start_lesson" });
    const current = catalog.body.modules
      .flatMap(
        (module: { lessons: Array<{ slug: string; availability: string }> }) => module.lessons,
      )
      .find((lesson: { availability: string }) => lesson.availability === "current");
    expect(current.slug).toBe("js-basics");
    const first = catalog.body.modules[0].lessons[0];
    expect(first.slug).toBe("how-the-web-delivers-a-page");
    expect(first.availability).toBe("completed");
    expect(
      await prisma.skillMastery.findFirst({
        where: { userId: experienced.id, concept: { slug: "web.javascript" } },
      }),
    ).toBeNull();
    expect(
      await prisma.skillMastery.findFirst({
        where: { userId: experienced.id, concept: { slug: "react.component" } },
      }),
    ).not.toBeNull();
  });

  async function signIn(name: string): Promise<{ id: string; cookie: string }> {
    const email = `${EMAIL_PREFIX}${randomUUID()}@example.com`;
    const created = await post("/api/v1/auth/register").send({
      email,
      password: PASSWORD,
      name,
      timezone: "UTC",
    });
    expect(created.status).toBe(201);
    const token = created.headers["x-development-verification-token"];
    expect(typeof token).toBe("string");
    expect((await post("/api/v1/auth/verify-email").send({ token })).status).toBe(200);
    const loggedIn = await post("/api/v1/auth/login").send({ email, password: PASSWORD });
    expect(loggedIn.status).toBe(200);
    return { id: created.body.id as string, cookie: sessionCookie(loggedIn) };
  }

  function post(path: string, cookie?: string): request.Test {
    const req = request(app.getHttpServer()).post(path).set("X-Requested-With", "fetch");
    return cookie === undefined ? req : req.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  }

  function get(path: string, cookie?: string): request.Test {
    const req = request(app.getHttpServer()).get(path);
    return cookie === undefined ? req : req.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  }
});

function requiredDatabaseUrl(): string {
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required.");
  }
  return databaseUrl;
}

function sessionCookie(response: request.Response): string {
  const header = response.headers["set-cookie"];
  const lines = header === undefined ? [] : Array.isArray(header) ? header : [header];
  const match = lines.find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`));
  expect(match).toBeDefined();
  return decodeURIComponent(match?.split(";")[0]?.slice(`${SESSION_COOKIE_NAME}=`.length) ?? "");
}
