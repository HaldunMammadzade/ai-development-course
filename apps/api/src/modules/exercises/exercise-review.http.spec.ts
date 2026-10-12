import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { Logger, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  AIProviderError,
  AiConfigurationError,
  AiTaskUnavailableError,
  type AIProvider,
  type AIRequest,
  type AIResponse,
  type ModelRouter,
} from "@platform/ai";
import { SESSION_COOKIE_NAME } from "@platform/config";
import { EXECUTION_MESSAGES } from "@platform/execution";
import {
  createPlatformPrisma,
  seedCurriculumDatabase,
  type IdentityRepository,
  type PrismaClient,
} from "@platform/database";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../configure-app";
import { AI_PROVIDER, MODEL_ROUTER } from "../ai/ai.module";
import { IDENTITY_REPOSITORY } from "../identity/identity.repository";
import { IdentityModule } from "../identity/identity.module";
import { createOpaqueToken, hashOpaqueToken } from "../identity/opaque-token";

const FUNCTION_DRILLS = new Set(["js-add", "js-is-even", "js-reverse-string"]);
const PASSWORD = "correct horse battery";
const EMAIL_PREFIX = "exercise-step13-";
const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = databaseUrl !== undefined && databaseUrl.length > 0;

describe.skipIf(!databaseConfigured)("exercise code review HTTP", () => {
  let app: INestApplication;
  let repository: IdentityRepository;
  let prisma: PrismaClient;
  const teacher = new ReviewTeacher();
  const routes = new ReviewRouter();

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.PORT;
    await seedCurriculumDatabase(requiredDatabaseUrl());
    prisma = createPlatformPrisma(requiredDatabaseUrl());
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AI_PROVIDER)
      .useValue(teacher)
      .overrideProvider(MODEL_ROUTER)
      .useValue(routes)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    repository = app.select(IdentityModule).get<IdentityRepository>(IDENTITY_REPOSITORY);
  }, 60_000);

  beforeEach(() => {
    teacher.calls = [];
    teacher.failure = "none";
    teacher.thrown = null;
    teacher.payload = safeReview();
    teacher.gate = Promise.resolve();
    routes.available = true;
  });

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

  it("rejects anonymous, unverified, cross-user, and ineligible reviews", async () => {
    const exerciseId = await exerciseIdBySlug(await signedCookie(), "js-add");
    const missing = await post(`/api/v1/exercises/${exerciseId}/review`).send(reviewBody());
    expect(missing.status).toBe(401);

    const student = await signIn("Aysel");
    const unverified = await registerOnly("Unverified");
    const token = createOpaqueToken();
    await repository.insertSession({
      userId: unverified.id,
      tokenHash: hashOpaqueToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    const blocked = await post(`/api/v1/exercises/${exerciseId}/review`, token).send(reviewBody());
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("EMAIL_UNVERIFIED");

    const attempt = await attemptFor(
      student,
      "js-add",
      "function add(a, b) {\n  return a - b;\n}\n",
    );
    const other = await signIn("Leyla");
    const foreign = await post(`/api/v1/exercises/${exerciseId}/review`, other.cookie).send({
      attemptId: attempt.id,
      clientReviewId: randomUUID(),
      mode: "explain",
    });
    expect(foreign.status).toBe(404);
    expect(foreign.body.error.code).toBe("NOT_FOUND");

    const otherExercise = await exerciseIdBySlug(student.cookie, "js-is-even");
    const wrong = await post(`/api/v1/exercises/${otherExercise}/review`, student.cookie).send({
      attemptId: attempt.id,
      clientReviewId: randomUUID(),
      mode: "explain",
    });
    expect(wrong.status).toBe(404);

    const absent = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
      reviewBody(randomUUID()),
    );
    expect(absent.status).toBe(404);

    const heading = await prisma.exercise.findUnique({ where: { slug: "html-heading" } });
    expect(
      (await post(`/api/v1/exercises/${heading?.id}/review`, student.cookie).send(reviewBody()))
        .status,
    ).toBe(404);
    const hidden = await prisma.exercise.findUnique({ where: { slug: "http-request-hidden" } });
    expect(
      (await post(`/api/v1/exercises/${hidden?.id}/review`, student.cookie).send(reviewBody()))
        .status,
    ).toBe(404);

    const choiceId = await exerciseIdBySlug(student.cookie, "http-request-choice");
    const choice = await post(`/api/v1/exercises/${choiceId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission: "option-a",
    });
    expect(
      (
        await post(`/api/v1/exercises/${choiceId}/review`, student.cookie).send(
          reviewBody(choice.body.id as string),
        )
      ).status,
    ).toBe(404);

    const csrf = await request(app.getHttpServer())
      .post(`/api/v1/exercises/${exerciseId}/review`)
      .set("Cookie", `${SESSION_COOKIE_NAME}=${student.cookie}`)
      .send(reviewBody(attempt.id));
    expect(csrf.status).toBe(403);
    expect(csrf.body.error.code).toBe("CSRF");

    const override = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send({
      ...reviewBody(attempt.id),
      source: "function add(a, b) { return a + b; }",
      score: 100,
    });
    expect(override.status).toBe(400);
    expect(teacher.calls).toHaveLength(0);
  });

  it("reviews the stored source, ignores authoritative model fields, and deduplicates", async () => {
    const student = await signIn("Nigar");
    const exerciseId = await exerciseIdBySlug(student.cookie, "js-add");
    const beforeEvents = await prisma.learningEvent.count({ where: { userId: student.id } });
    const beforeMastery = await prisma.skillMastery.findFirst({
      where: { userId: student.id, concept: { slug: "web.http" } },
    });
    const attempt = await attemptFor(
      student,
      "js-add",
      "function add(a, b) {\n  return a - b;\n}\n",
    );
    expect(attempt.score).toBe(34);
    const clientReviewId = randomUUID();
    const first = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send({
      attemptId: attempt.id,
      clientReviewId,
      mode: "explain",
    });
    expect(first.status).toBe(200);
    expect(first.body.review.summary).toContain("çıxma");
    expect(first.body.review.understanding).toBe("incorrect");
    expect(first.body.review.suggestedConcepts).toEqual(["js.function"]);
    expect(first.body.review.score).toBeUndefined();
    expect(JSON.stringify(first.body)).not.toContain("Qx7");
    expect(JSON.stringify(first.body)).not.toContain("7xQ");
    expect(JSON.stringify(first.body)).not.toContain("add-a");
    expect(JSON.stringify(first.body)).not.toContain("hiddenTests");
    expect(JSON.stringify(first.body)).not.toContain("sk-");
    expect(JSON.stringify(first.body)).not.toContain("code-review.v1");
    expect(JSON.stringify(first.body)).not.toContain("code-review.v2");
    const prompt = teacher.calls[0]?.user ?? "";
    expect(prompt).toContain("return a - b");
    expect(prompt).toContain("<student_code>");
    expect(prompt).toContain("Passed tests: 1 of 3");
    expect(prompt).not.toContain("Qx7");
    expect(prompt).not.toContain("7xQ");
    expect(prompt).not.toContain("add-a");
    expect(prompt).not.toContain("expected");
    expect(prompt).not.toContain("AI_API_KEY");
    expect(teacher.calls[0]?.system).not.toContain(student.id);

    const stored = await prisma.exerciseAttempt.findUnique({ where: { id: attempt.id } });
    expect(stored?.score).toBe(34);
    expect(stored?.passed).toBe(false);
    expect(await prisma.learningEvent.count({ where: { userId: student.id } })).toBe(beforeEvents);
    const mastery = await prisma.skillMastery.findFirst({
      where: { userId: student.id, concept: { slug: "web.http" } },
    });
    const functionMastery = await prisma.skillMastery.findFirst({
      where: { userId: student.id, concept: { slug: "js.function" } },
    });
    expect(mastery?.score ?? null).toBe(beforeMastery?.score ?? null);
    expect(functionMastery).toBeNull();
    expect(mastery?.evidenceCount ?? null).toBe(beforeMastery?.evidenceCount ?? null);
    const usage = await prisma.aiUsage.findMany({
      where: { userId: student.id, taskType: "code_review" },
    });
    expect(usage).toHaveLength(1);
    expect(usage[0]?.provider).toBe("scripted");
    expect(usage[0]?.model).toBe("review-model");
    expect(usage[0]?.cached).toBe(false);

    const replay = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send({
      attemptId: attempt.id,
      clientReviewId,
      mode: "explain",
    });
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    expect(teacher.calls).toHaveLength(1);
    expect(
      await prisma.aiUsage.count({ where: { userId: student.id, taskType: "code_review" } }),
    ).toBe(1);
    expect(
      (await get("/api/v1/lessons/html-css-and-javascript/exercises", student.cookie)).status,
    ).toBe(404);
  });

  it("deduplicates a concurrent review and keeps later edits on a new attempt", async () => {
    const student = await signIn("Kamran");
    const exerciseId = await exerciseIdBySlug(student.cookie, "js-add");
    const attempt = await attemptFor(
      student,
      "js-add",
      "function add(a, b) {\n  return a - b;\n}\n",
    );
    let release = (): void => undefined;
    teacher.gate = new Promise((resolve) => {
      release = resolve;
    });
    const clientReviewId = randomUUID();
    const body = { attemptId: attempt.id, clientReviewId, mode: "hint" as const };
    const pending = Promise.all([
      post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(body),
      post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(body),
    ]);
    const started = Date.now();
    while (teacher.calls.length < 1 && Date.now() - started < 3_000) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(teacher.calls).toHaveLength(1);
    expect(teacher.calls[0]?.user).toContain("Hint level: 1.");
    release();
    const [first, second] = await pending;
    teacher.gate = Promise.resolve();
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual(first.body);
    expect(teacher.calls).toHaveLength(1);

    const secondHint = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send({
      attemptId: attempt.id,
      clientReviewId: randomUUID(),
      mode: "hint",
    });
    expect(secondHint.status).toBe(200);
    expect(teacher.calls.at(-1)?.user).toContain("Hint level: 2.");

    const passed = await attemptFor(
      student,
      "js-add",
      "function add(a, b) {\n  return a + b;\n}\n",
    );
    expect(passed.id).not.toBe(attempt.id);
    teacher.payload = {
      ...safeReview(),
      understanding: "incorrect",
      issues: [
        { type: "logic", description: "Bu gizli test uğursuzdur." },
        { conceptSlug: "js.function", type: "style", description: "Ad aydındır." },
      ],
    };
    const positive = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send({
      attemptId: passed.id,
      clientReviewId: randomUUID(),
      mode: "review",
    });
    teacher.payload = safeReview();
    expect(positive.status).toBe(200);
    expect(positive.body.review.understanding).toBe("correct");
    expect(positive.body.review.issues).toEqual([
      { conceptSlug: "js.function", type: "style", description: "Ad aydındır." },
    ]);
    expect(teacher.calls.at(-1)?.user).toContain("return a + b");
    expect(teacher.calls.at(-1)?.user).not.toContain("return a - b");
  });

  it("keeps the attempt when the model fails, leaks, or is limited", async () => {
    const student = await signIn("Sevinc");
    const exerciseId = await exerciseIdBySlug(student.cookie, "js-add");
    const attempt = await attemptFor(
      student,
      "js-add",
      "function add(a, b) {\n  return a - b;\n}\n",
    );

    teacher.failure = "malformed";
    const malformed = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
      reviewBody(attempt.id, "explain"),
    );
    expect(malformed.status).toBe(503);
    expect(malformed.body.error.code).toBe("AI_UNAVAILABLE");
    expect(malformed.body.error.message).not.toContain("speech");

    teacher.failure = "timeout";
    const timedOut = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
      reviewBody(attempt.id, "review"),
    );
    expect(timedOut.status).toBe(503);
    expect(timedOut.body.error.code).toBe("AI_UNAVAILABLE");

    teacher.failure = "none";
    teacher.payload = {
      ...safeReview(),
      feedback: "Gözlənilən 7xQ idi və açar sk-abcdefghijklmnop.",
    };
    const leaked = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
      reviewBody(attempt.id, "explain"),
    );
    teacher.payload = safeReview();
    expect(leaked.status).toBe(503);

    routes.available = false;
    const down = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
      reviewBody(attempt.id, "hint"),
    );
    routes.available = true;
    expect(down.status).toBe(503);
    expect(down.body.error.code).toBe("AI_UNAVAILABLE");

    const stored = await prisma.exerciseAttempt.findUnique({ where: { id: attempt.id } });
    expect(stored?.score).toBe(34);
    expect(await prisma.learningEvent.count({ where: { sourceId: attempt.id } })).toBe(0);
  });

  it("limits a student to ten new reviews in ten minutes", async () => {
    const student = await signIn("Rate");
    const exerciseId = await exerciseIdBySlug(student.cookie, "js-add");
    const attempt = await attemptFor(
      student,
      "js-add",
      "function add(a, b) {\n  return a - b;\n}\n",
    );
    for (let index = 0; index < 10; index += 1) {
      const ok = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
        reviewBody(attempt.id, "review"),
      );
      expect(ok.status).toBe(200);
    }
    const limited = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
      reviewBody(attempt.id, "review"),
    );
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect((await prisma.exerciseAttempt.findUnique({ where: { id: attempt.id } }))?.score).toBe(
      34,
    );
  });

  it("describes syntax, runtime, and timeout without hidden tests", async () => {
    const student = await signIn("Rauf");
    const exerciseId = await exerciseIdBySlug(student.cookie, "js-reverse-string");
    const cases = [
      [":::syntax", "syntax_error"],
      ['throw new Error("test");', "runtime_error"],
      ["while (true) {}", "timeout"],
      [":::memory", "memory_limit"],
      [":::process", "process_limit"],
    ] as const;
    for (const [source, status] of cases) {
      teacher.calls = [];
      const attempt = await attemptFor(student, "js-reverse-string", source);
      expect(attempt.passedRules).toEqual([]);
      expect(attempt.failedRules).toEqual([]);
      expect(attempt.feedback.startsWith(statusPrefix(status))).toBe(true);
      const reviewed = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
        reviewBody(attempt.id, "explain"),
      );
      expect(reviewed.status).toBe(200);
      expect(teacher.calls[0]?.user).toContain(`Execution status: ${status}`);
      expect(teacher.calls[0]?.user).toContain("Passed tests: 0 of 3");
      expect(teacher.calls[0]?.user).toContain(source);
      expect(teacher.calls[0]?.user).not.toContain("Qx7");
      expect(teacher.calls[0]?.user).not.toContain("7xQ");
      expect(teacher.calls[0]?.user).not.toContain("rev-c");
      expect(reviewed.body.review.score).toBeUndefined();
      const stored = await prisma.exerciseAttempt.findUnique({ where: { id: attempt.id } });
      expect(stored?.score).toBe(0);
      expect(stored?.feedback).toBe(attempt.feedback);
      expect(JSON.stringify(stored?.passedRules)).toContain(`"executionStatus":"${status}"`);
      expect(await prisma.learningEvent.count({ where: { sourceId: attempt.id } })).toBe(0);
    }
  });

  it("keeps completed results, legacy text, and unknown text distinct", async () => {
    const student = await signIn("RaufStatus");
    const exerciseId = await exerciseIdBySlug(student.cookie, "js-add");
    const missed = await attemptFor(
      student,
      "js-add",
      "function add(a, b) {\n  return a - b;\n}\n",
    );
    expect(missed.feedback).toContain("1/3 yoxlama keçdi.");
    expect(missed.feedback).toContain("tələb olunan davranışa uyğun gəlmir");
    expect(missed.passedRules).toEqual([]);
    const missedReview = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
      reviewBody(missed.id, "explain"),
    );
    expect(missedReview.status).toBe(200);
    expect(teacher.calls.at(-1)?.user).toContain("Execution status: completed");
    expect(teacher.calls.at(-1)?.user).toContain("Passed tests: 1 of 3");
    expect(teacher.calls.at(-1)?.user).toContain("Passed: false");

    const passed = await attemptFor(
      student,
      "js-add",
      "function add(a, b) {\n  return a + b;\n}\n",
    );
    expect(passed.feedback).toBe("3/3 yoxlama keçdi.");
    expect(passed.passed).toBe(true);
    const passedReview = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
      reviewBody(passed.id, "review"),
    );
    expect(passedReview.status).toBe(200);
    expect(teacher.calls.at(-1)?.user).toContain("Execution status: completed");
    expect(teacher.calls.at(-1)?.user).toContain("Passed tests: 3 of 3");
    expect(teacher.calls.at(-1)?.user).toContain("Passed: true");
    const event = await prisma.learningEvent.findFirst({
      where: { sourceId: passed.id },
      include: { concept: true },
    });
    expect(event?.source).toBe("exercise");
    expect(event?.concept.slug).toBe("js.function");
    expect(Number(event?.evidence)).toBe(100);

    const timed = await attemptFor(student, "js-add", "while (true) {}");
    await prisma.exerciseAttempt.update({
      where: { id: timed.id },
      data: { feedback: "1/3 yoxlama keçdi. Bəzi yoxlamalar uğursuz oldu." },
    });
    const overridden = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
      reviewBody(timed.id, "explain"),
    );
    expect(overridden.status).toBe(200);
    expect(teacher.calls.at(-1)?.user).toContain("Execution status: timeout");
    expect(teacher.calls.at(-1)?.user).toContain("Passed tests: 0 of 3");

    const legacy = await attemptFor(student, "js-add", ":::syntax");
    await prisma.exerciseAttempt.update({
      where: { id: legacy.id },
      data: { passedRules: [], feedback: "Sintaksis xətası var." },
    });
    const legacyReview = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
      reviewBody(legacy.id, "explain"),
    );
    expect(legacyReview.status).toBe(200);
    expect(teacher.calls.at(-1)?.user).toContain("Execution status: syntax_error");

    const callsBeforeUnknown = teacher.calls.length;
    const unknown = await attemptFor(student, "js-add", "function add(a, b) {\n  return 0;\n}\n");
    await prisma.exerciseAttempt.update({
      where: { id: unknown.id },
      data: { passedRules: [{ executionStatus: "exploded" }], feedback: "Cavab boşdur." },
    });
    const unavailable = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
      reviewBody(unknown.id, "explain"),
    );
    expect(unavailable.status).toBe(503);
    expect(unavailable.body.error.code).toBe("AI_UNAVAILABLE");
    expect(teacher.calls).toHaveLength(callsBeforeUnknown);
    expect(await prisma.learningEvent.count({ where: { sourceId: unknown.id } })).toBe(0);
  });

  it("logs a dropped review item without changing the accepted review", async () => {
    const student = await signIn("Kamran");
    const exerciseId = await exerciseIdBySlug(student.cookie, "js-add");
    const marker = "STUDENT-SUBMISSION-MARKER";
    const secret = "sk-abcdefghijklmnop";
    const literal = "add-a";
    const attempt = await attemptFor(
      student,
      "js-add",
      `function add(a, b) {\n  return a - b; // ${marker}\n}\n`,
    );
    teacher.payload = {
      ...safeReview(),
      strengths: ["Funksiya elan olunub.", `sk-<b>${secret.slice(3)}</b>`, `test ${literal}`],
      issues: [
        {
          conceptSlug: "js.function",
          type: "logic",
          description: "Return ifadəsi gözlənilən əməliyyatı etmir.",
        },
        { type: "style", description: `Qeyd sk-<b>${secret.slice(3)}</b>` },
      ],
    };
    const lines = await captureLog(async () => {
      const reviewed = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
        reviewBody(attempt.id, "explain"),
      );
      expect(reviewed.status).toBe(200);
      expect(reviewed.body.review.strengths).toEqual(["Funksiya elan olunub."]);
      expect(reviewed.body.review.issues).toEqual([
        {
          conceptSlug: "js.function",
          type: "logic",
          description: "Return ifadəsi gözlənilən əməliyyatı etmir.",
        },
      ]);
      expect(reviewed.body.review.summary).toBe("Burada əsas problem çıxma əməliyyatıdır.");
      expect(JSON.stringify(reviewed.body.review)).not.toContain(secret);
      expect(JSON.stringify(reviewed.body.review)).not.toContain(literal);
      expect(JSON.stringify(reviewed.body)).not.toContain(marker);
    });
    const line = lines.find((entry) => entry.startsWith("review correlation="));
    expect(line).toMatch(
      /^review correlation=[0-9a-f-]{36} mode=explain status=completed durationMs=\d+ safety_drops=strengths:internal_leak_rejection:1,strengths:hidden_literal:1,issues:internal_leak_rejection:1$/,
    );
    expect(line).not.toContain(secret);
    expect(line).not.toContain(literal);
    expect(line).not.toContain(marker);
    expect(line).not.toContain("sk-");
  });

  it("logs the provider category and keeps the public review error", async () => {
    const student = await signIn("Nigar");
    const exerciseId = await exerciseIdBySlug(student.cookie, "js-add");
    const marker = "STUDENT-SUBMISSION-MARKER";
    const attempt = await attemptFor(
      student,
      "js-add",
      `function add(a, b) {\n  return a - b; // ${marker}\n}\n`,
    );
    teacher.thrown = new AIProviderError("invalid_response", {
      failureCategory: "provider_http_error",
      httpStatus: 400,
      schemaIssues: [{ path: "feedback", code: "too_big" }],
    });
    const providerLines = await captureWarn(async () => {
      const review = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
        reviewBody(attempt.id, "explain"),
      );
      expect(review.status).toBe(503);
      expect(review.body).toEqual({
        error: { code: "AI_UNAVAILABLE", message: "The teacher is temporarily unavailable." },
      });
    });
    const providerLine = providerLines.find((line) => line.startsWith("review correlation="));
    expect(providerLine).toMatch(
      /^review correlation=[0-9a-f-]{36} mode=explain status=unavailable category=provider_http_error http_status=400 schema_issues=feedback:too_big durationMs=\d+$/,
    );
    expect(providerLine).not.toContain(marker);
    expect(providerLine).not.toContain("sk-");

    teacher.thrown = null;
    teacher.failure = "malformed";
    const moduleLines = await captureWarn(async () => {
      const review = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
        reviewBody(attempt.id, "review"),
      );
      expect(review.status).toBe(503);
      expect(review.body.error.code).toBe("AI_UNAVAILABLE");
    });
    const moduleLine = moduleLines.find((line) => line.startsWith("review correlation="));
    expect(moduleLine).toMatch(/category=schema_rejection http_status=null /);
    expect(moduleLine).toMatch(/schema_issues=/);
    expect(moduleLine).not.toContain(marker);
    expect(moduleLine).not.toContain("speech");

    teacher.failure = "none";
    teacher.thrown = new AIProviderError("invalid_response");
    const unknownLines = await captureWarn(async () => {
      const review = await post(`/api/v1/exercises/${exerciseId}/review`, student.cookie).send(
        reviewBody(attempt.id, "hint"),
      );
      expect(review.status).toBe(503);
      expect(review.body.error.code).toBe("AI_UNAVAILABLE");
    });
    const unknownLine = unknownLines.find((line) => line.startsWith("review correlation="));
    expect(unknownLine).toMatch(/category=invalid_response http_status=null /);
    expect(unknownLine).not.toContain("schema_issues");
    expect(unknownLine).not.toContain(marker);
  });

  async function signedCookie(): Promise<string> {
    return (await signIn("Setup")).cookie;
  }

  async function exerciseIdBySlug(cookie: string, slug: string): Promise<string> {
    const lessonSlug = FUNCTION_DRILLS.has(slug) ? "js-functions" : "how-the-web-delivers-a-page";
    if (FUNCTION_DRILLS.has(slug)) {
      const session = await prisma.session.findUniqueOrThrow({
        where: { tokenHash: hashOpaqueToken(cookie) },
      });
      const lesson = await prisma.lesson.findFirstOrThrow({ where: { slug: lessonSlug } });
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
    const listed = await get(`/api/v1/lessons/${lessonSlug}/exercises`, cookie);
    expect(listed.status).toBe(200);
    const match = listed.body.exercises.find((item: { slug: string }) => item.slug === slug);
    expect(match).toBeDefined();
    return match.id as string;
  }

  async function attemptFor(
    student: { cookie: string },
    slug: string,
    submission: string,
  ): Promise<{
    id: string;
    score: number;
    passed: boolean;
    feedback: string;
    passedRules: unknown;
    failedRules: unknown;
  }> {
    const exerciseId = await exerciseIdBySlug(student.cookie, slug);
    const saved = await post(`/api/v1/exercises/${exerciseId}/attempts`, student.cookie).send({
      clientAttemptId: randomUUID(),
      submission,
    });
    expect(saved.status).toBe(200);
    return {
      id: saved.body.id as string,
      score: saved.body.score as number,
      passed: saved.body.passed as boolean,
      feedback: saved.body.feedback as string,
      passedRules: saved.body.passedRules,
      failedRules: saved.body.failedRules,
    };
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

function statusPrefix(
  status: "syntax_error" | "runtime_error" | "timeout" | "memory_limit" | "process_limit",
): string {
  return EXECUTION_MESSAGES[status];
}

function reviewBody(
  attemptId: string = randomUUID(),
  mode: "explain" | "hint" | "review" = "explain",
) {
  return { attemptId, clientReviewId: randomUUID(), mode };
}

function safeReview(): Record<string, unknown> {
  return {
    summary: "Burada əsas problem çıxma əməliyyatıdır.",
    understanding: "incorrect",
    feedback: "Funksiya iki parametri qəbul edir, amma onları toplamır.",
    hint: "`a` və `b` üçün hansı operator lazımdır?",
    strengths: ["Funksiya elan olunub."],
    issues: [
      {
        conceptSlug: "js.function",
        type: "logic",
        description: "Return ifadəsi gözlənilən əməliyyatı etmir.",
      },
    ],
    nextQuestion: "`a = 2` və `b = 3` olduqda fərq nə olur?",
    suggestedConcepts: ["js.function", "invented.slug"],
    score: 100,
    mastery: 99,
    hiddenTests: [{ expected: "7xQ" }],
    passed: true,
    userId: "user",
  };
}

class ReviewRouter {
  available = true;

  resolve(task: string): ReturnType<ModelRouter["resolve"]> {
    if (task !== "code_review") {
      throw new AiTaskUnavailableError();
    }
    if (!this.available) {
      throw new AiConfigurationError("code_review");
    }
    return {
      task: "code_review",
      provider: "scripted",
      model: "review-model",
      strength: "fast",
      maxOutputTokens: 800,
      maxInputChars: 12_000,
      temperature: 0.2,
      timeoutMs: 20_000,
      inputMicrosPerMillion: 150_000,
      outputMicrosPerMillion: 600_000,
    };
  }
}

class ReviewTeacher implements AIProvider {
  readonly id = "scripted";
  calls: AIRequest[] = [];
  failure: "none" | "malformed" | "timeout" = "none";
  thrown: AIProviderError | null = null;
  payload: Record<string, unknown> = safeReview();
  gate: Promise<void> = Promise.resolve();

  async complete(request: AIRequest): Promise<AIResponse> {
    this.calls.push(request);
    await this.gate;
    if (this.thrown !== null) {
      throw this.thrown;
    }
    if (this.failure === "timeout") {
      throw new AIProviderError("timeout");
    }
    return {
      json: this.failure === "malformed" ? { speech: "no" } : this.payload,
      inputTokens: 20,
      outputTokens: 10,
      model: "review-model",
      latencyMs: 5,
      usage: {
        provider: "scripted",
        model: "review-model",
        inputTokens: 20,
        outputTokens: 10,
        totalTokens: 30,
        latencyMs: 5,
      },
    };
  }
}

async function captureLog(work: () => Promise<void>): Promise<string[]> {
  return captureLogger("log", work);
}

async function captureWarn(work: () => Promise<void>): Promise<string[]> {
  return captureLogger("warn", work);
}

async function captureLogger(method: "log" | "warn", work: () => Promise<void>): Promise<string[]> {
  const found: string[] = [];
  const original = Logger.prototype[method];
  Logger.prototype[method] = function (message?: unknown, ...rest: unknown[]) {
    if (typeof message === "string") {
      found.push(message);
    }
    return original.call(this, message, ...rest);
  };
  try {
    await work();
  } finally {
    Logger.prototype[method] = original;
  }
  return found;
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
