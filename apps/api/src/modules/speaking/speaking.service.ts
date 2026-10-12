import { randomUUID } from "node:crypto";
import { HttpException, Inject, Injectable, Logger } from "@nestjs/common";
import {
  AIProviderError,
  AiConfigurationError,
  AiTaskUnavailableError,
  type AIProvider,
  type AIResponse,
  type ModelRouter,
  type NormalizedSpeaking,
  type SpeechToTextProvider,
  normalizeSpeakingOutput,
  recordAiUsage,
  renderSpeakingPrompt,
  SpeechUnavailableError,
} from "@platform/ai";
import { speakingHiddenLiterals, transcriptQuality } from "@platform/curriculum";
import {
  SpeakingRuleError,
  type SpeakingBegin,
  type SpeakingRepository,
  type SpeakingTurnContext,
} from "@platform/database";
import type { SpeakingSessionView } from "@platform/types";
import { AI_PROVIDER, MODEL_ROUTER } from "../ai/ai.module";
import { aiFailureLogSuffix } from "../ai/ai-failure-log";
import { speakingLogLine, speakingUsageCorrelation } from "./speaking-log";
import { SPEAKING_REPOSITORY, SPEECH_TO_TEXT } from "./speaking.tokens";

@Injectable()
export class SpeakingService {
  private readonly logger = new Logger(SpeakingService.name);

  constructor(
    @Inject(SPEAKING_REPOSITORY) private readonly speaking: SpeakingRepository,
    @Inject(SPEECH_TO_TEXT) private readonly speech: SpeechToTextProvider,
    @Inject(MODEL_ROUTER) private readonly router: ModelRouter,
    @Inject(AI_PROVIDER) private readonly ai: AIProvider,
  ) {}

  practice(userId: string) {
    return this.speaking.practice(userId);
  }

  start(userId: string, mode: "lesson" | "interview"): Promise<SpeakingSessionView> {
    return this.guard(() => this.speaking.start({ userId, mode, now: new Date() }));
  }

  session(userId: string, sessionId: string): Promise<SpeakingSessionView> {
    return this.guard(async () => {
      const session = await this.speaking.getSession(userId, sessionId);
      if (session === null) {
        throw new SpeakingRuleError(404, "NOT_FOUND", "That speaking practice was not found.");
      }
      return session;
    });
  }

  abandon(userId: string, sessionId: string): Promise<SpeakingSessionView> {
    return this.guard(() => this.speaking.abandon({ userId, sessionId, now: new Date() }));
  }

  async answer(
    userId: string,
    sessionId: string,
    input: {
      clientAttemptId: string;
      text: string | null;
      audio: {
        bytes: Uint8Array;
        mediaType: "audio/webm" | "audio/ogg" | "audio/wav" | "audio/mp4" | "audio/mpeg";
        durationMs: number | null;
      } | null;
    },
  ): Promise<SpeakingSessionView> {
    const started = Date.now();
    const correlationId = randomUUID();
    const begun = await this.claim(userId, sessionId, input.clientAttemptId, input.audio !== null);
    if (begun.kind === "stored") {
      return begun.view;
    }
    const attemptId = begun.attemptId;
    const context = begun.context;
    let transcript = begun.kind === "resume" ? begun.transcript : (input.text ?? "");
    try {
      if (begun.kind === "ready" && input.audio !== null) {
        let transcribed;
        try {
          transcribed = await this.speech.transcribe({
            bytes: input.audio.bytes,
            mediaType: input.audio.mediaType,
          });
        } catch (error) {
          if (error instanceof SpeechUnavailableError) {
            throw new SpeechFailure(error);
          }
          throw error;
        }
        transcript = transcribed.text.slice(0, 6_000);
        await this.speaking.saveTranscript(attemptId, transcript);
        await this.speaking.recordTranscription(userId, {
          provider: transcribed.provider,
          model: transcribed.model,
          durationMs: input.audio.durationMs,
          latencyMs: transcribed.latencyMs,
          costMicros: transcribed.costMicros,
          correlationId,
          speakingAttemptId: attemptId,
        });
      } else if (begun.kind === "ready") {
        await this.speaking.saveTranscript(attemptId, transcript);
      }
      if (transcriptQuality(transcript) === "unclear") {
        const view = await this.speaking.markUnclear({
          userId,
          sessionId,
          attemptId,
          transcript,
          now: new Date(),
        });
        this.logger.log(
          speakingLogLine({
            correlationId,
            speakingAttemptId: attemptId,
            status: "unclear",
            durationMs: Date.now() - started,
          }),
        );
        return view;
      }
      const evaluated = await this.evaluate(context, transcript, correlationId);
      const view = await this.speaking.finishAttempt({
        userId,
        sessionId,
        attemptId,
        transcript,
        understanding: evaluated.normalized.understanding,
        speech: evaluated.normalized.speech,
        feedback: evaluated.normalized.feedback,
        strengths: evaluated.normalized.strengths,
        issues: evaluated.normalized.issues,
        now: new Date(),
        timeZone: context.timeZone,
        usage: {
          provider: evaluated.usage.provider,
          model: evaluated.usage.model,
          inputTokens: evaluated.usage.inputTokens,
          outputTokens: evaluated.usage.outputTokens,
          costMicros: evaluated.usage.estimatedCostMicros,
          latencyMs: evaluated.usage.latencyMs,
          correlationId: evaluated.usage.correlationId,
          speakingAttemptId: attemptId,
          taskType: evaluated.usage.task === "interview" ? "interview" : "teach",
        },
      });
      this.logger.log(
        speakingLogLine({
          correlationId,
          speakingAttemptId: attemptId,
          status: evaluated.scripted ? "scripted" : "completed",
          durationMs: Date.now() - started,
        }),
      );
      return view;
    } catch (error) {
      if (error instanceof SpeechFailure) {
        await this.speaking.releaseAttempt(attemptId);
        this.logger.log(
          speakingLogLine({
            correlationId,
            speakingAttemptId: attemptId,
            status: "speech-unavailable",
            durationMs: Date.now() - started,
            detail: aiFailureLogSuffix(error.failure),
          }),
        );
        throw speechUnavailable();
      }
      if (error instanceof HttpException) {
        throw error;
      }
      if (
        error instanceof AIProviderError ||
        error instanceof AiConfigurationError ||
        error instanceof AiTaskUnavailableError
      ) {
        await this.speaking.markEvaluationFailed(attemptId);
        this.logger.log(
          speakingLogLine({
            correlationId,
            speakingAttemptId: attemptId,
            status: "ai-unavailable",
            durationMs: Date.now() - started,
            detail: aiFailureLogSuffix(error),
          }),
        );
        throw aiUnavailable();
      }
      throw error;
    }
  }

  private async claim(
    userId: string,
    sessionId: string,
    clientAttemptId: string,
    audio: boolean,
  ): Promise<Exclude<SpeakingBegin, { kind: "wait" }>> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const begun = await this.guard(() =>
        this.speaking.beginAttempt({
          userId,
          sessionId,
          clientAttemptId,
          now: new Date(),
          audio,
        }),
      );
      if (begun.kind !== "wait") {
        return begun;
      }
      await delay(200);
    }
    throw new HttpException(
      { code: "SPEAKING_BUSY", message: "That answer is already being checked." },
      409,
    );
  }

  private async evaluate(
    context: SpeakingTurnContext,
    transcript: string,
    correlationId: string,
  ): Promise<{
    normalized: NormalizedSpeaking;
    usage: ReturnType<typeof recordAiUsage>;
    scripted: boolean;
  }> {
    const prompt = renderSpeakingPrompt({
      mode: context.mode,
      questionTitle: context.questionTitle,
      questionPrompt: context.questionPrompt,
      conceptName: context.conceptName,
      transcript,
      priorAnswers: context.priorAnswers,
      masteryBand: context.masteryBand,
      misconception: context.misconception,
      locale: context.locale,
    });
    const scope = { forbiddenLiterals: speakingHiddenLiterals(), transcript };
    const task = context.mode === "interview" ? "interview" : "teach";
    try {
      const route = this.router.resolve(task);
      const response = await this.ai.complete({
        model: {
          provider: route.provider,
          model: route.model,
          maxOutputTokens: route.maxOutputTokens,
          temperature: route.temperature,
          timeoutMs: route.timeoutMs,
          maxInputChars: route.maxInputChars,
        },
        system: prompt.system,
        user: prompt.user,
        schemaName: "SpeakingResult",
      });
      return {
        normalized: normalizeSpeakingOutput(response.json, scope),
        scripted: false,
        usage: usageFrom(response, route, task, correlationId),
      };
    } catch (error) {
      if (!(error instanceof AiConfigurationError) || process.env.NODE_ENV !== "development") {
        throw error;
      }
      const normalized = normalizeSpeakingOutput(scriptedSpeaking(transcript), scope);
      return {
        normalized,
        scripted: true,
        usage: recordAiUsage({
          userId: null,
          task,
          provider: "scripted",
          model: "speaking-scripted",
          inputTokens: 0,
          outputTokens: 0,
          inputMicrosPerMillion: 150_000,
          outputMicrosPerMillion: 600_000,
          cached: false,
          latencyMs: 1,
          correlationId: speakingUsageCorrelation(correlationId, "scripted"),
          sessionId: null,
        }),
      };
    }
  }

  private async guard<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof SpeakingRuleError) {
        throw new HttpException({ code: error.code, message: error.message }, error.status);
      }
      throw error;
    }
  }
}

class SpeechFailure extends Error {
  constructor(readonly failure: SpeechUnavailableError) {
    super("Speech transcription is temporarily unavailable.");
    this.name = "SpeechFailure";
  }
}

function usageFrom(
  response: AIResponse,
  route: { provider: string; inputMicrosPerMillion: number; outputMicrosPerMillion: number },
  task: "teach" | "interview",
  correlationId: string,
): ReturnType<typeof recordAiUsage> {
  return recordAiUsage({
    userId: null,
    task,
    provider: route.provider,
    model: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    inputMicrosPerMillion: route.inputMicrosPerMillion,
    outputMicrosPerMillion: route.outputMicrosPerMillion,
    cached: false,
    latencyMs: response.latencyMs,
    correlationId: speakingUsageCorrelation(correlationId, "speaking"),
    sessionId: null,
  });
}

function scriptedSpeaking(transcript: string): Record<string, unknown> {
  const asks =
    /ignore previous|system prompt|api key|hidden test|change my score|mark me correct|give me the answer|pretend i passed|cavabı yaz/i.test(
      transcript,
    );
  const understanding = asks
    ? "unknown"
    : transcript.trim().length < 15
      ? "unknown"
      : transcript.trim().length >= 80
        ? "correct"
        : "partial";
  return {
    speech: asks
      ? "Tam cavabı verməyəcəm. Nə baş verdiyini öz sözünüzlə deyin."
      : understanding === "correct"
        ? "Əsas fikri düzgün izah etdin."
        : "Bir hissəsi düzgündür. Bir az dəqiqləşdirək.",
    understanding,
    strengths: understanding === "correct" ? ["Əsas fikir görünür."] : [],
    issues: understanding === "correct" ? [] : ["İzahı tamamlanmayıb."],
    feedback: asks ? "Həlli yazmıram." : "Bu, müəllimin qeydidir.",
    score: 100,
    mastery: 100,
  };
}

function speechUnavailable(): HttpException {
  return new HttpException(
    { code: "SPEECH_UNAVAILABLE", message: "Speech transcription is temporarily unavailable." },
    503,
  );
}

function aiUnavailable(): HttpException {
  return new HttpException(
    { code: "AI_UNAVAILABLE", message: "The teacher is temporarily unavailable." },
    503,
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
