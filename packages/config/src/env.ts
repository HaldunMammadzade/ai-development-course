import { z } from "zod";
import type { AiServerConfig } from "./ai-env";

export type NodeEnv = "development" | "test" | "production";

export interface ExecutionEnv {
  mode: "fake" | "docker";
  runnerUrl: string | null;
  runnerToken: string | null;
}

export interface ApiEnv {
  nodeEnv: NodeEnv;
  port: number;
  databaseUrl: string | null;
  cookieDomain?: string;
  execution: ExecutionEnv;
  ai?: AiServerConfig;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const nodeEnvSchema = z.enum(["development", "test", "production"]);
const portSchema = z.coerce.number().int().min(1).max(65535);
const databaseUrlSchema = z
  .string()
  .min(1)
  .refine(
    (value) => value.startsWith("postgresql://") || value.startsWith("postgres://"),
    "DATABASE_URL must be a PostgreSQL connection string.",
  );
const DEFAULT_PORT = 3001;

function readString(source: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = source[key];
  return typeof value === "string" ? value : undefined;
}

export function loadApiEnv(source: Readonly<Record<string, unknown>>): ApiEnv {
  const rawNodeEnv = readString(source, "NODE_ENV");
  if (rawNodeEnv === undefined || rawNodeEnv.trim() === "") {
    throw new ConfigError("NODE_ENV is required.");
  }

  const nodeEnvResult = nodeEnvSchema.safeParse(rawNodeEnv);
  if (!nodeEnvResult.success) {
    throw new ConfigError("NODE_ENV must be development, test, or production.");
  }

  const nodeEnv = nodeEnvResult.data;
  const rawPort = source.PORT;

  let port: number;
  if (rawPort === undefined || rawPort === "") {
    if (nodeEnv === "production") {
      throw new ConfigError("PORT is required in production.");
    }
    port = DEFAULT_PORT;
  } else {
    const portResult = portSchema.safeParse(rawPort);
    if (!portResult.success) {
      throw new ConfigError("PORT must be an integer between 1 and 65535.");
    }
    port = portResult.data;
  }

  const cookieDomain = readCookieDomain(source);
  return {
    nodeEnv,
    port,
    databaseUrl: readDatabaseUrl(source, nodeEnv),
    execution: readExecution(source, nodeEnv),
    ...(cookieDomain === undefined ? {} : { cookieDomain }),
  };
}

const LOCAL_RUNNER_URL = "http://127.0.0.1:3002";
const LOCAL_RUNNER_TOKEN = "local-development-runner";

function readExecution(source: Readonly<Record<string, unknown>>, nodeEnv: NodeEnv): ExecutionEnv {
  const rawMode = readString(source, "EXECUTION_MODE");
  if (
    nodeEnv === "test" &&
    (rawMode === undefined || rawMode.trim() === "" || rawMode === "fake")
  ) {
    return { mode: "fake", runnerUrl: null, runnerToken: null };
  }
  if (rawMode === "fake") {
    if (nodeEnv === "production") {
      throw new ConfigError("EXECUTION_MODE=fake is not allowed in production.");
    }
    return { mode: "fake", runnerUrl: null, runnerToken: null };
  }
  if (rawMode !== undefined && rawMode !== "docker") {
    throw new ConfigError("EXECUTION_MODE must be docker or fake.");
  }
  const runnerUrl = readString(source, "EXECUTION_RUNNER_URL")?.trim() || LOCAL_RUNNER_URL;
  if (!runnerUrl.startsWith("http://127.0.0.1:") && !runnerUrl.startsWith("http://localhost:")) {
    throw new ConfigError("EXECUTION_RUNNER_URL must be a loopback HTTP URL.");
  }
  const configuredToken = readString(source, "EXECUTION_RUNNER_TOKEN")?.trim() ?? "";
  const runnerToken = configuredToken.length > 0 ? configuredToken : LOCAL_RUNNER_TOKEN;
  if (
    nodeEnv === "production" &&
    (configuredToken.length < 16 || configuredToken === LOCAL_RUNNER_TOKEN)
  ) {
    throw new ConfigError("EXECUTION_RUNNER_TOKEN is required in production.");
  }
  if (runnerToken.length < 16) {
    throw new ConfigError("EXECUTION_RUNNER_TOKEN must be at least 16 characters.");
  }
  return { mode: "docker", runnerUrl, runnerToken };
}

function readDatabaseUrl(
  source: Readonly<Record<string, unknown>>,
  nodeEnv: NodeEnv,
): string | null {
  const rawDatabaseUrl = readString(source, "DATABASE_URL");
  if (rawDatabaseUrl === undefined || rawDatabaseUrl.trim() === "") {
    if (nodeEnv === "production") {
      throw new ConfigError("DATABASE_URL is required in production.");
    }
    return null;
  }

  const databaseUrlResult = databaseUrlSchema.safeParse(rawDatabaseUrl);
  if (!databaseUrlResult.success) {
    throw new ConfigError("DATABASE_URL must be a PostgreSQL connection string.");
  }

  return databaseUrlResult.data;
}

function readCookieDomain(source: Readonly<Record<string, unknown>>): string | undefined {
  const raw = readString(source, "COOKIE_DOMAIN");
  if (raw === undefined || raw.trim() === "") {
    return undefined;
  }
  const value = raw.trim().toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(value)) {
    throw new ConfigError("COOKIE_DOMAIN must be a bare hostname such as example.com.");
  }
  return value;
}
