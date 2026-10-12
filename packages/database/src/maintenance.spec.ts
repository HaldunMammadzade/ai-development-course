import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createPlatformPrisma, type PrismaClient } from "./platform-prisma";
import { runOperationalCleanup } from "./maintenance";

const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = databaseUrl !== undefined && databaseUrl.length > 0;

describe.skipIf(!databaseConfigured)("operational cleanup", () => {
  let prisma: PrismaClient;

  afterAll(async () => {
    if (prisma !== undefined) {
      await prisma.user.deleteMany({ where: { email: { startsWith: "ops-cleanup-" } } });
      await prisma.authRateBucket.deleteMany({ where: { action: { startsWith: "ops-cleanup-" } } });
      await prisma.$disconnect();
    }
  });

  it("removes expired temporary rows and keeps learning history", async () => {
    prisma = createPlatformPrisma(requiredDatabaseUrl());
    const masteryBefore = await prisma.skillMastery.count();
    const attemptsBefore = await prisma.exerciseAttempt.count();
    const user = await prisma.user.create({
      data: {
        email: `ops-cleanup-${randomUUID()}@example.com`,
        passwordHash: "hash",
      },
    });
    const now = new Date();
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: `expired-${user.id}`,
        expiresAt: new Date(now.getTime() - 1_000),
      },
    });
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: `revoked-${user.id}`,
        expiresAt: new Date(now.getTime() + 60_000),
        revokedAt: now,
      },
    });
    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash: `live-${user.id}`,
        expiresAt: new Date(now.getTime() + 60_000),
      },
    });
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: `expired-token-${user.id}`,
        expiresAt: new Date(now.getTime() - 1_000),
      },
    });
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: `live-token-${user.id}`,
        expiresAt: new Date(now.getTime() + 60_000),
      },
    });
    const subject = randomUUID();
    await prisma.authRateBucket.create({
      data: {
        action: `ops-cleanup-${subject}`,
        subjectHash: "old",
        windowStart: new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000),
        hits: 1,
      },
    });
    await prisma.authRateBucket.create({
      data: {
        action: `ops-cleanup-${subject}`,
        subjectHash: "new",
        windowStart: now,
        hits: 1,
      },
    });

    await expect(
      prisma.$transaction(async (tx) => {
        await runOperationalCleanup(tx, now);
        const sessions = await tx.session.findMany({ where: { userId: user.id } });
        expect(sessions.map((session) => session.tokenHash)).toEqual([`live-${user.id}`]);
        const tokens = await tx.emailVerificationToken.findMany({ where: { userId: user.id } });
        expect(tokens.map((token) => token.tokenHash)).toEqual([`live-token-${user.id}`]);
        expect(
          await tx.authRateBucket.findFirst({
            where: { action: `ops-cleanup-${subject}`, subjectHash: "old" },
          }),
        ).toBeNull();
        expect(
          await tx.authRateBucket.findFirst({
            where: { action: `ops-cleanup-${subject}`, subjectHash: "new" },
          }),
        ).not.toBeNull();
        expect(await tx.skillMastery.count()).toBe(masteryBefore);
        expect(await tx.exerciseAttempt.count()).toBe(attemptsBefore);
        throw new Error("rollback");
      }),
    ).rejects.toThrow("rollback");
  });
});

function requiredDatabaseUrl(): string {
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required.");
  }
  return databaseUrl;
}
