import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfigError } from "@platform/config";
import { createProgressRepository } from "@platform/database";
import { PROGRESS_REPOSITORY } from "./progress.repository";
import { ProgressService } from "./progress.service";

@Module({
  providers: [
    ProgressService,
    {
      provide: PROGRESS_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string | null>("databaseUrl");
        if (databaseUrl === undefined || databaseUrl === null || databaseUrl.length === 0) {
          throw new ConfigError("DATABASE_URL is required to use progress.");
        }
        return createProgressRepository(databaseUrl);
      },
    },
  ],
  exports: [ProgressService],
})
export class ProgressModule {}
