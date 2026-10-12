import "reflect-metadata";
import { Controller, type INestApplication, Module, Post } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { loadApiEnv } from "@platform/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { z } from "zod";
import { configureApp } from "../../configure-app";
import { ValidateBody } from "./zod-body.interceptor";

const nameSchema = z.object({
  name: z.string().min(1),
});

@Controller("probe")
class ProbeController {
  @Post()
  @ValidateBody(nameSchema)
  create(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => loadApiEnv(config),
    }),
  ],
  controllers: [ProbeController],
})
class ProbeModule {}

describe("request validation", () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    delete process.env.PORT;

    const moduleRef = await Test.createTestingModule({
      imports: [ProbeModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects an invalid body with the error contract", async () => {
    const response = await request(app.getHttpServer()).post("/api/v1/probe").send({ name: "" });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION");
    expect(response.body.error.details.issues).toEqual([expect.objectContaining({ path: "name" })]);
  });

  it("accepts a valid body", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/v1/probe")
      .send({ name: "Aysel" });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ ok: true });
  });
});
