import { Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfigError, type ExecutionEnv } from "@platform/config";
import {
  createExerciseRepository,
  type ExerciseRepository,
  type NewExerciseAttempt,
} from "@platform/database";
import { FakeCodeExecutionRunner, type CodeExecutionRunner } from "@platform/execution";
import type { ExerciseAttemptView } from "@platform/types";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { HttpCodeExecutionRunner } from "../execution/http-runner";
import { CODE_EXECUTION_RUNNER } from "../execution/execution.tokens";
import { ExerciseController, LessonExerciseController } from "./exercise.controller";
import { ExerciseService } from "./exercise.service";
import { EXERCISE_REPOSITORY } from "./exercise.tokens";

@Injectable()
class ExerciseRepositoryLifecycle implements OnModuleDestroy {
  constructor(@Inject(EXERCISE_REPOSITORY) private readonly repository: ExerciseRepository) {}

  async onModuleDestroy(): Promise<void> {
    await this.repository.disconnect();
  }
}

@Module({
  imports: [AuthModule, AiModule],
  controllers: [ExerciseController, LessonExerciseController],
  providers: [
    ExerciseService,
    {
      provide: EXERCISE_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ExerciseRepository => {
        const databaseUrl = config.get<string | null>("databaseUrl");
        if (databaseUrl === undefined || databaseUrl === null || databaseUrl.length === 0) {
          return unavailableExerciseRepository();
        }
        return createExerciseRepository(databaseUrl);
      },
    },
    ExerciseRepositoryLifecycle,
    {
      provide: CODE_EXECUTION_RUNNER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): CodeExecutionRunner => {
        const execution = config.get<ExecutionEnv>("execution");
        if (execution?.mode === "fake") {
          return new FakeCodeExecutionRunner();
        }
        if (
          execution === undefined ||
          execution.runnerUrl === null ||
          execution.runnerToken === null
        ) {
          return {
            execute: () => Promise.resolve({ status: "runner_error", tests: [], durationMs: 0 }),
          };
        }
        return new HttpCodeExecutionRunner(execution.runnerUrl, execution.runnerToken);
      },
    },
  ],
})
export class ExerciseModule {}

function unavailableExerciseRepository(): ExerciseRepository {
  const fail = (): Promise<never> => {
    return Promise.reject(new ConfigError("DATABASE_URL is required to use exercises."));
  };
  return {
    findById: fail,
    listPublishedForLesson: fail,
    latestOutcomes: fail,
    prepareExecution: fail,
    executionPending: fail,
    releaseExecution: fail,
    findClientAttempt: fail,
    submit: fail as (input: NewExerciseAttempt) => Promise<ExerciseAttemptView>,
    listAttempts: fail,
    prepareCodeReview: fail,
    findCodeReview: fail,
    completeCodeReview: fail,
    releaseCodeReview: fail,
    recordCodeReviewUsage: fail,
    disconnect: () => Promise.resolve(),
  };
}
