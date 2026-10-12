import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfigError } from "@platform/config";
import { createCurriculumRepository } from "@platform/database";
import { CURRICULUM_REPOSITORY } from "./curriculum.repository";
import { CurriculumService } from "./curriculum.service";

@Module({
  providers: [
    CurriculumService,
    {
      provide: CURRICULUM_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string | null>("databaseUrl");
        if (databaseUrl === undefined || databaseUrl === null || databaseUrl.length === 0) {
          throw new ConfigError("DATABASE_URL is required to use curriculum.");
        }
        return createCurriculumRepository(databaseUrl);
      },
    },
  ],
  exports: [CurriculumService],
})
export class CurriculumModule {}
