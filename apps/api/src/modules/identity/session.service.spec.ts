import { describe, expect, it } from "vitest";
import { hashOpaqueToken } from "./opaque-token";
import { SessionRejectedError, SessionService } from "./session.service";
import { MemoryIdentityRepository } from "./testing/memory-identity.repository";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("SessionService", () => {
  it("stores only the token hash and builds an httpOnly cookie", async () => {
    const repository = new MemoryIdentityRepository();
    const user = await repository.createUser({
      email: "ada@example.com",
      passwordHash: "stored-hash",
    });
    const service = new SessionService(repository, { nodeEnv: "development" });
    const created = await service.createSession(user.id, new Date("2026-01-01T00:00:00.000Z"));

    expect(created.token).not.toBe("");
    expect(created.cookie.name).toBe("session");
    expect(created.cookie.value).toBe(created.token);
    expect(created.cookie.options.httpOnly).toBe(true);
    expect(created.cookie.options.sameSite).toBe("lax");
    expect(created.cookie.options.path).toBe("/");
    expect(created.cookie.options.secure).toBe(false);
    expect(created.cookie.options.domain).toBeUndefined();

    const stored = await repository.findSessionByTokenHash(hashOpaqueToken(created.token));
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).toBe(hashOpaqueToken(created.token));
    expect(stored?.tokenHash).not.toBe(created.token);
    expect(await repository.findSessionByTokenHash(created.token)).toBeNull();
  });

  it("marks the cookie secure in production and sets an explicit domain", async () => {
    const repository = new MemoryIdentityRepository();
    const user = await repository.createUser({
      email: "ada@example.com",
      passwordHash: "stored-hash",
    });
    const service = new SessionService(repository, {
      nodeEnv: "production",
      cookieDomain: "example.com",
    });
    const created = await service.createSession(user.id);

    expect(created.cookie.options.secure).toBe(true);
    expect(created.cookie.options.domain).toBe("example.com");
  });

  it("accepts a valid session and updates lastUsedAt without sliding inside a day", async () => {
    const { service, token, start } = await openSession();
    const usedAt = new Date(start.getTime() + 60 * 60 * 1000);
    const resolved = await service.resolveSession(token, usedAt);

    expect(resolved.lastUsedAt).toEqual(usedAt);
    expect(resolved.expiresAt).toEqual(new Date(start.getTime() + 14 * DAY_MS));
  });

  it("extends expiry after 24 hours, capped at 30 days from issuance", async () => {
    const { service, token, start } = await openSession();
    const firstUse = new Date(start.getTime() + 13 * DAY_MS);
    const extended = await service.resolveSession(token, firstUse);
    expect(extended.expiresAt).toEqual(new Date(start.getTime() + 27 * DAY_MS));

    const nearCap = new Date(start.getTime() + 20 * DAY_MS);
    const capped = await service.resolveSession(token, nearCap);
    expect(capped.lastUsedAt).toEqual(nearCap);
    expect(capped.expiresAt).toEqual(new Date(start.getTime() + 30 * DAY_MS));
  });

  it("rejects an expired session", async () => {
    const { service, token, start } = await openSession();
    const expiredAt = new Date(start.getTime() + 14 * DAY_MS);

    await expect(service.resolveSession(token, expiredAt)).rejects.toMatchObject({
      name: "SessionRejectedError",
      reason: "expired",
    });
    await expect(service.resolveSession(token, expiredAt)).rejects.toBeInstanceOf(
      SessionRejectedError,
    );
  });

  it("rejects a revoked session", async () => {
    const { service, token, sessionId, start } = await openSession();
    await service.revokeSession(sessionId, start);

    await expect(service.resolveSession(token, start)).rejects.toMatchObject({
      reason: "revoked",
    });
  });

  it("rejects a session for a disabled user", async () => {
    const repository = new MemoryIdentityRepository();
    const user = await repository.createUser({
      email: "ada@example.com",
      passwordHash: "stored-hash",
    });
    const service = new SessionService(repository, { nodeEnv: "test" });
    const created = await service.createSession(user.id, new Date("2026-01-01T00:00:00.000Z"));
    repository.disableUser(user.id);

    await expect(
      service.resolveSession(created.token, new Date("2026-01-02T00:00:00.000Z")),
    ).rejects.toMatchObject({
      reason: "disabled",
    });
  });

  it("rejects an unknown token", async () => {
    const repository = new MemoryIdentityRepository();
    const service = new SessionService(repository, { nodeEnv: "test" });

    await expect(service.resolveSession("missing-token")).rejects.toMatchObject({
      reason: "missing",
    });
  });
});

async function openSession(): Promise<{
  service: SessionService;
  token: string;
  sessionId: string;
  start: Date;
}> {
  const repository = new MemoryIdentityRepository();
  const user = await repository.createUser({
    email: "ada@example.com",
    passwordHash: "stored-hash",
  });
  const service = new SessionService(repository, { nodeEnv: "test" });
  const start = new Date("2026-01-01T00:00:00.000Z");
  const created = await service.createSession(user.id, start);
  return { service, token: created.token, sessionId: created.sessionId, start };
}
