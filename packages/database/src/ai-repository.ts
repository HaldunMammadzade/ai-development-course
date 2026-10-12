import { PrismaPg } from "@prisma/adapter-pg";
import type { ExplanationStyle, Locale } from "@platform/types";
import { PrismaClient } from "./generated/prisma/client";

export interface NewAiUsage {
  userId: string | null;
  task: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: bigint;
  cached: boolean;
  latencyMs: number;
  correlationId: string;
  sessionId: string | null;
}

export interface ExplanationCacheKey {
  conceptId: string;
  locale: Locale;
  difficulty: "beginner" | "intermediate" | "advanced";
  style: ExplanationStyle;
}

export interface StoredExplanation {
  speech: string;
  model: string;
}

export interface AiRepository {
  recordUsage(input: NewAiUsage): Promise<{ id: string }>;
  findExplanation(key: ExplanationCacheKey): Promise<StoredExplanation | null>;
  saveExplanation(input: ExplanationCacheKey & { speech: string; model: string }): Promise<void>;
  disconnect(): Promise<void>;
}

export function createAiRepository(databaseUrl: string): AiRepository {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  return new PrismaAiRepository(prisma);
}

class PrismaAiRepository implements AiRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordUsage(input: NewAiUsage): Promise<{ id: string }> {
    const row = await this.prisma.aiUsage.create({
      data: {
        userId: input.userId,
        taskType: input.task,
        provider: input.provider,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        costMicros: input.costMicros,
        cached: input.cached,
        latencyMs: input.latencyMs,
        correlationId: input.correlationId,
        sessionId: input.sessionId,
      },
      select: { id: true },
    });
    return row;
  }

  async findExplanation(key: ExplanationCacheKey): Promise<StoredExplanation | null> {
    const row = await this.prisma.explanationCache.findUnique({
      where: {
        conceptId_locale_difficulty_style: {
          conceptId: key.conceptId,
          locale: toPrismaLocale(key.locale),
          difficulty: key.difficulty,
          style: key.style,
        },
      },
    });
    if (row === null) {
      return null;
    }
    return { speech: row.speech, model: row.model };
  }

  async saveExplanation(
    input: ExplanationCacheKey & { speech: string; model: string },
  ): Promise<void> {
    const locale = toPrismaLocale(input.locale);
    await this.prisma.explanationCache.upsert({
      where: {
        conceptId_locale_difficulty_style: {
          conceptId: input.conceptId,
          locale,
          difficulty: input.difficulty,
          style: input.style,
        },
      },
      create: {
        conceptId: input.conceptId,
        locale,
        difficulty: input.difficulty,
        style: input.style,
        speech: input.speech,
        model: input.model,
      },
      update: {
        speech: input.speech,
        model: input.model,
      },
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

function toPrismaLocale(locale: Locale): "az_AZ" | "en" | "tr" | "ru" {
  return locale === "az-AZ" ? "az_AZ" : locale;
}
