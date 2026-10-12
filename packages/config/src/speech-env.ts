import { z } from "zod";
import { ConfigError } from "./env";

export interface TranscriptionConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

const providerSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i);

const modelSchema = z.string().trim().min(1).max(120);
const baseUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("https://"), "AI_TRANSCRIPTION_BASE_URL must use https.");

export function loadTranscriptionEnv(
  source: Readonly<Record<string, unknown>>,
): TranscriptionConfig | null {
  const provider = read(source, "AI_TRANSCRIPTION_PROVIDER");
  const model = read(source, "AI_TRANSCRIPTION_MODEL");
  const apiKey = read(source, "AI_TRANSCRIPTION_API_KEY");
  const baseUrl = read(source, "AI_TRANSCRIPTION_BASE_URL");
  if (
    provider === undefined &&
    model === undefined &&
    apiKey === undefined &&
    baseUrl === undefined
  ) {
    if (source.NODE_ENV === "production") {
      throw new ConfigError(
        "AI_TRANSCRIPTION_PROVIDER, AI_TRANSCRIPTION_MODEL, and AI_TRANSCRIPTION_API_KEY are required in production.",
      );
    }
    return null;
  }
  if (source.NODE_ENV === "production" && provider === "fake") {
    throw new ConfigError("AI_TRANSCRIPTION_PROVIDER is not allowed in production.");
  }
  if (provider === undefined || model === undefined || apiKey === undefined) {
    throw new ConfigError(
      "AI_TRANSCRIPTION_PROVIDER, AI_TRANSCRIPTION_MODEL, and AI_TRANSCRIPTION_API_KEY must be set together.",
    );
  }
  const providerResult = providerSchema.safeParse(provider);
  const modelResult = modelSchema.safeParse(model);
  if (!providerResult.success || !modelResult.success) {
    throw new ConfigError("AI_TRANSCRIPTION_PROVIDER or AI_TRANSCRIPTION_MODEL is invalid.");
  }
  if (apiKey.length < 8 || apiKey.length > 400) {
    throw new ConfigError("AI_TRANSCRIPTION_API_KEY is invalid.");
  }
  let resolved = DEFAULT_BASE_URL;
  if (baseUrl !== undefined) {
    const parsed = baseUrlSchema.safeParse(baseUrl);
    if (!parsed.success) {
      throw new ConfigError("AI_TRANSCRIPTION_BASE_URL must be an https URL.");
    }
    resolved = parsed.data.replace(/\/$/, "");
  }
  return {
    provider: providerResult.data,
    model: modelResult.data,
    apiKey,
    baseUrl: resolved,
  };
}

function read(source: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = source[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}
