import { Inject, Injectable, Module, type OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { type TranscriptionConfig } from "@platform/config";
import { DisabledSpeechToTextProvider, HttpSpeechToTextProvider } from "@platform/ai";
import { createSpeakingRepository, type SpeakingRepository } from "@platform/database";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { SpeakingController } from "./speaking.controller";
import { SpeakingService } from "./speaking.service";
import { SPEAKING_REPOSITORY, SPEECH_TO_TEXT } from "./speaking.tokens";

@Injectable()
class SpeakingRepositoryLifecycle implements OnModuleDestroy {
  constructor(@Inject(SPEAKING_REPOSITORY) private readonly repository: SpeakingRepository) {}

  async onModuleDestroy(): Promise<void> {
    await this.repository.disconnect();
  }
}

@Module({
  imports: [AuthModule, AiModule],
  controllers: [SpeakingController],
  providers: [
    SpeakingService,
    {
      provide: SPEAKING_REPOSITORY,
      useFactory: () => {
        const databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl === undefined || databaseUrl.length === 0) {
          return unavailableRepository();
        }
        return createSpeakingRepository(databaseUrl);
      },
    },
    {
      provide: SPEECH_TO_TEXT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const transcription = config.get<TranscriptionConfig>("transcription");
        return transcription === undefined
          ? new DisabledSpeechToTextProvider()
          : new HttpSpeechToTextProvider(transcription);
      },
    },
    SpeakingRepositoryLifecycle,
  ],
})
export class SpeakingModule {}

function unavailableRepository(): SpeakingRepository {
  const fail = async () => {
    throw new Error("Speaking storage is not configured.");
  };
  return {
    practice: fail,
    start: fail,
    getSession: async () => null,
    abandon: fail,
    beginAttempt: fail,
    releaseAttempt: async () => undefined,
    saveTranscript: async () => undefined,
    markEvaluationFailed: async () => undefined,
    markUnclear: fail,
    recordTranscription: async () => undefined,
    finishAttempt: fail,
    disconnect: async () => undefined,
  };
}
