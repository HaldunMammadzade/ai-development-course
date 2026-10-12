import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { AppModule } from "../../app.module";
import { configureApp } from "../../configure-app";

describe("HTTP API", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.PORT;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /api/v1/health returns ok", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
    expect(response.headers["x-correlation-id"]).toEqual(expect.any(String));
  });

  it("echoes a safe correlation id and replaces an unsafe one", async () => {
    const response = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("x-correlation-id", "lesson-123");

    expect(response.headers["x-correlation-id"]).toBe("lesson-123");
    const rejected = await request(app.getHttpServer())
      .get("/api/v1/health")
      .set("x-correlation-id", "a".repeat(200));
    expect(rejected.headers["x-correlation-id"]).not.toBe("a".repeat(200));
    expect(String(rejected.headers["x-correlation-id"]).length).toBeLessThanOrEqual(128);
  });

  it("keeps liveness independent of providers and hides readiness details", async () => {
    const live = await request(app.getHttpServer()).get("/api/v1/health/live");
    expect(live.status).toBe(200);
    expect(live.body).toEqual({ status: "ok" });
    const ready = await request(app.getHttpServer()).get("/api/v1/health/ready");
    if (process.env.DATABASE_URL) {
      expect(ready.status).toBe(200);
      expect(ready.body).toEqual({ status: "ok" });
    } else {
      expect(ready.status).toBe(503);
      expect(ready.body.error.code).toBe("DATABASE_UNAVAILABLE");
    }
    const serialized = JSON.stringify(ready.body);
    expect(serialized).not.toContain("postgres");
    expect(serialized).not.toContain("DATABASE_URL");
    expect(live.headers["x-content-type-options"]).toBe("nosniff");
    expect(live.headers["referrer-policy"]).toBe("no-referrer");
    expect(live.headers["content-security-policy"]).toContain("default-src 'none'");
    expect(live.headers["permissions-policy"]).toContain("microphone=()");
    const crossOrigin = await request(app.getHttpServer())
      .get("/api/v1/health/live")
      .set("Origin", "https://evil.example");
    expect(crossOrigin.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("returns the error contract for an unknown route", async () => {
    const response = await request(app.getHttpServer()).get("/api/v1/missing");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        code: "NOT_FOUND",
        message: expect.any(String) as string,
      },
    });
  });
});
