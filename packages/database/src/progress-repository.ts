import { PrismaPg } from "@prisma/adapter-pg";
import { calculateMastery, type MasteryProjection } from "@platform/curriculum";
import { type Prisma, PrismaClient } from "./generated/prisma/client";

export interface NewLearningEvent {
  userId: string;
  conceptId: string;
  source: "lesson_check" | "homework" | "exercise" | "quiz";
  evidence: number;
  weight: number;
  metadata?: Prisma.InputJsonObject;
}

export interface WeakConceptRow {
  conceptSlug: string;
  score: number;
  evidenceCount: number;
  lastEvidenceAt: Date;
}

export interface ProgressRepository {
  recordLearningEvent(input: NewLearningEvent): Promise<{ id: string }>;
  rebuildSkillMastery(input: {
    userId: string;
    conceptId: string;
    now: Date;
    timeZone: string;
  }): Promise<MasteryProjection | null>;
  listWeakConcepts(userId: string): Promise<WeakConceptRow[]>;
  disconnect(): Promise<void>;
}

export function createProgressRepository(databaseUrl: string): ProgressRepository {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  return new PrismaProgressRepository(prisma);
}

export async function writeSkillMasteryProjection(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: { userId: string; conceptId: string; now: Date; timeZone: string },
): Promise<MasteryProjection | null> {
  const events = await prisma.learningEvent.findMany({
    where: { userId: input.userId, conceptId: input.conceptId },
  });
  const projection = calculateMastery({
    events: events.map((event) => ({
      id: event.id,
      occurredAt: event.createdAt,
      evidence: event.evidence,
      weight: Number(event.weight),
    })),
    now: input.now,
    timeZone: input.timeZone,
  });

  if (projection === null) {
    await prisma.skillMastery.deleteMany({
      where: { userId: input.userId, conceptId: input.conceptId },
    });
    return null;
  }

  await prisma.skillMastery.upsert({
    where: { userId_conceptId: { userId: input.userId, conceptId: input.conceptId } },
    create: {
      userId: input.userId,
      conceptId: input.conceptId,
      score: projection.score,
      evidenceCount: projection.evidenceCount,
      lastEvidenceAt: projection.lastEvidenceAt,
    },
    update: {
      score: projection.score,
      evidenceCount: projection.evidenceCount,
      lastEvidenceAt: projection.lastEvidenceAt,
    },
  });
  return projection;
}

class PrismaProgressRepository implements ProgressRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordLearningEvent(input: NewLearningEvent): Promise<{ id: string }> {
    const event = await this.prisma.learningEvent.create({
      data: {
        userId: input.userId,
        conceptId: input.conceptId,
        source: input.source,
        evidence: input.evidence,
        weight: input.weight,
        metadata: input.metadata ?? {},
      },
    });
    return { id: event.id };
  }

  rebuildSkillMastery(input: {
    userId: string;
    conceptId: string;
    now: Date;
    timeZone: string;
  }): Promise<MasteryProjection | null> {
    return writeSkillMasteryProjection(this.prisma, input);
  }

  async listWeakConcepts(userId: string): Promise<WeakConceptRow[]> {
    const rows = await this.prisma.skillMastery.findMany({
      where: { userId, score: { lt: 45 }, evidenceCount: { gte: 2 } },
      include: { concept: { select: { slug: true } } },
      orderBy: [{ score: "asc" }, { concept: { slug: "asc" } }],
    });
    return rows.map((row) => ({
      conceptSlug: row.concept.slug,
      score: row.score,
      evidenceCount: row.evidenceCount,
      lastEvidenceAt: row.lastEvidenceAt,
    }));
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
