import type { Prisma } from "./generated/prisma/client";
import { createPlatformPrisma, type PrismaClient } from "./platform-prisma";

export interface ClaimedJob {
  id: string;
  name: string;
  attempts: number;
  maxAttempts: number;
  payload: unknown;
  correlationId: string | null;
  idempotencyKey: string;
}

export interface JobRepository {
  enqueue(input: {
    name: string;
    idempotencyKey: string;
    payload: Prisma.InputJsonValue;
    correlationId: string | null;
    maxAttempts: number;
    runAfter: Date;
  }): Promise<"queued" | "duplicate">;
  claim(): Promise<ClaimedJob | null>;
  complete(id: string): Promise<void>;
  retry(id: string, errorCode: string, runAfter: Date): Promise<void>;
  dead(id: string, errorCode: string): Promise<void>;
  disconnect(): Promise<void>;
}

interface ClaimRow {
  id: string;
  name: string;
  attempts: number;
  max_attempts: number;
  payload: unknown;
  correlation_id: string | null;
  idempotency_key: string;
}

export function createJobRepository(databaseUrl: string): JobRepository {
  const prisma = createPlatformPrisma(databaseUrl);
  return new PrismaJobRepository(prisma);
}

class PrismaJobRepository implements JobRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async enqueue(input: {
    name: string;
    idempotencyKey: string;
    payload: Prisma.InputJsonValue;
    correlationId: string | null;
    maxAttempts: number;
    runAfter: Date;
  }): Promise<"queued" | "duplicate"> {
    const created = await this.prisma.operationalJob.createMany({
      data: [
        {
          name: input.name,
          idempotencyKey: input.idempotencyKey,
          payload: input.payload,
          status: "pending",
          maxAttempts: input.maxAttempts,
          runAfter: input.runAfter,
          correlationId: input.correlationId,
        },
      ],
      skipDuplicates: true,
    });
    return created.count === 1 ? "queued" : "duplicate";
  }

  async claim(): Promise<ClaimedJob | null> {
    const rows = await this.prisma.$queryRaw<ClaimRow[]>`
      UPDATE operational_jobs
      SET status = 'processing',
          locked_at = NOW(),
          attempts = attempts + 1,
          updated_at = NOW()
      WHERE id = (
        SELECT id
        FROM operational_jobs
        WHERE status = 'pending'
          AND run_after <= NOW()
          AND attempts < max_attempts
        ORDER BY run_after
        FOR UPDATE SKIP LOCKED
        LIMIT 1
      )
      RETURNING id, name, attempts, max_attempts, payload, correlation_id, idempotency_key
    `;
    const row = rows[0];
    if (row === undefined) {
      return null;
    }
    return {
      id: row.id,
      name: row.name,
      attempts: row.attempts,
      maxAttempts: row.max_attempts,
      payload: row.payload,
      correlationId: row.correlation_id,
      idempotencyKey: row.idempotency_key,
    };
  }

  async complete(id: string): Promise<void> {
    await this.prisma.operationalJob.update({
      where: { id },
      data: { status: "completed", payload: {}, lastError: null, lockedAt: null },
    });
  }

  async retry(id: string, errorCode: string, runAfter: Date): Promise<void> {
    await this.prisma.operationalJob.update({
      where: { id },
      data: { status: "pending", lastError: errorCode, runAfter, lockedAt: null },
    });
  }

  async dead(id: string, errorCode: string): Promise<void> {
    await this.prisma.operationalJob.update({
      where: { id },
      data: { status: "dead", payload: {}, lastError: errorCode, lockedAt: null },
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
