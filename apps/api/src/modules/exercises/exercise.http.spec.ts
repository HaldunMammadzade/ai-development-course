import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SESSION_COOKIE_NAME } from "@platform/config";
import { resetScriptedExecutionCount, scriptedExecutionCount } from "@platform/execution";
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

const FUNCTION_DRILLS = new Set(["js-add", "js-is-even", "js-reverse-string"]);
const PASSWORD = "correct horse battery";
const EMAIL_PREFIX = "exercise-step10-";
const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = databaseUrl !== undefined && databaseUrl.length > 0;
const AI_ENV_KEYS = [
  "AI_PROVIDER",
  "AI_TEACH_MODEL",
  "AI_REVIEW_MODEL",
  "AI_API_KEY",
  "AI_BASE_URL",
  "AI_MAX_INPUT_CHARS",
  "AI_MAX_OUTPUT_TOKENS",
] as const;
const savedAiEnv = new Map<string, string | undefined>();

describe.skipIf(!databaseConfigured)("exercise HTTP", () => {
  let app: INestApplication;
  let repository: IdentityRepository;
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.PORT;
    for (const key of AI_ENV_KEYS) {
      savedAiEnv.set(key, process.env[key]);
      process.env[key] = "";
    }
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
    for (const key of AI_ENV_KEYS) {
      const saved = savedAiEnv.get(key);
      if (saved === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = saved;
      }
    }
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

  it("hides answers, rejects anonymous and unverified students, and blocks locked lessons", async () => {
    const missing = await get("/api/v1/lessons/how-the-web-delivers-a-page/exercises");
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe("UNAUTHENTICATED");

    const student = await signIn("Aysel");
    const listed = await get(
      "/api/v1/lessons/how-the-web-delivers-a-page/exercises",
      student.cookie,
    );
    expect(listed.status).toBe(200);
    const slugs = listed.body.exercises.map((item: { slug: string }) => item.slug);
    expect(slugs).toEqual(["http-request-choice", "http-three-steps"]);
    expect(slugs).not.toContain("js-add");
    expect(slugs).not.toContain("js-is-even");
    expect(slugs).not.toContain("js-reverse-string");
    const body = JSON.stringify(listed.body);
    expect(body).not.toContain("choice_equals");
    expect(body).not.toContain("ordered_tokens");
    expect(body).not.toContain("rules");
    expect(body).not.toContain("Bu variant bu sualın cavabı deyil");
    expect(listed.body.exercises[0].executionAvailable).toBe(false);
    expect(listed.body.exercises[1].executionAvailable).toBe(false);
    expect(body).not.toContain("Qx7");
    expect(body).not.toContain("7xQ");
    expect(body).not.toContain("execution_only");
    expect(body).not.toContain("add-a");

    const exerciseId = listed.body.exercises[0].id as string;
    const detail = await get(`/api/v1/exercises/${exerciseId}`, student.cookie);
    expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.body)).not.toContain("choice_equals");
    expect(detail.body.options.map((option: { id: string }) => option.id)).toEqual([
      "option-a",
      "option-b",
      "option-c",
      "option-d",
    ]);

    const hidden = await prisma.exercise.findUnique({ where: { slug: "http-request-hidden" } });
    expect(hidden).not.toBeNull();
    expect((await get(`/api/v1/exercises/${hidden?.id}`, student.cookie)).status).toBe(404);
    expect((await get("/api/v1/exercises/not-a-uuid", student.cookie)).status).toBe(404);

    const locked = await get("/api/v1/lessons/html-text/exercises", student.cookie);
    expect(locked.status).toBe(404);
    const heading = await prisma.exercise.findUnique({ where: { slug: "html-heading" } });
    expect(heading).not.toBeNull();
    expect((await get(`/api/v1/exercises/${heading?.id}`, student.cookie)).status).toBe(404);

    const unverified = await registerOnly("Unverified");
    const token = createOpaqueToken();
    await repository.insertSession({
      userId: unverified.id,
      tokenHash: hashOpaqueToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    const blocked = await get(`/api/v1/exercises/${exerciseId}`, token);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("EMAIL_UNVERIFIED");

    const csrf = await request(app.getHttpServer())
      .post(`/api/v1/exercises/${exerciseId}/attempts`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${student.cookie}`)
      .send({ clientAttemptId: randomUUID(), submission: "option-a" });
    expect(csrf.status).toBe(403);
    expect(csrf.body.error.code).toBe("CSRF");
  });

  it("scores a submission on the server, keeps history, and ignores a replay", async () => {
    const student = await signIn("Nigar");
    const other = await signIn("Leyla");
    const exerciseId = await exerciseIdBySlug(student.cookie, "http-request-choice");
    const clientAttemptId = randomUUID();

    const scored = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId,
      submission: "option-a",
      score: 0,
      passed: false,
      mastery: 100,
    });
    expect(scored.status).toBe(400);
    expect(scored.body.error.code).toBe("VALIDATION");

    const wrong = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission: "option-b",
    });
    expect(wrong.status).toBe(200);
    expect(wrong.body.passed).toBe(false);
    expect(wrong.body.score).toBe(0);
    expect(wrong.body.attemptNumber).toBe(1);
    expect(await eventCount(student.id, wrong.body.id as string)).toBe(0);

    const [first, second] = await Promise.all([
      post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
        clientAttemptId,
        submission: "option-a",
      }),
      post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
        clientAttemptId,
        submission: "option-a",
      }),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.id).toBe(second.body.id);
    expect(first.body.passed).toBe(true);
    expect(first.body.score).toBe(100);
    expect(await eventCount(student.id, first.body.id as string)).toBe(1);
    const event = await prisma.learningEvent.findFirst({
      where: { userId: student.id, sourceId: first.body.id as string },
    });
    expect(event?.source).toBe("exercise");
    expect(Number(event?.evidence)).toBe(100);
    expect(Number(event?.weight)).toBe(1);

    const replay = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId,
      submission: "option-b",
    });
    expect(replay.body.id).toBe(first.body.id);
    expect(await eventCount(student.id, first.body.id as string)).toBe(1);

    const mastery = await prisma.skillMastery.findFirst({
      where: { userId: student.id, concept: { slug: "web.http" } },
    });
    expect(mastery?.score).toBe(100);
    expect(mastery?.evidenceCount).toBe(1);

    const history = await get(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie);
    expect(history.status).toBe(200);
    expect(history.body.attempts).toHaveLength(2);
    expect(
      history.body.attempts[0].submission === "option-a" ||
        history.body.attempts[1].submission === "option-a",
    ).toBe(true);

    const foreign = await get(`/api/v1/exercises/${exerciseId}/attempts`, other.cookie);
    expect(foreign.status).toBe(200);
    expect(foreign.body.attempts).toEqual([]);
    expect(JSON.stringify(foreign.body)).not.toContain(first.body.id);

    const oversized = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission: "a".repeat(4_001),
    });
    expect(oversized.status).toBe(400);

    const textId = await exerciseIdBySlug(student.cookie, "http-three-steps");
    const empty = await post(`/api/v1/exercises/${textId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission: "   ",
    });
    expect(empty.status).toBe(200);
    expect(empty.body.passed).toBe(false);
    expect(empty.body.feedback).toBe("Cavab boşdur.");
    const steps = await post(`/api/v1/exercises/${textId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission: "Əvvəl sorğu, sonra cavab, sonra göstərmə.",
    });
    expect(steps.body.passed).toBe(true);
    expect((await get("/api/v1/lessons/what-a-url-is/exercises", student.cookie)).status).toBe(200);
    expect(
      (await get("/api/v1/lessons/html-css-and-javascript/exercises", student.cookie)).status,
    ).toBe(404);
  });

  it("runs javascript exercises through the runner and keeps scoring on the server", async () => {
    const student = await signIn("Kamran");
    const other = await signIn("Sevinc");
    resetScriptedExecutionCount();
    const exerciseId = await exerciseIdBySlug(student.cookie, "js-add");
    const functions = await get("/api/v1/lessons/js-functions/exercises", student.cookie);
    expect(functions.status).toBe(200);
    expect(functions.body.exercises.map((item: { slug: string }) => item.slug)).toEqual([
      "js-function-return",
      "js-double",
      "js-add",
      "js-is-even",
      "js-reverse-string",
    ]);
    const detail = await get(`/api/v1/exercises/${exerciseId}`, student.cookie);
    expect(detail.status).toBe(200);
    expect(detail.body.executionAvailable).toBe(true);
    expect(detail.body.language).toBe("javascript");
    const published = JSON.stringify(detail.body);
    expect(published).not.toContain("Qx7");
    expect(published).not.toContain("7xQ");
    expect(published).not.toContain("expected");
    expect(published).not.toContain("add-a");
    expect(published).not.toContain("execution_only");

    const rejected = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission: "function add(a, b) { return a + b; }",
      score: 100,
      passed: true,
      tests: [{ id: "add-a", expected: 5 }],
      timeoutMs: 60_000,
      language: "python",
    });
    expect(rejected.status).toBe(400);

    const wrong = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission: "function add(a, b) {\n  return 0;\n}\n",
    });
    expect(wrong.status).toBe(200);
    expect(wrong.body.score).toBe(0);
    expect(wrong.body.passed).toBe(false);
    expect(wrong.body.feedback).toContain("0/3");
    expect(wrong.body.feedback).toContain("tələb olunan davranışa uyğun gəlmir");
    expect(JSON.stringify(wrong.body)).not.toContain("add-a");
    expect(await eventCount(student.id, wrong.body.id as string)).toBe(0);

    const partial = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission: "function add(a, b) {\n  return a - b;\n}\n",
    });
    expect(partial.body.score).toBe(34);
    expect(partial.body.passed).toBe(false);
    expect(partial.body.feedback).toContain("1/3");
    expect(partial.body.feedback).toContain("tələb olunan davranışa uyğun gəlmir");
    expect(JSON.stringify(partial.body)).not.toContain("add-a");
    expect(await eventCount(student.id, partial.body.id as string)).toBe(0);

    const clientAttemptId = randomUUID();
    const before = scriptedExecutionCount();
    const [first, second] = await Promise.all([
      post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
        clientAttemptId,
        submission: "function add(a, b) {\n  return a + b;\n}\n",
      }),
      post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
        clientAttemptId,
        submission: "function add(a, b) {\n  return a + b;\n}\n",
      }),
    ]);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.id).toBe(second.body.id);
    expect(first.body.score).toBe(100);
    expect(first.body.passed).toBe(true);
    expect(first.body.feedback).toBe("3/3 yoxlama keçdi.");
    expect(scriptedExecutionCount() - before).toBe(1);
    const event = await prisma.learningEvent.findFirst({
      where: { userId: student.id, sourceId: first.body.id as string },
      include: { concept: true },
    });
    expect(event?.source).toBe("exercise");
    expect(event?.concept.slug).toBe("js.function");
    expect(Number(event?.evidence)).toBe(100);
    expect(Number(event?.weight)).toBe(1);

    const replay = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId,
      submission: "function add(a, b) {\n  return 0;\n}\n",
    });
    expect(replay.body.id).toBe(first.body.id);
    expect(replay.body.score).toBe(100);

    const lost = randomUUID();
    const unavailable = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send(
      {
        clientAttemptId: lost,
        submission: ":::runner",
      },
    );
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error.code).toBe("EXECUTION_UNAVAILABLE");
    expect(
      await prisma.exerciseAttempt.count({
        where: { userId: student.id, clientAttemptId: lost },
      }),
    ).toBe(0);
    const recovered = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId: lost,
      submission: "function add(a, b) {\n  return a + b;\n}\n",
    });
    expect(recovered.status).toBe(200);
    expect(recovered.body.score).toBe(100);

    const timed = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission: "while (true) {}",
    });
    expect(timed.body.passed).toBe(false);
    expect(timed.body.score).toBe(0);
    expect(timed.body.feedback).toBe(
      "Kod 2 saniyəlik icra limitini keçdi. Yoxlamalar işləmədi. Dövrün bitdiyinə əmin ol.",
    );
    expect(await eventCount(student.id, timed.body.id as string)).toBe(0);

    const syntax = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission: ":::syntax",
    });
    expect(syntax.body.feedback).toBe(
      "Sintaksis xətası var. Yoxlamalar işləmədi. Əvvəl sintaksisi düzəlt.",
    );

    const crashed = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission: 'throw new Error("test");',
    });
    expect(crashed.body.feedback).toBe(
      "Kod icra edilərkən xəta baş verdi. Yoxlamalar işləmədi. Funksiya nəticə vermədən dayandı.",
    );
    expect(crashed.body.submission).toBe('throw new Error("test");');

    await openCompletedLesson(other.cookie, "js-functions");
    const history = await get(`/api/v1/exercises/${exerciseId}/attempts`, other.cookie);
    expect(history.body.attempts).toEqual([]);
    expect(JSON.stringify(history.body)).not.toContain("return a + b");

    await prisma.exerciseExecutionClaim.createMany({
      data: [1, 2, 3, 4].map((item) => ({
        userId: student.id,
        exerciseId,
        clientAttemptId: `busy-${item}`,
        createdAt: new Date(),
      })),
    });
    const blocked = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission: "function add(a, b) {\n  return a + b;\n}\n",
    });
    expect(blocked.status).toBe(503);
    expect(blocked.body.error.code).toBe("EXECUTION_BUSY");
    await prisma.exerciseExecutionClaim.deleteMany({ where: { userId: student.id } });
  });

  it("leaves a scored attempt unchanged when the reviewer is not configured", async () => {
    const student = await signIn("ReviewOff");
    const exerciseId = await exerciseIdBySlug(student.cookie, "js-add");
    const attempt = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission: "function add(a, b) {\n  return a - b;\n}\n",
    });
    expect(attempt.body.score).toBe(34);
    const review = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send({
      attemptId: attempt.body.id,
      clientReviewId: randomUUID(),
      mode: "explain",
    });
    expect(review.status).toBe(503);
    expect(review.body.error.code).toBe("AI_UNAVAILABLE");
    const stored = await prisma.exerciseAttempt.findUnique({
      where: { id: attempt.body.id as string },
    });
    expect(stored?.score).toBe(34);
    expect(await eventCount(student.id, attempt.body.id as string)).toBe(0);
  });

  async function exerciseIdBySlug(cookie: string, slug: string): Promise<string> {
    const lessonSlug = FUNCTION_DRILLS.has(slug) ? "js-functions" : "how-the-web-delivers-a-page";
    if (FUNCTION_DRILLS.has(slug)) {
      await openCompletedLesson(cookie, lessonSlug);
    }
    const listed = await get(`/api/v1/lessons/${lessonSlug}/exercises`, cookie);
    expect(listed.status).toBe(200);
    const match = listed.body.exercises.find((item: { slug: string }) => item.slug === slug);
    expect(match).toBeDefined();
    return match.id as string;
  }

  async function openCompletedLesson(cookie: string, slug: string): Promise<void> {
    const session = await prisma.session.findUniqueOrThrow({
      where: { tokenHash: hashOpaqueToken(cookie) },
    });
    const lesson = await prisma.lesson.findFirstOrThrow({ where: { slug } });
    await prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId: session.userId, lessonId: lesson.id } },
      create: {
        userId: session.userId,
        lessonId: lesson.id,
        status: "completed",
        completedAt: new Date(),
      },
      update: { status: "completed", completedAt: new Date() },
    });
  }

  async function eventCount(userId: string, attemptId: string): Promise<number> {
    return prisma.learningEvent.count({
      where: { userId, source: "exercise", sourceId: attemptId },
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
    const req = request(app.getHttpServer()).get(path);
    return cookie === undefined ? req : req.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  }
});

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
