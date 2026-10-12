import { EmailAlreadyExistsError } from "@platform/database";
import { describe, expect, it } from "vitest";
import { IdentityService, PasswordRejectedError } from "./identity.service";
import { hashOpaqueToken } from "./opaque-token";
import { PasswordService } from "./password.service";
import { SessionService } from "./session.service";
import { MemoryIdentityRepository } from "./testing/memory-identity.repository";

const password = "correct horse battery";

describe("IdentityService", () => {
  it("creates a user without returning the password hash and stores default preferences", async () => {
    const repository = new MemoryIdentityRepository();
    const service = new IdentityService(repository, new PasswordService());

    const user = await service.createUser({ email: " Ada@Example.com ", password });

    expect(user.email).toBe("ada@example.com");
    expect(user.emailVerifiedAt).toBeNull();
    expect(user.status).toBe("active");
    expect(user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(user)).not.toContain(password);

    const stored = await repository.findUserByEmail("ada@example.com");
    expect(stored?.passwordHash.startsWith("$argon2id$")).toBe(true);
    expect(stored?.passwordHash).not.toContain(password);
    expect(stored?.locale).toBe("az-AZ");
    expect(stored?.timezone).toBe("UTC");

    const preferences = await repository.findPreferences(user.id);
    expect(preferences).toMatchObject({
      explanationStyle: "clear",
      challengeLevel: "adaptive",
    });
  });

  it("rejects a duplicate email and a weak password", async () => {
    const repository = new MemoryIdentityRepository();
    const service = new IdentityService(repository, new PasswordService());
    await service.createUser({ email: "ada@example.com", password });

    await expect(service.createUser({ email: "ada@example.com", password })).rejects.toBeInstanceOf(
      EmailAlreadyExistsError,
    );
    await expect(
      service.createUser({ email: "other@example.com", password: "password123" }),
    ).rejects.toBeInstanceOf(PasswordRejectedError);
    await expect(
      service.createUser({ email: "other@example.com", password: "password123" }),
    ).rejects.toThrow("Password does not meet the password policy.");
  });

  it("looks up a user by normalized email", async () => {
    const repository = new MemoryIdentityRepository();
    const service = new IdentityService(repository, new PasswordService());
    const created = await service.createUser({ email: "ada@example.com", password });

    await expect(service.findByEmail(" Ada@Example.com ")).resolves.toMatchObject({
      id: created.id,
      email: "ada@example.com",
    });
    await expect(service.findByEmail("missing@example.com")).resolves.toBeNull();
    await expect(service.findByEmail("not-an-email")).resolves.toBeNull();
  });

  it("verifies credentials without distinguishing an unknown email from a bad password", async () => {
    const repository = new MemoryIdentityRepository();
    const service = new IdentityService(repository, new PasswordService());
    const created = await service.createUser({ email: "ada@example.com", password });

    await expect(service.verifyCredentials("ada@example.com", password)).resolves.toMatchObject({
      id: created.id,
    });
    await expect(
      service.verifyCredentials("ada@example.com", "wrong passphrase"),
    ).resolves.toBeNull();
    await expect(service.verifyCredentials("missing@example.com", password)).resolves.toBeNull();
  });

  it("stores only hashes of email and reset tokens, and reset revokes sessions", async () => {
    const repository = new MemoryIdentityRepository();
    const passwords = new PasswordService();
    const identity = new IdentityService(repository, passwords);
    const sessions = new SessionService(repository, { nodeEnv: "test" });
    const user = await identity.createUser({ email: "ada@example.com", password });
    const session = await sessions.createSession(user.id, new Date("2026-01-01T00:00:00.000Z"));

    const verificationToken = await identity.issueEmailVerification(user.id);
    expect(await repository.consumeEmailVerificationToken(verificationToken, new Date())).toEqual({
      status: "missing",
    });
    await expect(identity.consumeEmailVerification(verificationToken)).resolves.toMatchObject({
      status: "consumed",
      userId: user.id,
    });
    expect((await repository.findUserById(user.id))?.emailVerifiedAt).not.toBeNull();

    const resetToken = await identity.issuePasswordReset(user.id);
    expect(hashOpaqueToken(resetToken)).not.toBe(resetToken);
    const reset = await identity.resetPassword(resetToken, "a newer passphrase");
    expect(reset).toMatchObject({ status: "consumed", userId: user.id });

    await expect(sessions.resolveSession(session.token)).rejects.toMatchObject({
      reason: "revoked",
    });
    await expect(identity.verifyCredentials("ada@example.com", password)).resolves.toBeNull();
    await expect(
      identity.verifyCredentials("ada@example.com", "a newer passphrase"),
    ).resolves.toMatchObject({ id: user.id });
  });
});
