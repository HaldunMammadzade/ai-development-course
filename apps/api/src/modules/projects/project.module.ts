import { Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfigError, type ExecutionEnv } from "@platform/config";
import {
  createProjectRepository,
  type NewProjectAttempt,
  type ProjectRepository,
} from "@platform/database";
import { FakeCodeExecutionRunner, type CodeExecutionRunner } from "@platform/execution";
import type { ProjectAttemptView } from "@platform/types";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { HttpCodeExecutionRunner } from "../execution/http-runner";
import { CODE_EXECUTION_RUNNER } from "../execution/execution.tokens";
import { ProjectController } from "./project.controller";
import { ProjectService } from "./project.service";
import { PROJECT_REPOSITORY } from "./project.tokens";

@Injectable()
class ProjectRepositoryLifecycle implements OnModuleDestroy {
  constructor(@Inject(PROJECT_REPOSITORY) private readonly repository: ProjectRepository) {}

  async onModuleDestroy(): Promise<void> {
    await this.repository.disconnect();
  }
}

@Module({
  imports: [AuthModule, AiModule],
  controllers: [ProjectController],
  providers: [
    ProjectService,
    {
      provide: PROJECT_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ProjectRepository => {
        const databaseUrl = config.get<string | null>("databaseUrl");
        if (databaseUrl === undefined || databaseUrl === null || databaseUrl.length === 0) {
          return unavailableProjectRepository();
        }
        return createProjectRepository(databaseUrl);
      },
    },
    ProjectRepositoryLifecycle,
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
export class ProjectModule {}

function unavailableProjectRepository(): ProjectRepository {
  const fail = (): Promise<never> => {
    return Promise.reject(new ConfigError("DATABASE_URL is required to use projects."));
  };
  return {
    list: fail,
    open: fail,
    prepareExecution: fail,
    executionPending: fail,
    releaseExecution: fail,
    findClientAttempt: fail,
    submit: fail as (input: NewProjectAttempt) => Promise<ProjectAttemptView>,
    listAttempts: fail,
    prepareReview: fail,
    findReview: fail,
    completeReview: fail,
    releaseReview: fail,
    recordReviewUsage: fail,
    savePlan: fail,
    savePlanReview: fail,
    countRecentUsage: fail,
    learningSignal: fail,
    disconnect: () => Promise.resolve(),
  };
}
