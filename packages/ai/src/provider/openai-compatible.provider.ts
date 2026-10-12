import { AIProviderError, providerErrorCode } from "./errors";
import {
  assertInputSize,
  type AIProvider,
  type AIRequest,
  type AIResponse,
  type AIUsage,
} from "./ai-provider";

export interface OpenAiCompatibleOptions {
  id: string;
  apiKey: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export class OpenAiCompatibleProvider implements AIProvider {
  readonly id: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAiCompatibleOptions) {
    this.id = options.id;
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: AIRequest): Promise<AIResponse> {
    assertInputSize(request);
    const started = Date.now();
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: request.model.model,
          temperature: request.model.temperature,
          max_tokens: request.model.maxOutputTokens,
          messages: [
            { role: "system", content: request.system },
            { role: "user", content: request.user },
          ],
          response_format: { type: "json_object" },
        }),
        signal: AbortSignal.timeout(request.model.timeoutMs),
      });
    } catch (error) {
      if (isTimeout(error)) {
        throw new AIProviderError("timeout");
      }
      throw new AIProviderError("unavailable");
    }

    const bodyText = await response.text();
    if (!response.ok) {
      throw httpFailure(response.status, bodyText);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      throw malformedJson();
    }

    const content = readContent(payload);
    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      throw malformedJson();
    }

    const usage = readUsage(
      payload,
      request.model.provider,
      request.model.model,
      Date.now() - started,
    );
    return {
      json,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      model: usage.model,
      latencyMs: usage.latencyMs,
      usage,
    };
  }
}

export class DisabledAiProvider implements AIProvider {
  readonly id = "unconfigured";

  complete(): Promise<AIResponse> {
    return Promise.reject(new AIProviderError("authentication"));
  }
}

function httpFailure(status: number, bodyText: string): AIProviderError {
  const code = providerErrorCode(status, bodyText);
  return new AIProviderError(code, {
    httpStatus: status,
    failureCategory:
      code === "invalid_response"
        ? "provider_http_error"
        : code === "unknown"
          ? "unknown_ai_failure"
          : null,
  });
}

function malformedJson(): AIProviderError {
  return new AIProviderError("malformed_json", { failureCategory: "malformed_json" });
}

function emptyProviderResponse(): AIProviderError {
  return new AIProviderError("invalid_response", { failureCategory: "empty_provider_response" });
}

function readContent(payload: unknown): string {
  if (typeof payload !== "object" || payload === null) {
    throw emptyProviderResponse();
  }
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw emptyProviderResponse();
  }
  const message = (choices[0] as { message?: { content?: unknown } }).message;
  if (typeof message?.content !== "string" || message.content.trim().length === 0) {
    throw emptyProviderResponse();
  }
  return message.content;
}

function readUsage(payload: unknown, provider: string, model: string, latencyMs: number): AIUsage {
  const usage =
    typeof payload === "object" && payload !== null
      ? (payload as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } }).usage
      : undefined;
  const inputTokens = finiteTokenCount(usage?.prompt_tokens);
  const outputTokens = finiteTokenCount(usage?.completion_tokens);
  return {
    provider,
    model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    latencyMs,
  };
}

function finiteTokenCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.floor(value);
}

function isTimeout(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}
