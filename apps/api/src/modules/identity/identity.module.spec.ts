import "reflect-metadata";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { loadApiEnv } from "@platform/config";
import { describe, expect, it } from "vitest";
import { IDENTITY_REPOSITORY } from "./identity.repository";
import { IdentityModule } from "./identity.module";
import { IdentityService } from "./identity.service";
import { SessionService } from "./session.service";
import { MemoryIdentityRepository } from "./testing/memory-identity.repository";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validate: () =>
        loadApiEnv({
          NODE_ENV: "test",
          DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/platform",
        }),
    }),
    IdentityModule,
  ],
})
class IdentityTestModule {}

describe("IdentityModule", () => {
  it("wires identity and session services without opening a database connection", async () => {
    const repository = new MemoryIdentityRepository();
    const moduleRef = await Test.createTestingModule({
      imports: [IdentityTestModule],
    })
      .overrideProvider(IDENTITY_REPOSITORY)
      .useValue(repository)
      .compile();

    const identity = moduleRef.get(IdentityService);
    const sessions = moduleRef.get(SessionService);
    const user = await identity.createUser({
      email: "ada@example.com",
      password: "correct horse battery",
    });
    const created = await sessions.createSession(user.id);
    const resolved = await sessions.resolveSession(created.token);

    expect(resolved.userId).toBe(user.id);
    expect(created.cookie.options.httpOnly).toBe(true);
    await moduleRef.close();
  });
});
