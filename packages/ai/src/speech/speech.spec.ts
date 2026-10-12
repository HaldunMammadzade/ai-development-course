import { describe, expect, it, vi } from "vitest";
import { HttpSpeechToTextProvider } from "./http-speech";
import {
  DisabledSpeechToTextProvider,
  FakeSpeechToTextProvider,
  SpeechUnavailableError,
} from "./speech-to-text";

describe("speech providers", () => {
  it("disables transcription when no provider is configured", async () => {
    await expect(new DisabledSpeechToTextProvider().transcribe(sample())).rejects.toMatchObject({
      code: "SPEECH_UNAVAILABLE",
      failureCategory: null,
      httpStatus: null,
      message: "Speech transcription is temporarily unavailable.",
    });
  });

  it("reads an embedded transcript from the fake provider once", async () => {
    const provider = new FakeSpeechToTextProvider();
    const bytes = Buffer.from(`RIFF${"TRANSCRIPT:Semantik element mənası bildirir."}`);
    const result = await provider.transcribe({ bytes, mediaType: "audio/wav" });
    expect(result.text).toContain("Semantik element");
    expect(result.provider).toBe("fake");
    expect(provider.calls).toBe(1);
  });

  it("does not return the provider key when transcription fails", async () => {
    const key = "server-side-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ error: key }), { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const provider = new HttpSpeechToTextProvider({
      provider: "openai",
      model: "whisper-1",
      apiKey: key,
      baseUrl: "https://example.test/v1",
    });
    await expect(provider.transcribe(sample())).rejects.toMatchObject({
      code: "SPEECH_UNAVAILABLE",
      failureCategory: "unavailable",
      httpStatus: 500,
      message: "Speech transcription is temporarily unavailable.",
    });
    const message = await provider
      .transcribe(sample())
      .catch((error: unknown) => (error instanceof Error ? error.message : ""));
    expect(message).not.toContain(key);
    vi.unstubAllGlobals();
  });

  it("classifies timeout, HTTP status, empty body, and malformed JSON separately", async () => {
    const key = "server-side-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new HttpSpeechToTextProvider({
      provider: "openai",
      model: "whisper-1",
      apiKey: key,
      baseUrl: "https://example.test/v1",
    });
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    fetchMock.mockRejectedValueOnce(timeout);
    await expect(provider.transcribe(sample())).rejects.toMatchObject({
      code: "SPEECH_UNAVAILABLE",
      failureCategory: "timeout",
      httpStatus: null,
      schemaIssues: [],
    });

    const network = new Error("connect ECONNRESET sk-secret");
    fetchMock.mockRejectedValueOnce(network);
    const networkError = await rejected(provider);
    expect(networkError).toMatchObject({
      failureCategory: "unavailable",
      httpStatus: null,
    });
    expect(JSON.stringify(networkError)).not.toContain("sk-secret");
    expect(networkError.message).not.toContain("sk-secret");

    const httpCases = [
      {
        status: 401,
        body: JSON.stringify({ error: key }),
        failureCategory: "authentication",
      },
      {
        status: 429,
        body: "not-json rate limit body",
        failureCategory: "rate_limit",
      },
      {
        status: 400,
        body: "not-json",
        failureCategory: "provider_http_error",
      },
      {
        status: 408,
        body: "not-json",
        failureCategory: "provider_http_error",
      },
      {
        status: 500,
        body: `not-json ${key}`,
        failureCategory: "unavailable",
      },
      {
        status: 302,
        body: "redirect secret",
        failureCategory: "unknown",
      },
    ];
    for (const item of httpCases) {
      fetchMock.mockResolvedValueOnce(new Response(item.body, { status: item.status }));
      const error = await rejected(provider);
      expect(error).toMatchObject({
        code: "SPEECH_UNAVAILABLE",
        failureCategory: item.failureCategory,
        httpStatus: item.status,
        message: "Speech transcription is temporarily unavailable.",
      });
      expect(error.failureCategory).not.toBe("malformed_json");
      expect(JSON.stringify(error)).not.toContain(key);
      expect(JSON.stringify(error)).not.toContain(item.body);
      expect(error.message).not.toContain(key);
    }

    fetchMock.mockResolvedValueOnce(new Response("   ", { status: 200 }));
    await expect(provider.transcribe(sample())).rejects.toMatchObject({
      failureCategory: "empty_provider_response",
      httpStatus: null,
    });
    fetchMock.mockResolvedValueOnce(new Response("not-json {text", { status: 200 }));
    const malformed = await rejected(provider);
    expect(malformed).toMatchObject({
      failureCategory: "malformed_json",
      httpStatus: null,
      schemaIssues: [],
    });
    expect(JSON.stringify(malformed)).not.toContain("not-json");
    vi.unstubAllGlobals();
  });

  it("rejects malformed transcription payloads without returning them", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const provider = new HttpSpeechToTextProvider({
      provider: "openai",
      model: "whisper-1",
      apiKey: "server-side-key",
      baseUrl: "https://example.test/v1",
    });
    const cases = [
      {
        response: new Response("not-json", { status: 200 }),
        failureCategory: "malformed_json",
        schemaIssues: [],
      },
      {
        response: new Response(JSON.stringify({}), { status: 200 }),
        failureCategory: "schema_rejection",
        schemaIssues: [{ path: "text", code: "invalid_type" }],
      },
      {
        response: new Response(JSON.stringify({ text: 12, secret: "server-side-key" }), {
          status: 200,
        }),
        failureCategory: "schema_rejection",
        schemaIssues: [{ path: "text", code: "invalid_type" }],
      },
    ];
    for (const item of cases) {
      fetchMock.mockResolvedValueOnce(item.response);
      const error = await rejected(provider);
      expect(error).toMatchObject({
        code: "SPEECH_UNAVAILABLE",
        failureCategory: item.failureCategory,
        httpStatus: null,
        schemaIssues: item.schemaIssues,
        message: "Speech transcription is temporarily unavailable.",
      });
      expect(JSON.stringify(error)).not.toContain("server-side-key");
      expect(JSON.stringify(error)).not.toContain("not-json");
    }
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ text: "A clear sentence.", score: 100, apiKey: "x" }), {
        status: 200,
      }),
    );
    const accepted = await provider.transcribe(sample());
    expect(accepted.text).toBe("A clear sentence.");
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ text: "" }), { status: 200 }));
    expect((await provider.transcribe(sample())).text).toBe("");
    expect(Object.keys(accepted).sort()).toEqual([
      "costMicros",
      "durationMs",
      "latencyMs",
      "model",
      "provider",
      "text",
    ]);
    vi.unstubAllGlobals();
  });

  it("drops an unrecognized speech category and an unsafe schema path", () => {
    const error = new SpeechUnavailableError({
      failureCategory: "transcript secret",
      httpStatus: 99,
      schemaIssues: [{ path: "student answer", code: "invalid_type" }],
    });
    expect(error.failureCategory).toBeNull();
    expect(error.httpStatus).toBeNull();
    expect(error.schemaIssues).toEqual([]);
    expect(error.message).toBe("Speech transcription is temporarily unavailable.");
    expect(JSON.stringify(error)).not.toContain("transcript");
    expect(JSON.stringify(error)).not.toContain("student");
  });
});

async function rejected(provider: HttpSpeechToTextProvider): Promise<SpeechUnavailableError> {
  try {
    await provider.transcribe(sample());
  } catch (error) {
    expect(error).toBeInstanceOf(SpeechUnavailableError);
    return error as SpeechUnavailableError;
  }
  throw new Error("expected transcription to fail");
}

function sample(): { bytes: Uint8Array; mediaType: "audio/wav" } {
  return { bytes: Uint8Array.of(1, 2, 3, 4), mediaType: "audio/wav" };
}
