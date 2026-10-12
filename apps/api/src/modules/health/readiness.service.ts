import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { createPlatformPrisma, type PrismaClient } from "@platform/database";

@Injectable()
export class ReadinessService implements OnModuleDestroy {
  private readonly logger = new Logger(ReadinessService.name);
  private readonly prisma: PrismaClient | null;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    this.prisma =
      databaseUrl === undefined || databaseUrl.length === 0
        ? null
        : createPlatformPrisma(databaseUrl);
  }

  async check(): Promise<boolean> {
    if (this.prisma === null) {
      return false;
    }
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      this.logger.warn(JSON.stringify({ event: "readiness", code: "DATABASE_UNAVAILABLE" }));
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.prisma?.$disconnect();
  }
}
