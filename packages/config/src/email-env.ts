import { z } from "zod";
import { ConfigError } from "./env";

export interface EmailConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  fromAddress: string;
  fromName: string;
  timeoutMs: number;
  publicUrl: string;
}

const providerSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i);

const emailSchema = z.string().trim().email().max(320);

function read(source: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = source[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function loadEmailEnv(source: Readonly<Record<string, unknown>>): EmailConfig | null {
  const provider = read(source, "EMAIL_PROVIDER");
  const apiKey = read(source, "EMAIL_API_KEY");
  const baseUrl = read(source, "EMAIL_BASE_URL");
  const fromAddress = read(source, "EMAIL_FROM_ADDRESS");
  const fromName = read(source, "EMAIL_FROM_NAME");
  const timeout = read(source, "EMAIL_TIMEOUT_MS");
  const publicUrl = read(source, "APP_PUBLIC_URL");
  if (
    provider === undefined &&
    apiKey === undefined &&
    baseUrl === undefined &&
    fromAddress === undefined &&
    fromName === undefined &&
    timeout === undefined
  ) {
    return null;
  }
  if (
    provider === undefined ||
    apiKey === undefined ||
    baseUrl === undefined ||
    fromAddress === undefined ||
    fromName === undefined ||
    publicUrl === undefined
  ) {
    throw new ConfigError(
      "EMAIL_PROVIDER, EMAIL_API_KEY, EMAIL_BASE_URL, EMAIL_FROM_ADDRESS, EMAIL_FROM_NAME, and APP_PUBLIC_URL must be set together.",
    );
  }
  if (source.NODE_ENV === "production" && provider === "fake") {
    throw new ConfigError("EMAIL_PROVIDER is not allowed in production.");
  }
  if (!providerSchema.safeParse(provider).success) {
    throw new ConfigError("EMAIL_PROVIDER is invalid.");
  }
  if (apiKey.length < 8 || apiKey.length > 400) {
    throw new ConfigError("EMAIL_API_KEY is invalid.");
  }
  if (!emailSchema.safeParse(fromAddress).success) {
    throw new ConfigError("EMAIL_FROM_ADDRESS is invalid.");
  }
  if (fromName.length < 1 || fromName.length > 80) {
    throw new ConfigError("EMAIL_FROM_NAME is invalid.");
  }
  const parsedBase = z.string().url().safeParse(baseUrl);
  if (!parsedBase.success || !baseUrl.startsWith("https://")) {
    throw new ConfigError("EMAIL_BASE_URL must use https.");
  }
  const parsedPublic = z.string().url().safeParse(publicUrl);
  if (
    !parsedPublic.success ||
    (source.NODE_ENV === "production" && !publicUrl.startsWith("https://"))
  ) {
    throw new ConfigError("APP_PUBLIC_URL is invalid.");
  }
  const timeoutMs = timeout === undefined ? 10_000 : Number(timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
    throw new ConfigError("EMAIL_TIMEOUT_MS is invalid.");
  }
  return { provider, apiKey, baseUrl, fromAddress, fromName, timeoutMs, publicUrl };
}
