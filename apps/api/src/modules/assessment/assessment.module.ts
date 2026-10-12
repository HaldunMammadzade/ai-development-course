import { Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfigError } from "@platform/config";
import { createAssessmentRepository, type AssessmentRepository } from "@platform/database";
import { AuthModule } from "../auth/auth.module";
import { AssessmentController } from "./assessment.controller";
import { AssessmentService } from "./assessment.service";
import { ASSESSMENT_REPOSITORY } from "./assessment.tokens";

@Injectable()
class AssessmentRepositoryLifecycle implements OnModuleDestroy {
  constructor(@Inject(ASSESSMENT_REPOSITORY) private readonly repository: AssessmentRepository) {}

  async onModuleDestroy(): Promise<void> {
    await this.repository.disconnect();
  }
}

@Module({
  imports: [AuthModule],
  controllers: [AssessmentController],
  providers: [
    AssessmentService,
    {
      provide: ASSESSMENT_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AssessmentRepository => {
        const databaseUrl = config.get<string | null>("databaseUrl");
        if (databaseUrl === undefined || databaseUrl === null || databaseUrl.length === 0) {
          return unavailable();
        }
        return createAssessmentRepository(databaseUrl);
      },
    },
    AssessmentRepositoryLifecycle,
  ],
})
export class AssessmentModule {}

function unavailable(): AssessmentRepository {
  const fail = (): Promise<never> =>
    Promise.reject(new ConfigError("DATABASE_URL is required to use assessment."));
  return {
    availability: fail,
    begin: fail,
    skip: fail,
    answer: fail,
    disconnect: () => Promise.resolve(),
  };
}
