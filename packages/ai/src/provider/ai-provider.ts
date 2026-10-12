import { AIProviderError } from "./errors";

export interface AIModel {
  provider: string;
  name: string;
}

export interface AIUsage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
}

export interface AIModelConfig {
  provider: string;
  model: string;
  maxOutputTokens: number;
  temperature: number;
  timeoutMs: number;
  maxInputChars: number;
}

export interface AIRequest {
  model: AIModelConfig;
  system: string;
  user: string;
  schemaName: string;
}

export interface AIResponse {
  json: unknown;
  inputTokens: number;
  outputTokens: number;
  model: string;
  latencyMs: number;
  usage: AIUsage;
}

export interface AIProvider {
  readonly id: string;
  complete(request: AIRequest): Promise<AIResponse>;
}

export function assertInputSize(request: AIRequest): void {
  const size = request.system.length + request.user.length;
  if (size > request.model.maxInputChars) {
    throw new AIProviderError("input_too_large");
  }
}
