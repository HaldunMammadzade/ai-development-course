import { randomUUID } from "node:crypto";
import path from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { describe, expect, it } from "vitest";
import { createAiRepository } from "./ai-repository";
import { seedCurriculum } from "./curriculum-seed";
import { PrismaClient } from "./generated/prisma/client";

loadEnv({ path: path.resolve(__dirname, "../../../.env"), quiet: true });

const databaseUrl = process.env.DATABASE_URL;
const databaseConfigured = databaseUrl !== undefined && databaseUrl.length > 0;

if (!databaseConfigured) {
  console.warn("AI repository integration tests skipped: DATABASE_URL is not set.");
}

describe.skipIf(!databaseConfigured)("ai repository", () => {
  it("records usage and upserts a generic explanation without storing a provider key", async () => {
    const prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: requiredDatabaseUrl() }),
    });
    const repository = createAiRepository(requiredDatabaseUrl());
    const correlationId = `ai-${randomUUID()}`;
    try {
      await seedCurriculum(prisma);
      const concept = await prisma.concept.findUniqueOrThrow({ where: { slug: "web.http" } });
      const usage = await repository.recordUsage({
        userId: null,
        task: "teach",
        provider: "openai-compatible",
        model: "teach-model",
        inputTokens: 20,
        outputTokens: 8,
        costMicros: 150n,
        cached: false,
        latencyMs: 12,
        correlationId,
        sessionId: null,
      });
      const row = await prisma.aiUsage.findUniqueOrThrow({ where: { id: usage.id } });
      expect(row.taskType).toBe("teach");
      expect(row.inputTokens).toBe(20);
      expect(row.outputTokens).toBe(8);
      expect(row.costMicros).toBe(150n);
      expect(Object.keys(row)).not.toContain("apiKey");

      const key = {
        conceptId: concept.id,
        locale: "az-AZ" as const,
        difficulty: "beginner" as const,
        style: "clear" as const,
      };
      await repository.saveExplanation({
        ...key,
        speech: "HTTP is a request and a response.",
        model: "teach-model",
      });
      expect(await repository.findExplanation(key)).toEqual({
        speech: "HTTP is a request and a response.",
        model: "teach-model",
      });
      await repository.saveExplanation({
        ...key,
        speech: "Updated generic explanation.",
        model: "teach-model",
      });
      expect((await repository.findExplanation(key))?.speech).toBe("Updated generic explanation.");
    } finally {
      await prisma.aiUsage.deleteMany({ where: { correlationId } });
      await prisma.explanationCache.deleteMany({ where: { model: "teach-model" } });
      await repository.disconnect();
      await prisma.$disconnect();
    }
  });
});

function requiredDatabaseUrl(): string {
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error("DATABASE_URL is required.");
  }
  return databaseUrl;
}
