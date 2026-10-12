import { describe, expect, it } from "vitest";
import { ConfigError } from "./env";
import { loadTranscriptionEnv } from "./speech-env";

describe("loadTranscriptionEnv", () => {
  it("stays disabled when transcription is not configured", () => {
    expect(loadTranscriptionEnv({})).toBeNull();
  });

  it("fails closed in production when transcription is missing or fake", () => {
    expect(() => loadTranscriptionEnv({ NODE_ENV: "production" })).toThrow(ConfigError);
    expect(() =>
      loadTranscriptionEnv({
        NODE_ENV: "production",
        AI_TRANSCRIPTION_PROVIDER: "fake",
        AI_TRANSCRIPTION_MODEL: "whisper-1",
        AI_TRANSCRIPTION_API_KEY: "test-key-value",
      }),
    ).toThrow(/not allowed in production/);
  });

  it("requires the provider, model, and key together", () => {
    expect(() => loadTranscriptionEnv({ AI_TRANSCRIPTION_API_KEY: "test-key-value" })).toThrow(
      ConfigError,
    );
    expect(
      loadTranscriptionEnv({
        AI_TRANSCRIPTION_PROVIDER: "openai",
        AI_TRANSCRIPTION_MODEL: "whisper-1",
        AI_TRANSCRIPTION_API_KEY: "test-key-value",
      }),
    ).toMatchObject({
      provider: "openai",
      model: "whisper-1",
      baseUrl: "https://api.openai.com/v1",
    });
  });
});
