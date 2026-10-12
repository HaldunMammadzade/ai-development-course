import { Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfigError } from "@platform/config";
import { createTeachingRepository, type TeachingRepository } from "@platform/database";
import type {
  HomeworkCompletionResponse,
  HomeworkListResponse,
  TeachingOpenResponse,
  TeachingSessionView,
  TeachingTurnResponse,
} from "@platform/types";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { TeachingHomeworkController } from "./teaching-homework.controller";
import { TeachingController } from "./teaching.controller";
import { TeachingOrchestrator } from "./teaching.orchestrator";
import {
  TEACHING_CLOCK,
  TEACHING_MONOTONIC,
  TEACHING_REPOSITORY,
  type TeachingClock,
} from "./teaching.tokens";

@Injectable()
class TeachingRepositoryLifecycle implements OnModuleDestroy {
  constructor(@Inject(TEACHING_REPOSITORY) private readonly repository: TeachingRepository) {}

  async onModuleDestroy(): Promise<void> {
    await this.repository.disconnect();
  }
}

@Module({
  imports: [AuthModule, AiModule],
  controllers: [TeachingController, TeachingHomeworkController],
  providers: [
    TeachingOrchestrator,
    {
      provide: TEACHING_CLOCK,
      useValue: { now: () => new Date() } satisfies TeachingClock,
    },
    {
      provide: TEACHING_MONOTONIC,
      useValue: () => performance.now(),
    },
    {
      provide: TEACHING_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): TeachingRepository => {
        const databaseUrl = config.get<string | null>("databaseUrl");
        if (databaseUrl === undefined || databaseUrl === null || databaseUrl.length === 0) {
          return unavailableTeachingRepository();
        }
        return createTeachingRepository(databaseUrl);
      },
    },
    TeachingRepositoryLifecycle,
  ],
})
export class TeachingModule {}

function unavailableTeachingRepository(): TeachingRepository {
  const fail = (): Promise<never> => {
    return Promise.reject(new ConfigError("DATABASE_URL is required to use teaching."));
  };
  return {
    openSession: fail as () => Promise<TeachingOpenResponse>,
    getSession: fail as () => Promise<TeachingSessionView>,
    abandonSession: fail as () => Promise<TeachingSessionView>,
    listHomework: fail as () => Promise<HomeworkListResponse>,
    completeHomework: fail as () => Promise<HomeworkCompletionResponse>,
    prepareTurn: fail,
    readClaim: fail,
    commitTurn: fail as () => Promise<TeachingTurnResponse>,
    failTurn: fail as () => Promise<void>,
    disconnect: () => Promise.resolve(),
  };
}
