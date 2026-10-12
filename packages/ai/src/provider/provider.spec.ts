import { describe, expect, it } from "vitest";
import { AIProviderError } from "./errors";
import type { AIRequest } from "./ai-provider";
import { OpenAiCompatibleProvider } from "./openai-compatible.provider";

const request: AIRequest = {
  model: {
    provider: "openai-compatible",
    model: "teach-model",
    maxOutputTokens: 200,
    temperature: 0.2,
    timeoutMs: 1000,
    maxInputChars: 100,
  },
  system: "system",
  user: "student says hello",
  schemaName: "TeacherResult",
};

describe("OpenAiCompatibleProvider", () => {
  it("normalizes a successful JSON completion and does not send tools", async () => {
    let body = "";
    const provider = new OpenAiCompatibleProvider({
      id: "openai-compatible",
      apiKey: "test-key-value",
      baseUrl: "https://api.example.com/v1",
      fetchImpl: async (_url, init) => {
        body = String(init?.body);
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ speech: "Hello" }) } }],
            usage: { prompt_tokens: 12, completion_tokens: 4 },
          }),
          { status: 200 },
        );
      },
    });

    const response = await provider.complete(request);
    expect(response.json).toEqual({ speech: "Hello" });
    expect(response.usage).toMatchObject({
      provider: "openai-compatible",
      model: "teach-model",
      inputTokens: 12,
      outputTokens: 4,
      totalTokens: 16,
    });
    expect(body).not.toContain("tools");
    expect(body).not.toContain("test-key-value");
    expect(JSON.parse(body)).not.toHaveProperty("tools");
  });

  it("normalizes provider failures without leaking the key or the body", async () => {
    const provider = new OpenAiCompatibleProvider({
      id: "openai-compatible",
      apiKey: "test-key-value",
      baseUrl: "https://api.example.com/v1",
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: "bad key test-key-value" }), { status: 401 }),
    });

    await expect(provider.complete(request)).rejects.toMatchObject({
      code: "authentication",
    });
    await expect(provider.complete(request)).rejects.toThrow(AIProviderError);
    try {
      await provider.complete(request);
    } catch (error) {
      expect(error).toMatchObject({
        code: "authentication",
        httpStatus: 401,
        failureCategory: null,
      });
      expect((error as Error).message).not.toContain("test-key-value");
      expect((error as Error).message).not.toContain("student says hello");
      expect(JSON.stringify(error)).not.toContain("test-key-value");
    }
  });

  it("keeps a provider 4xx distinct from a schema rejection and a 5xx", async () => {
    const denied = new OpenAiCompatibleProvider({
      id: "openai-compatible",
      apiKey: "test-key-value",
      baseUrl: "https://api.example.com/v1",
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: { message: "bad-parameter-token" } }), {
          status: 400,
        }),
    });
    await expect(denied.complete(request)).rejects.toMatchObject({
      code: "invalid_response",
      failureCategory: "provider_http_error",
      httpStatus: 400,
      schemaIssues: [],
    });
    try {
      await denied.complete(request);
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain("bad-parameter-token");
      expect((error as Error).message).not.toContain("bad-parameter-token");
    }

    const down = new OpenAiCompatibleProvider({
      id: "openai-compatible",
      apiKey: "test-key-value",
      baseUrl: "https://api.example.com/v1",
      fetchImpl: async () => new Response("upstream-down", { status: 503 }),
    });
    await expect(down.complete(request)).rejects.toMatchObject({
      code: "unavailable",
      failureCategory: null,
      httpStatus: 503,
    });
  });

  it("classifies an empty completion separately from malformed JSON", async () => {
    const empty = new OpenAiCompatibleProvider({
      id: "openai-compatible",
      apiKey: "test-key-value",
      baseUrl: "https://api.example.com/v1",
      fetchImpl: async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 }),
    });
    await expect(empty.complete(request)).rejects.toMatchObject({
      code: "invalid_response",
      failureCategory: "empty_provider_response",
      httpStatus: null,
    });

    const malformed = new OpenAiCompatibleProvider({
      id: "openai-compatible",
      apiKey: "test-key-value",
      baseUrl: "https://api.example.com/v1",
      fetchImpl: async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "not-json-body" } }] }), {
          status: 200,
        }),
    });
    await expect(malformed.complete(request)).rejects.toMatchObject({
      code: "malformed_json",
      failureCategory: "malformed_json",
      schemaIssues: [],
    });
    try {
      await malformed.complete(request);
    } catch (error) {
      expect(JSON.stringify(error)).not.toContain("not-json-body");
      expect((error as Error).message).not.toContain("not-json-body");
    }
  });

  it("rejects malformed model JSON", async () => {
    const provider = new OpenAiCompatibleProvider({
      id: "openai-compatible",
      apiKey: "test-key-value",
      baseUrl: "https://api.example.com/v1",
      fetchImpl: async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "not-json" } }] }), {
          status: 200,
        }),
    });

    await expect(provider.complete(request)).rejects.toMatchObject({ code: "malformed_json" });
  });

  it("rejects an oversized prompt before calling the network", async () => {
    let called = false;
    const provider = new OpenAiCompatibleProvider({
      id: "openai-compatible",
      apiKey: "test-key-value",
      baseUrl: "https://api.example.com/v1",
      fetchImpl: async () => {
        called = true;
        return new Response("{}", { status: 200 });
      },
    });

    await expect(provider.complete({ ...request, user: "x".repeat(200) })).rejects.toMatchObject({
      code: "input_too_large",
    });
    expect(called).toBe(false);
  });
});
