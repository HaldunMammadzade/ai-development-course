import { Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ConfigError, type ExecutionEnv } from "@platform/config";
import {
  createInterviewRepository,
  type InterviewBegin,
  type InterviewFinish,
  type InterviewRepository,
} from "@platform/database";
import { FakeCodeExecutionRunner, type CodeExecutionRunner } from "@platform/execution";
import type {
  InterviewDetail,
  InterviewReportView,
  InterviewSessionView,
  InterviewSummary,
} from "@platform/types";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { CODE_EXECUTION_RUNNER } from "../execution/execution.tokens";
import { HttpCodeExecutionRunner } from "../execution/http-runner";
import { InterviewController } from "./interview.controller";
import { InterviewService } from "./interview.service";
import { INTERVIEW_REPOSITORY } from "./interview.tokens";

@Injectable()
class InterviewRepositoryLifecycle implements OnModuleDestroy {
  constructor(@Inject(INTERVIEW_REPOSITORY) private readonly repository: InterviewRepository) {}

  async onModuleDestroy(): Promise<void> {
    await this.repository.disconnect();
  }
}

@Module({
  imports: [AuthModule, AiModule],
  controllers: [InterviewController],
  providers: [
    InterviewService,
    {
      provide: INTERVIEW_REPOSITORY,
      inject: [ConfigService],
      useFactory: (config: ConfigService): InterviewRepository => {
        const databaseUrl = config.get<string | null>("databaseUrl");
        if (databaseUrl === undefined || databaseUrl === null || databaseUrl.length === 0) {
          return unavailableInterviewRepository();
        }
        return createInterviewRepository(databaseUrl);
      },
    },
    InterviewRepositoryLifecycle,
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
export class InterviewModule {}

function unavailableInterviewRepository(): InterviewRepository {
  const fail = (): Promise<never> => {
    return Promise.reject(new ConfigError("DATABASE_URL is required to use interviews."));
  };
  return {
    list: fail as () => Promise<InterviewSummary[]>,
    open: fail as (userId: string, slug: string) => Promise<InterviewDetail | null>,
    start: fail as (userId: string, slug: string, now: Date) => Promise<InterviewSessionView>,
    getSession: fail as (userId: string, sessionId: string) => Promise<InterviewSessionView | null>,
    report: fail as (userId: string, sessionId: string) => Promise<InterviewReportView | null>,
    abandon: fail as (userId: string, sessionId: string) => Promise<InterviewSessionView>,
    beginAnswer: fail as () => Promise<InterviewBegin>,
    releaseAnswer: fail,
    finishAnswer: fail as (input: InterviewFinish) => Promise<InterviewSessionView>,
    prepareExecution: fail as () => Promise<"claimed" | "busy">,
    releaseExecution: fail,
    findCompleted: fail as () => Promise<InterviewSessionView | null>,
    isPending: fail as () => Promise<boolean>,
    disconnect: () => Promise.resolve(),
  };
}
