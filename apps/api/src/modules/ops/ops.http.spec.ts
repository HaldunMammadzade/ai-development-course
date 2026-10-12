import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { createPlatformPrisma, type PrismaClient } from "@platform/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../configure-app";
import { FakeEmailProvider } from "./email-provider";
import { JobWorker } from "./job-worker";
import { EMAIL_PROVIDER } from "./ops.tokens";

const PASSWORD = "correct horse battery";
const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = databaseUrl !== undefined && databaseUrl.length > 0;

describe.skipIf(!databaseConfigured)("operational email", () => {
  let app: INestApplication;
  let worker: JobWorker;
  let prisma: PrismaClient;
  const mail = new FakeEmailProvider();

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.PORT;
    delete process.env.EMAIL_PROVIDER;
    prisma = createPlatformPrisma(requiredDatabaseUrl());
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_PROVIDER)
      .useValue(mail)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    worker = app.get(JobWorker);
    appHttp = () => app.getHttpServer();
  }, 60_000);

  afterAll(async () => {
    if (prisma !== undefined) {
      await prisma.user.deleteMany({ where: { email: { startsWith: "ops-step18-" } } });
      await prisma.$disconnect();
    }
    if (app !== undefined) {
      await app.close();
    }
  });

  it("sends one verification email and does not return the token", async () => {
    const email = uniqueEmail();
    const created = await post("/api/v1/auth/register").send(registerBody(email));
    expect(created.status).toBe(201);
    expect(created.body.emailVerified).toBe(false);
    const token = headerValue(created, "x-development-verification-token");
    expect(JSON.stringify(created.body)).not.toContain(token);
    expect(await worker.processAvailable()).toBeGreaterThan(0);
    const sent = mail.sent.filter((message) => message.to === email);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.text).toContain(token);
    expect(sent[0]?.text).not.toContain(PASSWORD);
    expect(await worker.processAvailable()).toBe(0);
    expect(mail.sent.filter((message) => message.to === email)).toHaveLength(1);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.emailVerifiedAt).toBeNull();
  });

  it("keeps reset responses identical and does not consume the token when delivery fails", async () => {
    const email = uniqueEmail();
    const created = await post("/api/v1/auth/register").send(registerBody(email));
    expect(created.status).toBe(201);
    const before = mail.sent.length;
    const unknown = await post("/api/v1/auth/password-reset/request").send({
      email: uniqueEmail(),
    });
    const known = await post("/api/v1/auth/password-reset/request").send({ email });
    expect(unknown.status).toBe(202);
    expect(known.status).toBe(202);
    expect(unknown.body).toEqual(known.body);
    const resetToken = headerValue(known, "x-development-password-reset-token");
    expect(JSON.stringify(known.body)).not.toContain(resetToken);
    expect(unknown.headers["x-development-password-reset-token"]).toBeUndefined();
    mail.fail = "permanent";
    expect(await worker.processAvailable()).toBeGreaterThan(0);
    expect(mail.sent).toHaveLength(before);
    mail.fail = "none";
    const confirmed = await post("/api/v1/auth/password-reset/confirm").send({
      token: resetToken,
      password: "another correct horse",
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body).toEqual({ passwordUpdated: true });
  });
});

function post(path: string): request.Test {
  return request(appHttp()).post(path).set("X-Requested-With", "fetch");
}

let appHttp: () => ReturnType<INestApplication["getHttpServer"]> = () => {
  throw new Error("API is not ready.");
};

function registerBody(email: string) {
  return {
    email,
    password: PASSWORD,
    name: "Ops",
    timezone: "Asia/Baku",
  };
}

function uniqueEmail(): string {
  return `ops-step18-${randomUUID()}@example.com`;
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
