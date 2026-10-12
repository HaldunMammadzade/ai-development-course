import {
  Inject,
  Injectable,
  Module,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfigError, type EmailConfig } from "@platform/config";
import {
  createJobRepository,
  createPlatformPrisma,
  type JobRepository,
  type PrismaClient,
} from "@platform/database";
import { DisabledEmailProvider, FakeEmailProvider, type EmailProvider } from "./email-provider";
import { EMAIL_RUNTIME, EmailService, type EmailRuntime } from "./email.service";
import { HttpEmailProvider } from "./http-email";
import { ResendEmailProvider } from "./resend-email";
import { createMaintenanceRunner, JobWorker, MAINTENANCE } from "./job-worker";
import { EMAIL_PROVIDER, JOB_REPOSITORY } from "./ops.tokens";

const MAINTENANCE_PRISMA = Symbol("MAINTENANCE_PRISMA");

@Injectable()
class JobRepositoryLifecycle implements OnModuleDestroy {
  constructor(@Inject(JOB_REPOSITORY) private readonly jobs: JobRepository) {}

  async onModuleDestroy(): Promise<void> {
    await this.jobs.disconnect();
  }
}

@Injectable()
class MaintenanceLifecycle implements OnModuleDestroy, OnApplicationBootstrap {
  constructor(
    @Inject(MAINTENANCE_PRISMA) private readonly prisma: PrismaClient | null,
    @Inject(JobWorker) private readonly worker: JobWorker,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.NODE_ENV === "test" || this.prisma === null) {
      return;
    }
    this.worker.start();
    await this.worker.ensureMaintenance();
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma?.$disconnect();
  }
}

@Module({
  providers: [
    EmailService,
    JobWorker,
    {
      provide: EMAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EmailProvider =>
        createEmailProvider(config.get<EmailConfig>("email") ?? null),
    },
    {
      provide: EMAIL_RUNTIME,
      inject: [ConfigService],
      useFactory: (config: ConfigService): EmailRuntime => ({
        publicUrl: config.get<EmailConfig>("email")?.publicUrl ?? "http://127.0.0.1:3000",
      }),
    },
    {
      provide: JOB_REPOSITORY,
      useFactory: (): JobRepository => {
        const databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl === undefined || databaseUrl.length === 0) {
          return unavailableJobs();
        }
        return createJobRepository(databaseUrl);
      },
    },
    {
      provide: MAINTENANCE_PRISMA,
      useFactory: (): PrismaClient | null => {
        const databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl === undefined || databaseUrl.length === 0) {
          return null;
        }
        return createPlatformPrisma(databaseUrl);
      },
    },
    {
      provide: MAINTENANCE,
      inject: [MAINTENANCE_PRISMA],
      useFactory: (prisma: PrismaClient | null) => createMaintenanceRunner(prisma),
    },
    JobRepositoryLifecycle,
    MaintenanceLifecycle,
  ],
  exports: [EmailService, JobWorker],
})
export class OpsModule {}

function createEmailProvider(config: EmailConfig | null): EmailProvider {
  if (config === null) {
    return new DisabledEmailProvider();
  }
  if (config.provider === "fake") {
    if (process.env.NODE_ENV === "production") {
      throw new ConfigError("EMAIL_PROVIDER is not allowed in production.");
    }
    return new FakeEmailProvider();
  }
  if (config.provider === "resend") {
    return new ResendEmailProvider(config);
  }
  return new HttpEmailProvider(config);
}

function unavailableJobs(): JobRepository {
  const fail = async (): Promise<never> => {
    throw new ConfigError("DATABASE_URL is required for jobs.");
  };
  return {
    enqueue: fail,
    claim: async () => null,
    complete: fail,
    retry: fail,
    dead: fail,
    disconnect: async () => undefined,
  };
}
