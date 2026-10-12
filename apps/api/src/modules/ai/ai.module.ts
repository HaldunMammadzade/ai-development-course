import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DisabledAiProvider,
  OpenAiCompatibleProvider,
  createModelRouter,
  type AIProvider,
  type ModelRouter,
} from "@platform/ai";
import type { AiServerConfig } from "@platform/config";

export const AI_PROVIDER = Symbol("AI_PROVIDER");
export const MODEL_ROUTER = Symbol("MODEL_ROUTER");

@Module({
  providers: [
    {
      provide: MODEL_ROUTER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): ModelRouter => {
        const ai = config.get<AiServerConfig | undefined>("ai");
        if (ai === undefined) {
          return createModelRouter(null);
        }
        const teach = {
          provider: ai.provider,
          model: ai.teachModel,
          maxInputChars: ai.maxInputChars,
          maxOutputTokens: ai.maxOutputTokens,
        };
        const review = { ...teach, model: ai.reviewModel };
        return createModelRouter(teach, review, review, review);
      },
    },
    {
      provide: AI_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AIProvider => {
        const ai = config.get<AiServerConfig | undefined>("ai");
        if (ai === undefined) {
          return new DisabledAiProvider();
        }
        return new OpenAiCompatibleProvider({
          id: ai.provider,
          apiKey: ai.apiKey,
          baseUrl: ai.baseUrl,
        });
      },
    },
  ],
  exports: [MODEL_ROUTER, AI_PROVIDER],
})
export class AiModule {}
