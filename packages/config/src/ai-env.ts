import { z } from "zod";
import { ConfigError } from "./env";

export interface AiServerConfig {
  provider: string;
  teachModel: string;
  reviewModel: string;
  apiKey: string;
  baseUrl: string;
  maxInputChars: number;
  maxOutputTokens: number;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MAX_INPUT_CHARS = 12_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 800;
const MAX_INPUT_CHARS_CAP = 100_000;
const MAX_OUTPUT_TOKENS_CAP = 4_096;

const providerSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i, "AI_PROVIDER must be a provider id.");

const modelSchema = z.string().trim().min(1).max(120);
const baseUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("https://"), "AI_BASE_URL must use https.");

function readString(source: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = source[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function loadAiEnv(source: Readonly<Record<string, unknown>>): AiServerConfig | null {
  const provider = readString(source, "AI_PROVIDER");
  const teachModel = readString(source, "AI_TEACH_MODEL");
  const reviewModel = readString(source, "AI_REVIEW_MODEL");
  const apiKey = readString(source, "AI_API_KEY");
  const baseUrl = readString(source, "AI_BASE_URL");
  const maxInputChars = readString(source, "AI_MAX_INPUT_CHARS");
  const maxOutputTokens = readString(source, "AI_MAX_OUTPUT_TOKENS");
  const anySet = [
    provider,
    teachModel,
    reviewModel,
    apiKey,
    baseUrl,
    maxInputChars,
    maxOutputTokens,
  ].some((value) => value !== undefined);
  if (!anySet) {
    return null;
  }
  if (provider === undefined || teachModel === undefined || apiKey === undefined) {
    throw new ConfigError("AI_PROVIDER, AI_TEACH_MODEL, and AI_API_KEY must be set together.");
  }

  const providerResult = providerSchema.safeParse(provider);
  const modelResult = modelSchema.safeParse(teachModel);
  const reviewResult = modelSchema.safeParse(reviewModel ?? teachModel);
  if (!providerResult.success || !modelResult.success || !reviewResult.success) {
    throw new ConfigError("AI_PROVIDER or AI_TEACH_MODEL is invalid.");
  }
  if (apiKey.length < 8 || apiKey.length > 400) {
    throw new ConfigError("AI_API_KEY is invalid.");
  }

  let resolvedBaseUrl = DEFAULT_BASE_URL;
  if (baseUrl !== undefined) {
    const parsed = baseUrlSchema.safeParse(baseUrl);
    if (!parsed.success) {
      throw new ConfigError("AI_BASE_URL must be an https URL.");
    }
    resolvedBaseUrl = parsed.data.replace(/\/$/, "");
  }

  return {
    provider: providerResult.data,
    teachModel: modelResult.data,
    reviewModel: reviewResult.data,
    apiKey,
    baseUrl: resolvedBaseUrl,
    maxInputChars: readBoundedInteger(
      maxInputChars,
      "AI_MAX_INPUT_CHARS",
      DEFAULT_MAX_INPUT_CHARS,
      MAX_INPUT_CHARS_CAP,
    ),
    maxOutputTokens: readBoundedInteger(
      maxOutputTokens,
      "AI_MAX_OUTPUT_TOKENS",
      DEFAULT_MAX_OUTPUT_TOKENS,
      MAX_OUTPUT_TOKENS_CAP,
    ),
  };
}

function readBoundedInteger(
  raw: string | undefined,
  name: string,
  fallback: number,
  cap: number,
): number {
  if (raw === undefined) {
    return fallback;
  }
  const parsed = z.coerce.number().int().min(1).max(cap).safeParse(raw);
  if (!parsed.success) {
    throw new ConfigError(`${name} must be an integer from 1 to ${cap}.`);
  }
  return parsed.data;
}
