import "reflect-metadata";
import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SESSION_COOKIE_NAME } from "@platform/config";
import { seedCurriculumDatabase, type IdentityRepository } from "@platform/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../configure-app";
import { IDENTITY_REPOSITORY } from "../identity/identity.repository";
import { IdentityModule } from "../identity/identity.module";
import { createOpaqueToken, hashOpaqueToken } from "../identity/opaque-token";
import { developmentSecretHeader } from "./cookies";

const PASSWORD = "correct horse battery";
const NEXT_PASSWORD = "correct horse battery two";
const EMAIL_PREFIX = "auth-step4-";
const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = databaseUrl !== undefined && databaseUrl.length > 0;

describe("development token headers", () => {
  it("hides raw tokens when the API is in production", () => {
    expect(
      developmentSecretHeader("production", "X-Development-Verification-Token", "secret"),
    ).toBeNull();
    expect(developmentSecretHeader("test", "X-Development-Verification-Token", null)).toBeNull();
    expect(developmentSecretHeader("test", "X-Development-Verification-Token", "secret")).toEqual([
      "X-Development-Verification-Token",
      "secret",
    ]);
  });
});

describe.skipIf(!databaseConfigured)("auth HTTP", () => {
  let app: INestApplication;
  let repository: IdentityRepository;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.PORT;
    await seedCurriculumDatabase(requiredDatabaseUrl());

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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
  });

  it("rejects a mutating request without the fetch header", async () => {
    const response = await request(app.getHttpServer()).post("/api/v1/auth/login").send({
      email: "ada@example.com",
      password: PASSWORD,
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("registers a student, verifies email, and returns the deterministic next action", async () => {
    const email = uniqueEmail();
    const registered = await post("/api/v1/auth/register").send({
      email: ` ${email.toUpperCase()} `,
      password: PASSWORD,
      name: " Aysel ",
      timezone: "Asia/Baku",
    });

    expect(registered.status).toBe(201);
    expect(registered.headers["set-cookie"]).toBeUndefined();
    const verificationToken = headerValue(registered, "x-development-verification-token");
    expect(registered.body).toEqual({
      id: expect.any(String),
      email,
      name: "Aysel",
      locale: "az-AZ",
      timezone: "Asia/Baku",
      emailVerified: false,
    });
    expect(JSON.stringify(registered.body)).not.toContain(verificationToken);
    expect(JSON.stringify(registered.body)).not.toContain("passwordHash");

    const userId = registered.body.id as string;
    const hashes = await repository.emailVerificationTokenHashes(userId);
    expect(hashes).toContain(hashOpaqueToken(verificationToken));
    expect(hashes).not.toContain(verificationToken);

    const counts = await repository.countOnboarding(userId);
    expect(counts).toEqual({
      plans: 1,
      activeEnrollments: 1,
      enrollments: 1,
      preferences: 1,
      pathSlugs: ["frontend"],
    });

    const unverified = await post("/api/v1/auth/login").send({ email, password: PASSWORD });
    expect(unverified.status).toBe(403);
    expect(unverified.body.error.code).toBe("EMAIL_UNVERIFIED");
    expect(unverified.headers["set-cookie"]).toBeUndefined();

    const unverifiedSession = createOpaqueToken();
    await repository.insertSession({
      userId,
      tokenHash: hashOpaqueToken(unverifiedSession),
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
    });
    const meWhileUnverified = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${unverifiedSession}`);
    expect(meWhileUnverified.status).toBe(200);
    expect(meWhileUnverified.body.emailVerified).toBe(false);
    const teachingWhileUnverified = await request(app.getHttpServer())
      .get("/api/v1/auth/teaching-access")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${unverifiedSession}`);
    expect(teachingWhileUnverified.status).toBe(403);
    expect(teachingWhileUnverified.body.error.code).toBe("EMAIL_UNVERIFIED");

    const verified = await post("/api/v1/auth/verify-email").send({ token: verificationToken });
    expect(verified.status).toBe(200);
    expect(verified.body).toEqual({ emailVerified: true });
    const reused = await post("/api/v1/auth/verify-email").send({ token: verificationToken });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe("VERIFICATION_USED");
    expect(JSON.stringify(reused.body)).not.toContain(email);

    const loggedIn = await post("/api/v1/auth/login").send({ email, password: PASSWORD });
    expect(loggedIn.status).toBe(200);
    const sessionToken = sessionCookie(loggedIn);
    expect(JSON.stringify(loggedIn.body)).not.toContain(sessionToken);
    expect(loggedIn.body.emailVerified).toBe(true);
    const session = await repository.findSessionByTokenHash(hashOpaqueToken(sessionToken));
    expect(session?.tokenHash).toBe(hashOpaqueToken(sessionToken));
    expect(session?.tokenHash).not.toBe(sessionToken);
    expect(session?.revokedAt).toBeNull();

    const me = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      id: userId,
      email,
      name: "Aysel",
      locale: "az-AZ",
      timezone: "Asia/Baku",
      emailVerified: true,
      preferences: { explanationStyle: "clear", challengeLevel: "adaptive" },
      plan: { code: "free", dailyTeacherTurns: 40, monthlyTeacherTurns: 600 },
      enrollment: { pathSlug: "frontend", status: "active" },
      nextAction: { kind: "start_lesson", title: "Brauzer səhifəni necə alır" },
    });
    expect(JSON.stringify(me.body)).not.toContain("passwordHash");
    expect(JSON.stringify(me.body)).not.toContain(sessionToken);

    const teaching = await request(app.getHttpServer())
      .get("/api/v1/auth/teaching-access")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
    expect(teaching.status).toBe(200);
    expect(teaching.body).toEqual({ allowed: true });

    await repository.ensureStudentOnboarding(userId, new Date());
    await repository.ensureStudentOnboarding(userId, new Date());
    expect(await repository.countOnboarding(userId)).toEqual(counts);
  });

  it("rejects invalid registration and duplicate normalized emails", async () => {
    const email = uniqueEmail();
    const invalidEmail = await post("/api/v1/auth/register").send({
      email: "not-an-email",
      password: PASSWORD,
      name: "Aysel",
    });
    expect(invalidEmail.status).toBe(400);
    expect(invalidEmail.body.error.code).toBe("VALIDATION");

    const weak = await post("/api/v1/auth/register").send({
      email,
      password: "password123",
      name: "Aysel",
    });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe("VALIDATION");
    expect(JSON.stringify(weak.body)).not.toContain("password123");

    const timezone = await post("/api/v1/auth/register").send({
      email,
      password: PASSWORD,
      name: "Aysel",
      timezone: "Not/AZone",
    });
    expect(timezone.status).toBe(400);
    expect(timezone.body.error.code).toBe("VALIDATION");

    const unknownKey = await post("/api/v1/auth/register").send({
      email,
      password: PASSWORD,
      name: "Aysel",
      role: "admin",
    });
    expect(unknownKey.status).toBe(400);

    const created = await post("/api/v1/auth/register").send({
      email: ` ${email.toUpperCase()} `,
      password: PASSWORD,
      name: "Aysel",
    });
    expect(created.status).toBe(201);
    expect(created.body.email).toBe(email);
    expect(created.body.locale).toBe("az-AZ");
    expect(created.body.timezone).toBe("UTC");

    const duplicate = await post("/api/v1/auth/register").send({
      email,
      password: PASSWORD,
      name: "Aysel",
    });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe("CONFLICT");
    expect(JSON.stringify(duplicate.body)).not.toContain("passwordHash");
  });

  it("rejects invalid, expired, and reused verification tokens without naming an email", async () => {
    const email = uniqueEmail();
    const created = await post("/api/v1/auth/register").send({
      email,
      password: PASSWORD,
      name: "Aysel",
    });
    const userId = created.body.id as string;
    const expiredToken = createOpaqueToken();
    await repository.insertEmailVerificationToken({
      userId,
      tokenHash: hashOpaqueToken(expiredToken),
      expiresAt: new Date(Date.now() - 1000),
    });

    const invalid = await post("/api/v1/auth/verify-email").send({ token: "not-a-real-token" });
    const expired = await post("/api/v1/auth/verify-email").send({ token: expiredToken });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("VERIFICATION_INVALID");
    expect(expired.status).toBe(400);
    expect(expired.body.error.code).toBe("VERIFICATION_EXPIRED");
    expect(invalid.body.error.message).toBe(expired.body.error.message);
    expect(JSON.stringify(invalid.body)).not.toContain(email);
    expect(JSON.stringify(expired.body)).not.toContain(email);
  });

  it("uses the same login error for an unknown email, a wrong password, and a disabled user", async () => {
    const email = uniqueEmail();
    const created = await registerVerified(email);
    const unknown = await post("/api/v1/auth/login").send({
      email: uniqueEmail(),
      password: PASSWORD,
    });
    const wrong = await post("/api/v1/auth/login").send({ email, password: "not the password" });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
    expect(unknown.body.error.code).toBe("UNAUTHENTICATED");
    expect(unknown.headers["set-cookie"]).toBeUndefined();
    expect(wrong.headers["set-cookie"]).toBeUndefined();

    await repository.updateUserStatus(created.id, "disabled");
    const disabled = await post("/api/v1/auth/login").send({ email, password: PASSWORD });
    expect(disabled.status).toBe(401);
    expect(disabled.body).toEqual(wrong.body);
    expect(disabled.headers["set-cookie"]).toBeUndefined();
  });

  it("rotates the session on login and rejects missing, expired, revoked, and disabled sessions", async () => {
    const email = uniqueEmail();
    await registerVerified(email);
    const first = await post("/api/v1/auth/login").send({ email, password: PASSWORD });
    const firstToken = sessionCookie(first);
    const second = await post("/api/v1/auth/login")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${firstToken}`)
      .send({ email, password: PASSWORD });
    const secondToken = sessionCookie(second);
    expect(secondToken).not.toBe(firstToken);

    const missing = await request(app.getHttpServer()).get("/api/v1/me");
    const expiredToken = createOpaqueToken();
    const userId = first.body.id as string;
    await repository.insertSession({
      userId,
      tokenHash: hashOpaqueToken(expiredToken),
      expiresAt: new Date(Date.now() - 1000),
      createdAt: new Date(Date.now() - 2000),
    });
    const expired = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${expiredToken}`);
    const revoked = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${firstToken}`);
    expect(missing.status).toBe(401);
    expect(expired.status).toBe(401);
    expect(revoked.status).toBe(401);
    expect(missing.body).toEqual(expired.body);
    expect(expired.body).toEqual(revoked.body);
    expect(JSON.stringify(missing.body)).not.toContain(firstToken);

    const current = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${secondToken}`);
    expect(current.status).toBe(200);

    await repository.updateUserStatus(userId, "disabled");
    const disabled = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${secondToken}`);
    expect(disabled.status).toBe(401);
    expect(disabled.body).toEqual(missing.body);
    const teaching = await request(app.getHttpServer()).get("/api/v1/auth/teaching-access");
    expect(teaching.status).toBe(401);
  });

  it("revokes the session and clears the cookie, including a repeated logout", async () => {
    const email = uniqueEmail();
    await registerVerified(email);
    const loggedIn = await post("/api/v1/auth/login").send({ email, password: PASSWORD });
    const sessionToken = sessionCookie(loggedIn);

    const loggedOut = await post("/api/v1/auth/logout").set(
      "Cookie",
      `${SESSION_COOKIE_NAME}=${sessionToken}`,
    );
    expect(loggedOut.status).toBe(204);
    expectClearedSession(loggedOut);
    expect(JSON.stringify(loggedOut.body)).not.toContain(sessionToken);
    const stored = await repository.findSessionByTokenHash(hashOpaqueToken(sessionToken));
    expect(stored?.revokedAt).not.toBeNull();

    const again = await post("/api/v1/auth/logout").set(
      "Cookie",
      `${SESSION_COOKIE_NAME}=${sessionToken}`,
    );
    expect(again.status).toBe(204);
    const after = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
    expect(after.status).toBe(401);
  });

  it("resets a password without revealing whether the email exists and revokes sessions", async () => {
    const email = uniqueEmail();
    const created = await registerVerified(email);
    const loggedIn = await post("/api/v1/auth/login").send({ email, password: PASSWORD });
    const sessionToken = sessionCookie(loggedIn);

    const unknown = await post("/api/v1/auth/password-reset/request").send({
      email: uniqueEmail(),
    });
    const known = await post("/api/v1/auth/password-reset/request").send({ email });
    expect(unknown.status).toBe(202);
    expect(known.status).toBe(202);
    expect(unknown.body).toEqual({ status: "accepted" });
    expect(known.body).toEqual(unknown.body);
    expect(unknown.headers["x-development-password-reset-token"]).toBeUndefined();
    const resetToken = headerValue(known, "x-development-password-reset-token");
    expect(JSON.stringify(known.body)).not.toContain(resetToken);

    const weak = await post("/api/v1/auth/password-reset/confirm").send({
      token: resetToken,
      password: "password123",
    });
    expect(weak.status).toBe(400);
    expect(weak.body.error.code).toBe("VALIDATION");
    expect(JSON.stringify(weak.body)).not.toContain("password123");

    const confirmed = await post("/api/v1/auth/password-reset/confirm").send({
      token: resetToken,
      password: NEXT_PASSWORD,
    });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body).toEqual({ passwordUpdated: true });
    const reused = await post("/api/v1/auth/password-reset/confirm").send({
      token: resetToken,
      password: NEXT_PASSWORD,
    });
    expect(reused.status).toBe(400);
    expect(reused.body.error.code).toBe("PASSWORD_RESET_USED");

    const oldSession = await request(app.getHttpServer())
      .get("/api/v1/me")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${sessionToken}`);
    expect(oldSession.status).toBe(401);
    const oldPassword = await post("/api/v1/auth/login").send({ email, password: PASSWORD });
    expect(oldPassword.status).toBe(401);
    const loggedInAgain = await post("/api/v1/auth/login").send({
      email,
      password: NEXT_PASSWORD,
    });
    expect(loggedInAgain.status).toBe(200);
    expect(loggedInAgain.body.id).toBe(created.id);

    const invalid = await post("/api/v1/auth/password-reset/confirm").send({
      token: "missing-token",
      password: NEXT_PASSWORD,
    });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe("PASSWORD_RESET_INVALID");
    expect(JSON.stringify(invalid.body)).not.toContain(email);
  });

  it("returns the enrolled path with server-owned lesson availability", async () => {
    const anonymous = await request(app.getHttpServer()).get("/api/v1/learning/catalog");
    expect(anonymous.status).toBe(401);

    const email = uniqueEmail();
    await registerVerified(email);
    const loggedIn = await post("/api/v1/auth/login").send({ email, password: PASSWORD });
    const catalog = await request(app.getHttpServer())
      .get("/api/v1/learning/catalog")
      .set("Cookie", `${SESSION_COOKIE_NAME}=${sessionCookie(loggedIn)}`);

    expect(catalog.status).toBe(200);
    expect(catalog.body.path).toMatchObject({ slug: "frontend" });
    expect(catalog.body.nextAction).toMatchObject({
      kind: "start_lesson",
      title: "Brauzer səhifəni necə alır",
    });
    const lessons = catalog.body.modules.flatMap(
      (module: { lessons: Array<{ slug: string; availability: string }> }) => module.lessons,
    );
    expect(lessons[0]).toMatchObject({
      slug: "how-the-web-delivers-a-page",
      availability: "current",
    });
    expect(lessons.some((lesson: { slug: string }) => lesson.slug === "what-a-url-is")).toBe(true);
    expect(
      lessons.find((lesson: { slug: string }) => lesson.slug === "what-a-url-is"),
    ).toMatchObject({ availability: "locked" });
    expect(
      lessons.find((lesson: { slug: string }) => lesson.slug === "css-selectors"),
    ).toMatchObject({ availability: "locked" });
    expect(lessons.some((lesson: { slug: string }) => lesson.slug === "css-grid")).toBe(false);
    expect(lessons.some((lesson: { slug: string }) => lesson.slug === "js-dom")).toBe(false);
    expect(
      lessons.find((lesson: { slug: string }) => lesson.slug === "what-typescript-is"),
    ).toMatchObject({ availability: "locked" });
    expect(
      lessons.find((lesson: { slug: string }) => lesson.slug === "what-react-is"),
    ).toMatchObject({ availability: "locked" });
    expect(
      lessons.find((lesson: { slug: string }) => lesson.slug === "what-nextjs-is"),
    ).toMatchObject({ availability: "locked" });
    expect(lessons.some((lesson: { slug: string }) => lesson.slug === "pages-router")).toBe(false);
    expect(catalog.body.concepts).toContainEqual({
      slug: "web.http",
      name: "HTTP",
      moduleTitle: "Web Fundamentals",
      lessonSlug: "how-the-web-delivers-a-page",
      mastery: null,
      confidence: null,
      band: null,
      reviewDue: false,
    });
    expect(JSON.stringify(catalog.body)).not.toContain(email);
  });

  it("stops repeated registration and password-reset requests without naming the account", async () => {
    const email = uniqueEmail();
    const ip = `rate-${randomUUID()}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const created = await post("/api/v1/auth/register")
        .set("X-Platform-Client-Ip", ip)
        .send({ email, password: PASSWORD, name: "Aysel" });
      expect(created.status).toBe(attempt === 0 ? 201 : 409);
    }
    const limited = await post("/api/v1/auth/register")
      .set("X-Platform-Client-Ip", ip)
      .send({ email, password: PASSWORD, name: "Aysel" });
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect(JSON.stringify(limited.body)).not.toContain(email);
    expect(JSON.stringify(limited.body)).not.toContain(PASSWORD);

    const resetEmail = uniqueEmail();
    const resetIp = `reset-${randomUUID()}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const accepted = await post("/api/v1/auth/password-reset/request")
        .set("X-Platform-Client-Ip", resetIp)
        .send({ email: resetEmail });
      expect(accepted.status).toBe(202);
      expect(accepted.body).toEqual({ status: "accepted" });
    }
    const blocked = await post("/api/v1/auth/password-reset/request")
      .set("X-Platform-Client-Ip", resetIp)
      .send({ email: resetEmail });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(JSON.stringify(blocked.body)).not.toContain(resetEmail);
  });

  it("rejects the second hit in one auth rate bucket", async () => {
    const subjectHash = `bucket-${randomUUID()}`;
    const windowStart = new Date("2026-01-01T00:15:00.000Z");
    const first = await repository.consumeAuthRate({
      action: "login",
      subjectHash,
      windowStart,
      limit: 1,
    });
    const second = await repository.consumeAuthRate({
      action: "login",
      subjectHash,
      windowStart,
      limit: 1,
    });
    expect(first).toEqual({ hits: 1, allowed: true });
    expect(second).toEqual({ hits: 2, allowed: false });
  });

  function post(path: string): request.Test {
    return request(app.getHttpServer()).post(path).set("X-Requested-With", "fetch");
  }

  async function registerVerified(email: string): Promise<{ id: string }> {
    const created = await post("/api/v1/auth/register").send({
      email,
      password: PASSWORD,
      name: "Aysel",
    });
    expect(created.status).toBe(201);
    const token = headerValue(created, "x-development-verification-token");
    const verified = await post("/api/v1/auth/verify-email").send({ token });
    expect(verified.status).toBe(200);
    return { id: created.body.id as string };
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

function cookieLines(response: request.Response): string[] {
  const header = response.headers["set-cookie"];
  if (header === undefined) {
    return [];
  }
  return Array.isArray(header) ? header : [header];
}

function sessionCookie(response: request.Response): string {
  const match = cookieLines(response).find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`));
  expect(match).toBeDefined();
  expect(match).toContain("HttpOnly");
  expect(match).toMatch(/SameSite=Lax/i);
  expect(match).toContain("Path=/");
  expect(match).not.toMatch(/;\s*Secure(?:;|$)/);
  expect(match).not.toMatch(/Domain=/i);
  const raw = match?.split(";")[0]?.slice(`${SESSION_COOKIE_NAME}=`.length) ?? "";
  return decodeURIComponent(raw);
}

function expectClearedSession(response: request.Response): void {
  const match = cookieLines(response).find((value) => value.startsWith(`${SESSION_COOKIE_NAME}=`));
  expect(match).toBeDefined();
  expect(match).toContain("HttpOnly");
  expect(match).toMatch(/Expires=/i);
  expect(match).toMatch(/SameSite=Lax/i);
}
