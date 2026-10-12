import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { loadPaymentEnv, SESSION_COOKIE_NAME } from "@platform/config";
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
import { createOpaqueToken, hashOpaqueToken } from "../identity/opaque-token";

const PASSWORD = "correct horse battery";
const EMAIL_PREFIX = "admin-step19-";
const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = databaseUrl !== undefined && databaseUrl.length > 0;

describe.skipIf(!databaseConfigured)("admin HTTP", () => {
  let app: INestApplication;
  let repository: IdentityRepository;
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.PORT;
    await seedCurriculumDatabase(requiredDatabaseUrl());
    prisma = createPlatformPrisma(requiredDatabaseUrl());
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ rawBody: true });
    configureApp(app);
    await app.init();
    repository = app.select(IdentityModule).get<IdentityRepository>(IDENTITY_REPOSITORY);
  }, 60_000);

  afterAll(async () => {
    if (prisma !== undefined) {
      await prisma.paymentEvent.deleteMany({ where: { provider: "admin-step19" } });
      await prisma.operationalJob.deleteMany({
        where: { idempotencyKey: { startsWith: "admin-step19-" } },
      });
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

  it("rejects a role in registration and hides admin routes from students", async () => {
    const rejected = await post("/api/v1/auth/register").send({
      email: uniqueEmail(),
      password: PASSWORD,
      name: "Admin",
      timezone: "Asia/Baku",
      role: "admin",
    });
    expect(rejected.status).toBe(400);
    expect((await get("/api/v1/admin/overview")).status).toBe(401);
    expect((await post("/api/v1/admin/students").send({ role: "admin" })).status).toBe(404);

    const unverified = await registerOnly("Unverified");
    const session = createOpaqueToken();
    await repository.insertSession({
      userId: unverified.id,
      tokenHash: hashOpaqueToken(session),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    expect((await get("/api/v1/admin/overview", session)).status).toBe(404);

    const student = await signIn("Student");
    expect((await get(`/api/v1/admin/students/${student.id}`, student.cookie)).status).toBe(404);
    expect((await get("/api/v1/me", student.cookie)).body.role).toBe("user");
  });

  it("allows only the current database role and drops access when the role is removed", async () => {
    const admin = await signIn("Operator");
    expect((await get("/api/v1/admin/overview", admin.cookie)).status).toBe(404);
    await prisma.user.update({ where: { id: admin.id }, data: { role: "admin" } });
    const allowed = await get("/api/v1/admin/overview", admin.cookie).set(
      "x-correlation-id",
      "admin-step19-overview",
    );
    expect(allowed.status).toBe(200);
    expect(allowed.body.students.registered).toBeGreaterThan(0);
    expect(allowed.headers["x-correlation-id"]).toBe("admin-step19-overview");
    const audit = await prisma.adminAuditLog.findFirst({
      where: { adminUserId: admin.id, action: "overview", correlationId: "admin-step19-overview" },
    });
    expect(audit).not.toBeNull();
    expect(JSON.stringify(audit)).not.toContain(PASSWORD);
    expect(JSON.stringify(audit)).not.toContain("passwordHash");

    await prisma.user.update({ where: { id: admin.id }, data: { role: "user" } });
    expect((await get("/api/v1/admin/overview", admin.cookie)).status).toBe(404);
  });

  it("aggregates stored usage, bounds queries, and omits secrets", async () => {
    const admin = await signIn("Analyst");
    const learner = await signIn("Learner");
    await prisma.user.update({ where: { id: admin.id }, data: { role: "admin" } });
    const exercise = await prisma.exercise.findFirstOrThrow({ select: { id: true } });
    await prisma.exerciseAttempt.create({
      data: {
        exerciseId: exercise.id,
        userId: learner.id,
        clientAttemptId: randomUUID(),
        submission: "SECRET_SUBMISSION_STEP19",
        status: "failed",
        score: 0,
        passed: false,
        feedback: "SECRET_FEEDBACK_STEP19",
        passedRules: [],
        failedRules: [],
        attemptNumber: 1,
      },
    });
    const before = await get("/api/v1/admin/ai?window=today", admin.cookie);
    expect(before.status).toBe(200);
    await prisma.aiUsage.create({
      data: {
        userId: learner.id,
        taskType: "teach",
        provider: "admin-step19-provider",
        model: "admin-step19-model",
        inputTokens: 11,
        outputTokens: 13,
        costMicros: 1700n,
        latencyMs: 4,
        correlationId: "admin-step19-usage",
      },
    });
    await prisma.transcriptionUsage.create({
      data: {
        userId: learner.id,
        provider: "admin-step19-stt",
        model: "admin-step19-stt-model",
        durationMs: 1200,
        status: "completed",
        latencyMs: 5,
        costMicros: 90n,
        correlationId: "admin-step19-stt",
      },
    });
    const systemBefore = await get("/api/v1/admin/system?window=today", admin.cookie);
    await prisma.paymentEvent.create({
      data: {
        provider: "admin-step19",
        providerEventId: randomUUID(),
        eventType: "payment.failed",
        occurredAt: new Date(),
        status: "failed",
      },
    });
    await prisma.operationalJob.create({
      data: {
        name: "send_email",
        idempotencyKey: `admin-step19-${randomUUID()}`,
        status: "dead",
        runAfter: new Date(),
        lastError: "EMAIL_UNAVAILABLE",
      },
    });

    const ai = await get("/api/v1/admin/ai?window=today", admin.cookie);
    expect(ai.status).toBe(200);
    expect(ai.body.totals.costBasis).toBe("stored");
    expect(ai.body.totals.teach).toBeGreaterThanOrEqual(before.body.totals.teach + 1);
    expect(
      BigInt(ai.body.totals.costMicros) - BigInt(before.body.totals.costMicros),
    ).toBeGreaterThanOrEqual(1700n);
    expect(ai.body.totals.inputTokens).toBeGreaterThanOrEqual(before.body.totals.inputTokens + 11);
    expect(ai.body.byTask.some((row: { key: string }) => row.key === "teach")).toBe(true);
    expect(
      ai.body.byProvider.some((row: { key: string }) => row.key === "admin-step19-provider"),
    ).toBe(true);
    expect(ai.body.byModel.some((row: { key: string }) => row.key === "admin-step19-model")).toBe(
      true,
    );
    expect(ai.body.byPlan.some((row: { key: string }) => row.key === "free")).toBe(true);
    expect(
      BigInt(ai.body.speech.costMicros) - BigInt(before.body.speech.costMicros),
    ).toBeGreaterThanOrEqual(90n);
    expect(ai.body.speech.failures).toBeNull();
    expect(ai.body.speech.costAccuracy).toBe("provider_pricing_not_verified");

    const system = await get("/api/v1/admin/system?window=today", admin.cookie);
    expect(system.status).toBe(200);
    const categories = system.body.failures as Array<{
      category: string;
      recorded: boolean;
      code: string | null;
    }>;
    expect(categories.find((row) => row.category === "AI")?.recorded).toBe(false);
    expect(categories.find((row) => row.category === "STT")?.recorded).toBe(false);
    expect(categories.find((row) => row.category === "RUNNER")?.recorded).toBe(false);
    expect(countOf(system, "EMAIL")).toBeGreaterThanOrEqual(countOf(systemBefore, "EMAIL") + 1);
    expect(countOf(system, "PAYMENT")).toBeGreaterThanOrEqual(countOf(systemBefore, "PAYMENT") + 1);

    const saved = snapshotPaymentEnv();
    clearPaymentEnv();
    try {
      const billing = await get("/api/v1/admin/billing?window=7d", admin.cookie);
      expect(billing.status).toBe(200);
      expect(billing.body.paymentConfigured).toBe(false);
      expect(billing.body.revenue).toBeNull();
      expect(billing.body.plans.free).toBeGreaterThan(0);
      expect(loadPaymentEnv(process.env)).toBeNull();

      process.env.PAYMENT_PROVIDER = "fake";
      process.env.PAYMENT_API_KEY = "catalog-key-step20";
      process.env.PAYMENT_WEBHOOK_SECRET = "catalog-secret-step20";
      process.env.PAYMENT_BASE_URL = "https://payments.example.test";
      const price = await prisma.planPrice.findFirstOrThrow({
        where: { planCode: "starter", amountMinor: 990 },
      });
      const beforeCatalog = await get("/api/v1/admin/billing?window=30d", admin.cookie);
      expect(beforeCatalog.body.paymentConfigured).toBe(true);
      expect(beforeCatalog.body.revenue.basis).toBe("estimated_catalog");
      expect(beforeCatalog.body.revenue.currency).toBe("AZN");
      await prisma.userPlan.update({
        where: { userId: learner.id },
        data: { planCode: "starter" },
      });
      await prisma.subscription.create({
        data: {
          userId: learner.id,
          provider: "admin-step19",
          providerCustomerId: `cust-${learner.id}`,
          providerSubscriptionId: `sub-${learner.id}`,
          priceId: price.id,
          status: "active",
          currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });
      await prisma.checkoutSession.create({
        data: {
          userId: learner.id,
          clientCheckoutId: randomUUID(),
          priceId: price.id,
          provider: "admin-step19",
          status: "pending",
        },
      });
      const afterCatalog = await get("/api/v1/admin/billing?window=30d", admin.cookie);
      expect(afterCatalog.body.plans.starter).toBeGreaterThanOrEqual(
        beforeCatalog.body.plans.starter + 1,
      );
      expect(afterCatalog.body.subscriptions.active).toBeGreaterThanOrEqual(
        beforeCatalog.body.subscriptions.active + 1,
      );
      expect(afterCatalog.body.checkoutAttempts).toBeGreaterThanOrEqual(
        beforeCatalog.body.checkoutAttempts + 1,
      );
      expect(afterCatalog.body.revenue.amountMinor).toBeGreaterThanOrEqual(
        beforeCatalog.body.revenue.amountMinor + 990,
      );
      expect(JSON.stringify(afterCatalog.body)).not.toContain("catalog-secret-step20");
    } finally {
      await prisma.subscription.deleteMany({ where: { provider: "admin-step19" } });
      await prisma.checkoutSession.deleteMany({ where: { provider: "admin-step19" } });
      await prisma.userPlan.updateMany({
        where: { userId: learner.id },
        data: { planCode: "free" },
      });
      restorePaymentEnv(saved);
    }

    const detail = await get(`/api/v1/admin/students/${learner.id}`, admin.cookie).set(
      "x-correlation-id",
      "admin-step19-student",
    );
    expect(detail.status).toBe(200);
    const serialized = JSON.stringify(detail.body);
    expect(serialized).not.toContain("SECRET_SUBMISSION_STEP19");
    expect(serialized).not.toContain("SECRET_FEEDBACK_STEP19");
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("tokenHash");
    expect(serialized).not.toContain("transcript");
    expect(detail.body.student.exercises.attempted).toBeGreaterThanOrEqual(1);
    const studentAudit = await prisma.adminAuditLog.findFirst({
      where: {
        adminUserId: admin.id,
        action: "student_detail",
        targetId: learner.id,
        correlationId: "admin-step19-student",
      },
    });
    expect(studentAudit?.targetType).toBe("user");

    const first = await get(`/api/v1/admin/students?q=${EMAIL_PREFIX}&limit=1`, admin.cookie);
    expect(first.status).toBe(200);
    expect(first.body.students).toHaveLength(1);
    expect(first.body.nextCursor).toEqual(expect.any(String));
    const second = await get(
      `/api/v1/admin/students?q=${EMAIL_PREFIX}&limit=1&cursor=${first.body.nextCursor}`,
      admin.cookie,
    );
    expect(second.status).toBe(200);
    expect(second.body.students[0].id).not.toBe(first.body.students[0].id);

    expect((await get("/api/v1/admin/overview?window=365d", admin.cookie)).status).toBe(400);
    expect(
      (await get("/api/v1/admin/overview?window=7d&order=password_hash", admin.cookie)).status,
    ).toBe(400);
    expect((await get("/api/v1/admin/ai?from=1990-01-01&window=7d", admin.cookie)).status).toBe(
      400,
    );
    expect((await get("/api/v1/admin/students?limit=500", admin.cookie)).status).toBe(400);
    expect((await get(`/api/v1/admin/students/${randomUUID()}`, admin.cookie)).status).toBe(404);

    const learning = await get("/api/v1/admin/learning?window=30d", admin.cookie);
    expect(learning.status).toBe(200);
    expect(Array.isArray(learning.body.funnel)).toBe(true);
    expect(
      learning.body.funnel.every(
        (step: { rate: unknown }) => step.rate === null || typeof step.rate === "number",
      ),
    ).toBe(true);
  });

  function post(path: string, cookie?: string): request.Test {
    const req = request(app.getHttpServer()).post(path).set("X-Requested-With", "fetch");
    return cookie === undefined ? req : req.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  }

  function get(path: string, cookie?: string): request.Test {
    const req = request(app.getHttpServer()).get(path);
    return cookie === undefined ? req : req.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
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
});

function countOf(
  response: { body: { failures: Array<{ category: string; count: number | null }> } },
  category: string,
): number {
  return response.body.failures.find((row) => row.category === category)?.count ?? 0;
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

function snapshotPaymentEnv(): Record<string, string | undefined> {
  return {
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    PAYMENT_API_KEY: process.env.PAYMENT_API_KEY,
    PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET,
    PAYMENT_BASE_URL: process.env.PAYMENT_BASE_URL,
    PAYMENT_TIMEOUT_MS: process.env.PAYMENT_TIMEOUT_MS,
  };
}

function clearPaymentEnv(): void {
  delete process.env.PAYMENT_PROVIDER;
  delete process.env.PAYMENT_API_KEY;
  delete process.env.PAYMENT_WEBHOOK_SECRET;
  delete process.env.PAYMENT_BASE_URL;
  delete process.env.PAYMENT_TIMEOUT_MS;
}

function restorePaymentEnv(saved: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
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
