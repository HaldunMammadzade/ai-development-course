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
import { AppModule } from "../../app.module";
import { configureApp } from "../../configure-app";
import { IDENTITY_REPOSITORY } from "../identity/identity.repository";
import { IdentityModule } from "../identity/identity.module";
import { createOpaqueToken, hashOpaqueToken } from "../identity/opaque-token";
import { FakePaymentProvider, signWebhook } from "./payment-provider";
import { PAYMENT_PROVIDER } from "./billing.tokens";

const PASSWORD = "correct horse battery";
const EMAIL_PREFIX = "billing-step17-";
const WEBHOOK_SECRET = "billing-test-secret";
const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = databaseUrl !== undefined && databaseUrl.length > 0;

describe.skipIf(!databaseConfigured)("billing HTTP", () => {
  let app: INestApplication;
  let repository: IdentityRepository;
  let prisma: PrismaClient;
  const payments = new FakePaymentProvider(WEBHOOK_SECRET);

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.PORT;
    await seedCurriculumDatabase(requiredDatabaseUrl());
    prisma = createPlatformPrisma(requiredDatabaseUrl());
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PAYMENT_PROVIDER)
      .useValue(payments)
      .compile();
    app = moduleRef.createNestApplication({ rawBody: true });
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

  it("lists prices without provider identifiers and rejects anonymous billing changes", async () => {
    const listed = await get("/api/v1/billing/plans");
    expect(listed.status).toBe(200);
    expect(listed.body.plans).toHaveLength(4);
    const body = JSON.stringify(listed.body);
    expect(body).not.toContain("price_pro_month");
    expect(body).not.toContain("provider");
    expect(listed.body.plans.map((plan: { plan: string }) => plan.plan)).toEqual([
      "free",
      "starter",
      "pro",
      "premium",
    ]);
    expect((await get("/api/v1/billing/subscription")).status).toBe(401);
    const unverified = await registerOnly("Unverified");
    const token = createOpaqueToken();
    await repository.insertSession({
      userId: unverified.id,
      tokenHash: hashOpaqueToken(token),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    expect((await get("/api/v1/billing/subscription", token)).status).toBe(403);
  });

  it("rejects price tampering, creates one checkout, and activates only from a signed webhook", async () => {
    payments.calls = 0;
    const student = await signIn("Aysel");
    const csrf = await request(app.getHttpServer())
      .post("/api/v1/billing/checkout")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${student.cookie}`)
      .send({ priceSlug: "pro-monthly", clientCheckoutId: randomUUID() });
    expect(csrf.status).toBe(403);
    const tampered = await post("/api/v1/billing/checkout", student.cookie).send({
      priceSlug: "pro-monthly",
      clientCheckoutId: randomUUID(),
      amount: 1,
      currency: "USD",
      providerPriceId: "price_free",
      isPremium: true,
    });
    expect(tampered.status).toBe(400);
    const clientCheckoutId = randomUUID();
    const started = await post("/api/v1/billing/checkout", student.cookie).send({
      priceSlug: "pro-monthly",
      clientCheckoutId,
    });
    expect(started.status).toBe(200);
    expect(started.body.checkout.status).toBe("pending");
    expect(String(started.body.checkout.url)).toContain("https://payments.test/checkout/");
    expect(JSON.stringify(started.body)).not.toContain("price_pro_month");
    const replay = await post("/api/v1/billing/checkout", student.cookie).send({
      priceSlug: "pro-monthly",
      clientCheckoutId,
    });
    expect(replay.status).toBe(200);
    expect(payments.calls).toBe(1);
    const current = await get("/api/v1/billing/subscription", student.cookie);
    expect(current.body.subscription.plan).toBe("free");
    const checkout = await prisma.checkoutSession.findFirstOrThrow({ where: { clientCheckoutId } });
    const payload = eventPayload({
      id: `evt-pro-${student.id}`,
      userId: student.id,
      checkoutId: checkout.id,
      status: "active",
      occurredAt: "2026-10-07T10:00:00.000Z",
      periodEnd: "2026-11-07T10:00:00.000Z",
    });
    const raw = JSON.stringify(payload);
    const rejected = await webhook(raw, "not-a-signature");
    expect(rejected.status).toBe(401);
    expect(rejected.body.error.code).toBe("PAYMENT_SIGNATURE");
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const accepted = await webhook(raw, signWebhook(WEBHOOK_SECRET, Buffer.from(raw)));
      expect(accepted.status).toBe(200);
    }
    expect(
      await prisma.paymentEvent.count({ where: { providerEventId: String(payload.id) } }),
    ).toBe(1);
    const active = await get("/api/v1/billing/subscription", student.cookie);
    expect(active.body.subscription.plan).toBe("pro");
    expect(active.body.subscription.status).toBe("active");
    expect(JSON.stringify(active.body)).not.toContain("sub_");
    const older = eventPayload({
      id: `evt-older-${student.id}`,
      userId: student.id,
      checkoutId: checkout.id,
      providerPriceId: "price_starter_month",
      status: "active",
      occurredAt: "2026-10-07T09:00:00.000Z",
      periodEnd: "2026-11-07T09:00:00.000Z",
    });
    const olderRaw = JSON.stringify(older);
    expect(
      (await webhook(olderRaw, signWebhook(WEBHOOK_SECRET, Buffer.from(olderRaw)))).status,
    ).toBe(200);
    const stillPro = await get("/api/v1/billing/subscription", student.cookie);
    expect(stillPro.body.subscription.plan).toBe("pro");
    const again = await post("/api/v1/billing/checkout", student.cookie).send({
      priceSlug: "pro-monthly",
      clientCheckoutId: randomUUID(),
    });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("SUBSCRIPTION_ACTIVE");
  });

  it("keeps access through cancellation and falls back to free after the period", async () => {
    const student = await signIn("Leyla");
    const clientCheckoutId = randomUUID();
    await post("/api/v1/billing/checkout", student.cookie).send({
      priceSlug: "starter-monthly",
      clientCheckoutId,
    });
    const checkout = await prisma.checkoutSession.findFirstOrThrow({ where: { clientCheckoutId } });
    const payload = eventPayload({
      id: `evt-${student.id}`,
      userId: student.id,
      checkoutId: checkout.id,
      providerPriceId: "price_starter_month",
      status: "active",
      occurredAt: "2026-10-07T10:00:00.000Z",
      periodEnd: "2026-11-07T10:00:00.000Z",
    });
    const raw = JSON.stringify(payload);
    expect((await webhook(raw, signWebhook(WEBHOOK_SECRET, Buffer.from(raw)))).status).toBe(200);
    const canceled = await post("/api/v1/billing/cancel", student.cookie).send({});
    expect(canceled.status).toBe(200);
    expect(canceled.body.subscription.plan).toBe("starter");
    expect(canceled.body.subscription.cancelAtPeriodEnd).toBe(true);
    const restored = await post("/api/v1/billing/reactivate", student.cookie).send({});
    expect(restored.body.subscription.cancelAtPeriodEnd).toBe(false);
    const failed = eventPayload({
      id: `evt-fail-${student.id}`,
      type: "payment.failed",
      userId: student.id,
      providerPriceId: "price_starter_month",
      status: "active",
      occurredAt: "2026-10-07T11:00:00.000Z",
      periodEnd: "2026-11-07T10:00:00.000Z",
    });
    const failedRaw = JSON.stringify(failed);
    expect(
      (await webhook(failedRaw, signWebhook(WEBHOOK_SECRET, Buffer.from(failedRaw)))).status,
    ).toBe(200);
    const pastDue = await get("/api/v1/billing/subscription", student.cookie);
    expect(pastDue.body.subscription.status).toBe("past_due");
    expect(pastDue.body.subscription.plan).toBe("starter");
    const expired = eventPayload({
      id: `evt-end-${student.id}`,
      userId: student.id,
      providerPriceId: "price_starter_month",
      status: "canceled",
      occurredAt: "2026-10-07T12:00:00.000Z",
      periodEnd: "2026-10-06T10:00:00.000Z",
    });
    const expiredRaw = JSON.stringify(expired);
    expect(
      (await webhook(expiredRaw, signWebhook(WEBHOOK_SECRET, Buffer.from(expiredRaw)))).status,
    ).toBe(200);
    const free = await get("/api/v1/billing/subscription", student.cookie);
    expect(free.body.subscription.plan).toBe("free");
    const learning = await prisma.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(learning.email).toContain(EMAIL_PREFIX);
  });

  it("gates a disabled feature without deleting the student", async () => {
    const student = await signIn("Nigar");
    const before = await prisma.plan.findUniqueOrThrow({ where: { code: "starter" } });
    await prisma.userPlan.update({ where: { userId: student.id }, data: { planCode: "starter" } });
    const entitlements = { ...(before.entitlements as Record<string, unknown>), speaking: false };
    await prisma.plan.update({ where: { code: "starter" }, data: { entitlements } });
    try {
      const blocked = await post("/api/v1/speaking/sessions", student.cookie).send({
        mode: "lesson",
      });
      expect(blocked.status).toBe(402);
      expect(blocked.body.error.code).toBe("FEATURE_NOT_INCLUDED");
      expect(await prisma.speakingSession.count({ where: { userId: student.id } })).toBe(0);
    } finally {
      await prisma.plan.update({
        where: { code: "starter" },
        data: { entitlements: before.entitlements ?? {} },
      });
    }
  });

  function post(path: string, cookie?: string): request.Test {
    const req = request(app.getHttpServer()).post(path).set("X-Requested-With", "fetch");
    return cookie === undefined ? req : req.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  }

  function get(path: string, cookie?: string): request.Test {
    const req = request(app.getHttpServer()).get(path);
    return cookie === undefined ? req : req.set("Cookie", `${SESSION_COOKIE_NAME}=${cookie}`);
  }

  function webhook(raw: string, signature: string): request.Test {
    return request(app.getHttpServer())
      .post("/api/v1/billing/webhook")
      .set("content-type", "application/json")
      .set("x-payment-signature", signature)
      .send(raw);
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

function eventPayload(input: {
  id?: string;
  type?: "subscription.upsert" | "payment.failed";
  userId: string;
  checkoutId?: string;
  providerPriceId?: string;
  status: "active" | "canceled" | "past_due";
  occurredAt: string;
  periodEnd: string;
}): Record<string, unknown> {
  return {
    id: input.id ?? "evt-pro-activation",
    type: input.type ?? "subscription.upsert",
    occurredAt: input.occurredAt,
    data: {
      ...(input.checkoutId === undefined ? {} : { checkoutId: input.checkoutId }),
      subscriptionId: `sub_${input.userId}`,
      customerId: `cus_${input.userId}`,
      providerPriceId: input.providerPriceId ?? "price_pro_month",
      status: input.status,
      currentPeriodStart: "2026-10-07T10:00:00.000Z",
      currentPeriodEnd: input.periodEnd,
      cancelAtPeriodEnd: false,
      userId: input.userId,
    },
  };
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
