import { describe, expect, it } from "vitest";
import type { ClaimedJob, JobRepository } from "@platform/database";
import { FakeEmailProvider } from "./email-provider";
import { EmailService } from "./email.service";
import { classify, JobWorker, retryDelayMs, type MaintenanceRunner } from "./job-worker";
import { JobError } from "./ops.tokens";

describe("job policy", () => {
  it("backs off and stops a permanent failure", () => {
    expect(retryDelayMs(1)).toBe(2_000);
    expect(retryDelayMs(20)).toBe(256_000);
    expect(classify(new JobError("EMAIL_REJECTED", true))).toEqual({
      code: "EMAIL_REJECTED",
      permanent: true,
    });
    expect(classify(new Error("network"))).toEqual({ code: "JOB_FAILED", permanent: false });
  });

  it("does not send a duplicate and does not keep the token after success", async () => {
    const jobs = new MemoryJobs();
    const provider = new FakeEmailProvider();
    const worker = workerFor(jobs, provider, { run: async () => undefined });
    const queued = await jobs.enqueue(emailJob("same-token"));
    expect(await jobs.enqueue(emailJob("same-token"))).toBe("duplicate");
    expect(queued).toBe("queued");
    expect(await worker.processAvailable()).toBe(1);
    expect(provider.sent).toHaveLength(1);
    expect(await worker.processAvailable()).toBe(0);
    expect(provider.sent).toHaveLength(1);
    expect(jobs.rows[0]?.payload).toEqual({});
    expect(jobs.rows[0]?.status).toBe("completed");
  });

  it("retries a transient failure and dead-letters a permanent one", async () => {
    const jobs = new MemoryJobs();
    const provider = new FakeEmailProvider();
    provider.fail = "transient";
    const worker = workerFor(jobs, provider, { run: async () => undefined });
    await jobs.enqueue({ ...emailJob("retry-token"), maxAttempts: 2 });
    expect(await worker.processAvailable()).toBe(1);
    expect(jobs.rows[0]?.status).toBe("pending");
    expect(jobs.rows[0]?.payload).toMatchObject({ token: "retry-token-value-1234567890" });
    const pending = jobs.rows[0];
    if (pending !== undefined) {
      pending.runAfter = new Date(0);
    }
    expect(await worker.processAvailable()).toBe(1);
    expect(jobs.rows[0]?.status).toBe("dead");
    expect(jobs.rows[0]?.payload).toEqual({});
    expect(provider.sent).toHaveLength(0);

    provider.fail = "permanent";
    await jobs.enqueue(emailJob("bad-token"));
    expect(await worker.processAvailable()).toBe(1);
    expect(jobs.rows[1]?.status).toBe("dead");
    expect(jobs.rows[1]?.lastError).toBe("EMAIL_REJECTED");
  });

  it("stops accepting work after shutdown", async () => {
    const jobs = new MemoryJobs();
    const worker = workerFor(jobs, new FakeEmailProvider(), { run: async () => undefined });
    worker.start(60_000);
    await worker.onApplicationShutdown();
    await jobs.enqueue(emailJob("after-stop"));
    expect(await worker.processAvailable()).toBe(0);
  });

  it("runs maintenance through the same worker", async () => {
    const jobs = new MemoryJobs();
    let ran = 0;
    const worker = workerFor(jobs, new FakeEmailProvider(), {
      run: async () => {
        ran += 1;
      },
    });
    await worker.ensureMaintenance(new Date("2026-10-07T10:15:00.000Z"));
    await worker.ensureMaintenance(new Date("2026-10-07T10:45:00.000Z"));
    expect(jobs.rows).toHaveLength(1);
    expect(await worker.processAvailable()).toBe(1);
    expect(ran).toBe(1);
  });
});

function workerFor(
  jobs: MemoryJobs,
  provider: FakeEmailProvider,
  maintenance: MaintenanceRunner,
): JobWorker {
  const email = new EmailService(provider, jobs, { publicUrl: "https://app.example.test" });
  return new JobWorker(jobs, email, maintenance);
}

function emailJob(token: string): Parameters<JobRepository["enqueue"]>[0] {
  return {
    name: "send_email",
    idempotencyKey: `verification:${token}`,
    payload: {
      template: "verification",
      to: "ada@example.com",
      token: `${token}-value-1234567890`,
    },
    correlationId: "job-test",
    maxAttempts: 5,
    runAfter: new Date(0),
  };
}

class MemoryJobs implements JobRepository {
  readonly rows: Array<{
    id: string;
    name: string;
    idempotencyKey: string;
    payload: unknown;
    status: string;
    attempts: number;
    maxAttempts: number;
    runAfter: Date;
    lastError: string | null;
    correlationId: string | null;
  }> = [];

  async enqueue(input: Parameters<JobRepository["enqueue"]>[0]): Promise<"queued" | "duplicate"> {
    if (
      this.rows.some(
        (row) => row.name === input.name && row.idempotencyKey === input.idempotencyKey,
      )
    ) {
      return "duplicate";
    }
    this.rows.push({
      id: `job-${this.rows.length + 1}`,
      name: input.name,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload,
      status: "pending",
      attempts: 0,
      maxAttempts: input.maxAttempts,
      runAfter: input.runAfter,
      lastError: null,
      correlationId: input.correlationId,
    });
    return "queued";
  }

  async claim(): Promise<ClaimedJob | null> {
    const row = this.rows.find(
      (candidate) =>
        candidate.status === "pending" &&
        candidate.attempts < candidate.maxAttempts &&
        candidate.runAfter.getTime() <= Date.now(),
    );
    if (row === undefined) {
      return null;
    }
    row.status = "processing";
    row.attempts += 1;
    return {
      id: row.id,
      name: row.name,
      attempts: row.attempts,
      maxAttempts: row.maxAttempts,
      payload: row.payload,
      correlationId: row.correlationId,
      idempotencyKey: row.idempotencyKey,
    };
  }

  async complete(id: string): Promise<void> {
    const row = this.required(id);
    row.status = "completed";
    row.payload = {};
    row.lastError = null;
  }

  async retry(id: string, errorCode: string, runAfter: Date): Promise<void> {
    const row = this.required(id);
    row.status = "pending";
    row.lastError = errorCode;
    row.runAfter = runAfter;
  }

  async dead(id: string, errorCode: string): Promise<void> {
    const row = this.required(id);
    row.status = "dead";
    row.payload = {};
    row.lastError = errorCode;
  }

  async disconnect(): Promise<void> {
    return undefined;
  }

  private required(id: string) {
    const row = this.rows.find((candidate) => candidate.id === id);
    if (row === undefined) {
      throw new Error("missing job");
    }
    return row;
  }
}
