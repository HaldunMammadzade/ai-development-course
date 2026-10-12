import { z } from "zod";
import { ConfigError } from "./env";

export interface PaymentConfig {
  provider: string;
  apiKey: string;
  webhookSecret: string;
  baseUrl: string;
  timeoutMs: number;
}

const providerSchema = z
  .string()
  .trim()
  .min(1)
  .max(40)
  .regex(/^[a-z0-9][a-z0-9._-]*$/i);

function read(source: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = source[key];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

export function loadPaymentEnv(source: Readonly<Record<string, unknown>>): PaymentConfig | null {
  const provider = read(source, "PAYMENT_PROVIDER");
  const apiKey = read(source, "PAYMENT_API_KEY");
  const webhookSecret = read(source, "PAYMENT_WEBHOOK_SECRET");
  const baseUrl = read(source, "PAYMENT_BASE_URL");
  const timeout = read(source, "PAYMENT_TIMEOUT_MS");
  if (
    provider === undefined &&
    apiKey === undefined &&
    webhookSecret === undefined &&
    baseUrl === undefined &&
    timeout === undefined
  ) {
    return null;
  }
  if (
    provider === undefined ||
    apiKey === undefined ||
    webhookSecret === undefined ||
    baseUrl === undefined
  ) {
    throw new ConfigError(
      "PAYMENT_PROVIDER, PAYMENT_API_KEY, PAYMENT_WEBHOOK_SECRET, and PAYMENT_BASE_URL must be set together.",
    );
  }
  if (source.NODE_ENV === "production" && provider === "fake") {
    throw new ConfigError("PAYMENT_PROVIDER is not allowed in production.");
  }
  if (!providerSchema.safeParse(provider).success) {
    throw new ConfigError("PAYMENT_PROVIDER is invalid.");
  }
  if (
    apiKey.length < 8 ||
    apiKey.length > 400 ||
    webhookSecret.length < 8 ||
    webhookSecret.length > 400
  ) {
    throw new ConfigError("PAYMENT_API_KEY or PAYMENT_WEBHOOK_SECRET is invalid.");
  }
  const parsedUrl = z.string().url().safeParse(baseUrl);
  if (!parsedUrl.success || !baseUrl.startsWith("https://")) {
    throw new ConfigError("PAYMENT_BASE_URL must use https.");
  }
  const timeoutMs = timeout === undefined ? 10_000 : Number(timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1_000 || timeoutMs > 30_000) {
    throw new ConfigError("PAYMENT_TIMEOUT_MS is invalid.");
  }
  return { provider, apiKey, webhookSecret, baseUrl, timeoutMs };
}
