import { describe, expect, it } from "vitest";
import { loadAiEnv } from "./ai-env";
import { ConfigError } from "./env";

describe("loadAiEnv", () => {
  it("stays unset when no AI variables are present", () => {
    expect(loadAiEnv({})).toBeNull();
  });

  it("reads a server-side teach route and omits nothing sensitive from the error text", () => {
    const config = loadAiEnv({
      AI_PROVIDER: "openai-compatible",
      AI_TEACH_MODEL: "grok-2",
      AI_API_KEY: "test-key-value",
      AI_BASE_URL: "https://api.x.ai/v1/",
      AI_MAX_INPUT_CHARS: "4000",
      AI_MAX_OUTPUT_TOKENS: "500",
    });

    expect(config).toMatchObject({
      provider: "openai-compatible",
      teachModel: "grok-2",
      reviewModel: "grok-2",
      baseUrl: "https://api.x.ai/v1",
      maxInputChars: 4000,
      maxOutputTokens: 500,
    });
    expect(config?.apiKey).toBe("test-key-value");
  });

  it("uses a separate review model when one is configured", () => {
    const config = loadAiEnv({
      AI_PROVIDER: "openai-compatible",
      AI_TEACH_MODEL: "teach-model",
      AI_REVIEW_MODEL: "review-model",
      AI_API_KEY: "test-key-value",
    });
    expect(config?.teachModel).toBe("teach-model");
    expect(config?.reviewModel).toBe("review-model");
  });

  it("fails when the teach route is only partly configured", () => {
    expect(() => loadAiEnv({ AI_API_KEY: "test-key-value" })).toThrow(ConfigError);
    expect(() => loadAiEnv({ AI_API_KEY: "test-key-value" })).toThrow(/must be set together/);
    try {
      loadAiEnv({ AI_API_KEY: "test-key-value" });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).not.toContain("test-key-value");
    }
  });
});
