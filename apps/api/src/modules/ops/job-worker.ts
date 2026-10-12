import { Inject, Injectable, Logger, type OnApplicationShutdown } from "@nestjs/common";
import { runOperationalCleanup, type JobRepository, type PrismaClient } from "@platform/database";
import { EmailService } from "./email.service";
import { JOB_REPOSITORY, JobError } from "./ops.tokens";

export const MAINTENANCE = Symbol("MAINTENANCE");

export interface MaintenanceRunner {
  run(now: Date): Promise<void>;
}

export function retryDelayMs(attempt: number): number {
  const shift = Math.min(Math.max(attempt, 1), 8);
  return Math.min(1_000 * 2 ** shift, 15 * 60 * 1000);
}

@Injectable()
export class JobWorker implements OnApplicationShutdown {
  private readonly logger = new Logger(JobWorker.name);
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopping = false;
  private active: Promise<void> | null = null;

  constructor(
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(MAINTENANCE) private readonly maintenance: MaintenanceRunner,
  ) {}

  start(intervalMs = 15_000): void {
    if (this.timer !== null) {
      return;
    }
    this.timer = setInterval(() => {
      void this.processAvailable();
    }, intervalMs);
    this.timer.unref?.();
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.active !== null) {
      await Promise.race([
        this.active,
        new Promise<void>((resolve) => {
          setTimeout(resolve, 5_000);
        }),
      ]);
    }
  }

  async ensureMaintenance(now = new Date()): Promise<void> {
    const hour = now.toISOString().slice(0, 13);
    await this.jobs.enqueue({
      name: "maintenance",
      idempotencyKey: `maintenance:${hour}`,
      payload: {},
      correlationId: null,
      maxAttempts: 3,
      runAfter: now,
    });
  }

  async processAvailable(limit = 10): Promise<number> {
    let handled = 0;
    for (let index = 0; index < limit; index += 1) {
      if (this.stopping) {
        break;
      }
      const outcome = await this.processOne();
      if (outcome === "idle") {
        break;
      }
      handled += 1;
    }
    return handled;
  }

  private async processOne(): Promise<"idle" | "completed" | "retry" | "dead"> {
    const job = await this.jobs.claim();
    if (job === null) {
      return "idle";
    }
    const started = Date.now();
    const run = this.execute(job.name, job.payload, job.idempotencyKey);
    this.active = run;
    try {
      await run;
      await this.jobs.complete(job.id);
      this.log(job.name, job.attempts, "completed", Date.now() - started, job.correlationId, null);
      return "completed";
    } catch (error) {
      const failure = classify(error);
      const stop = failure.permanent || job.attempts >= job.maxAttempts;
      if (stop) {
        await this.jobs.dead(job.id, failure.code);
        this.log(
          job.name,
          job.attempts,
          "dead",
          Date.now() - started,
          job.correlationId,
          failure.code,
        );
        return "dead";
      }
      await this.jobs.retry(
        job.id,
        failure.code,
        new Date(Date.now() + retryDelayMs(job.attempts)),
      );
      this.log(
        job.name,
        job.attempts,
        "retry",
        Date.now() - started,
        job.correlationId,
        failure.code,
      );
      return "retry";
    } finally {
      if (this.active === run) {
        this.active = null;
      }
    }
  }

  private async execute(name: string, payload: unknown, idempotencyKey: string): Promise<void> {
    if (name === "send_email") {
      await this.email.deliver({ payload, idempotencyKey });
      return;
    }
    if (name === "maintenance") {
      await this.maintenance.run(new Date());
      return;
    }
    throw new JobError("JOB_UNKNOWN", true);
  }

  private log(
    name: string,
    attempt: number,
    status: string,
    durationMs: number,
    correlationId: string | null,
    error: string | null,
  ): void {
    this.logger.log(
      JSON.stringify({
        event: "job",
        job: name,
        attempt,
        status,
        durationMs,
        correlationId,
        error,
      }),
    );
  }
}

export function classify(error: unknown): { code: string; permanent: boolean } {
  if (error instanceof JobError) {
    return { code: error.code, permanent: error.permanent };
  }
  return { code: "JOB_FAILED", permanent: false };
}

export function createMaintenanceRunner(prisma: PrismaClient | null): MaintenanceRunner {
  return {
    async run(now: Date): Promise<void> {
      if (prisma === null) {
        throw new JobError("DATABASE_UNAVAILABLE", true);
      }
      await runOperationalCleanup(prisma, now);
    },
  };
}
