import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { loadAiEnv, loadApiEnv, loadEmailEnv, loadTranscriptionEnv } from "@platform/config";
import { AiModule } from "./modules/ai/ai.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { ExerciseModule } from "./modules/exercises/exercise.module";
import { InterviewModule } from "./modules/interviews/interview.module";
import { BillingModule } from "./modules/billing/billing.module";
import { SpeakingModule } from "./modules/speaking/speaking.module";
import { ProjectModule } from "./modules/projects/project.module";
import { AssessmentModule } from "./modules/assessment/assessment.module";
import { LearningModule } from "./modules/learning/learning.module";
import { TeachingModule } from "./modules/teaching/teaching.module";
import { AdminModule } from "./modules/admin/admin.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ["../../.env", ".env"],
      validate: (config: Record<string, unknown>) => {
        const api = loadApiEnv(config);
        const ai = loadAiEnv(config);
        const email = loadEmailEnv(config);
        const transcription = loadTranscriptionEnv(config);
        return {
          ...api,
          ...(ai === null ? {} : { ai }),
          ...(email === null ? {} : { email }),
          ...(transcription === null ? {} : { transcription }),
        };
      },
    }),
    HealthModule,
    AuthModule,
    AiModule,
    LearningModule,
    AssessmentModule,
    ExerciseModule,
    ProjectModule,
    InterviewModule,
    SpeakingModule,
    BillingModule,
    TeachingModule,
    AdminModule,
  ],
})
export class AppModule {}
