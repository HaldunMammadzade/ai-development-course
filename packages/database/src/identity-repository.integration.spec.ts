import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";
import { PrismaClient } from "./generated/prisma/client";
import { EmailAlreadyExistsError } from "./identity";
import { createIdentityRepository } from "./prisma-identity-repository";

loadEnv({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = databaseUrl !== undefined && databaseUrl.length > 0;

if (!databaseConfigured) {
  console.warn("Identity repository integration tests skipped: DATABASE_URL is not set.");
}

describe.skipIf(!databaseConfigured)("prisma identity repository", () => {
  it("creates a user, enforces a unique email, and looks the user up by email", async () => {
    const repository = createIdentityRepository(requiredDatabaseUrl());
    const email = `ada-${randomUUID()}@example.com`;
    try {
      const user = await repository.createUser({
        email,
        passwordHash: "argon2id-hash",
      });

      expect(user.email).toBe(email);
      expect(user.passwordHash).toBe("argon2id-hash");
      expect(user.locale).toBe("az-AZ");
      expect(user.timezone).toBe("UTC");
      expect(await repository.findUserByEmail(email)).toMatchObject({ id: user.id });
      expect(await repository.findPreferences(user.id)).toMatchObject({
        userId: user.id,
        explanationStyle: "clear",
        challengeLevel: "adaptive",
      });

      await expect(
        repository.createUser({
          email: email.toUpperCase(),
          passwordHash: "other-hash",
        }),
      ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
    } finally {
      await deleteUserByEmail(email);
      await repository.disconnect();
    }
  });

  it("stores a session by token hash and updates lastUsedAt", async () => {
    const repository = createIdentityRepository(requiredDatabaseUrl());
    const email = `session-${randomUUID()}@example.com`;
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    try {
      const user = await repository.createUser({
        email,
        passwordHash: "argon2id-hash",
      });
      const created = await repository.insertSession({
        userId: user.id,
        tokenHash,
        expiresAt: new Date("2026-04-16T00:00:00.000Z"),
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
      });

      expect(created.tokenHash).toBe(tokenHash);
      expect(created.tokenHash).not.toBe(rawToken);
      expect(await repository.findSessionByTokenHash(rawToken)).toBeNull();

      const usedAt = new Date("2026-04-03T00:00:00.000Z");
      const updated = await repository.updateSessionActivity({
        sessionId: created.id,
        lastUsedAt: usedAt,
        expiresAt: created.expiresAt,
      });
      expect(updated.lastUsedAt).toEqual(usedAt);
      expect((await repository.findSessionByTokenHash(tokenHash))?.lastUsedAt).toEqual(usedAt);
    } finally {
      await deleteUserByEmail(email);
      await repository.disconnect();
    }
  });
});

function requiredDatabaseUrl(): string {
  if (databaseUrl === undefined) {
    throw new Error("DATABASE_URL is not set.");
  }
  return databaseUrl;
}

async function deleteUserByEmail(email: string): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: requiredDatabaseUrl() }),
  });
  try {
    await prisma.user.deleteMany({ where: { email } });
  } finally {
    await prisma.$disconnect();
  }
}
