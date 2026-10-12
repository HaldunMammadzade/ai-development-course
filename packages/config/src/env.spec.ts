import { describe, expect, it } from "vitest";
import { ConfigError, loadApiEnv } from "./env";

describe("loadApiEnv", () => {
  it("requires NODE_ENV", () => {
    expect(() => loadApiEnv({})).toThrow(ConfigError);
    expect(() => loadApiEnv({})).toThrow(/NODE_ENV is required/);
  });

  it("rejects an unknown NODE_ENV", () => {
    expect(() => loadApiEnv({ NODE_ENV: "staging" })).toThrow(
      /NODE_ENV must be development, test, or production/,
    );
  });

  it("defaults the port outside production", () => {
    expect(loadApiEnv({ NODE_ENV: "development" })).toEqual({
      nodeEnv: "development",
      port: 3001,
      databaseUrl: null,
      execution: {
        mode: "docker",
        runnerUrl: "http://127.0.0.1:3002",
        runnerToken: "local-development-runner",
      },
    });
    expect(loadApiEnv({ NODE_ENV: "test" })).toEqual({
      nodeEnv: "test",
      port: 3001,
      databaseUrl: null,
      execution: { mode: "fake", runnerUrl: null, runnerToken: null },
    });
  });

  it("requires PORT in production", () => {
    expect(() => loadApiEnv({ NODE_ENV: "production" })).toThrow(/PORT is required in production/);
  });

  it("requires DATABASE_URL in production", () => {
    expect(() => loadApiEnv({ NODE_ENV: "production", PORT: "4000" })).toThrow(
      /DATABASE_URL is required in production/,
    );
  });

  it("accepts an explicit port and database url", () => {
    expect(
      loadApiEnv({
        NODE_ENV: "production",
        PORT: "4000",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/platform",
        EXECUTION_RUNNER_TOKEN: "production-runner-token",
      }),
    ).toEqual({
      nodeEnv: "production",
      port: 4000,
      databaseUrl: "postgresql://postgres:postgres@localhost:5432/platform",
      execution: {
        mode: "docker",
        runnerUrl: "http://127.0.0.1:3002",
        runnerToken: "production-runner-token",
      },
    });
    expect(() =>
      loadApiEnv({
        NODE_ENV: "production",
        PORT: "4000",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/platform",
      }),
    ).toThrow(/EXECUTION_RUNNER_TOKEN/);
  });

  it("rejects a non-postgres database url", () => {
    expect(() =>
      loadApiEnv({
        NODE_ENV: "development",
        DATABASE_URL: "mysql://localhost/platform",
      }),
    ).toThrow(/DATABASE_URL must be a PostgreSQL connection string/);
  });

  it("accepts a bare cookie domain and omits it when unset", () => {
    expect(
      loadApiEnv({
        NODE_ENV: "production",
        PORT: "4000",
        DATABASE_URL: "postgresql://postgres:postgres@localhost:5432/platform",
        COOKIE_DOMAIN: "Example.com",
        EXECUTION_RUNNER_TOKEN: "production-runner-token",
      }).cookieDomain,
    ).toBe("example.com");
    expect(loadApiEnv({ NODE_ENV: "development" }).cookieDomain).toBeUndefined();
    expect(() =>
      loadApiEnv({
        NODE_ENV: "development",
        COOKIE_DOMAIN: "https://example.com",
      }),
    ).toThrow(/COOKIE_DOMAIN/);
  });

  it("rejects an invalid port", () => {
    expect(() => loadApiEnv({ NODE_ENV: "development", PORT: "0" })).toThrow(
      /PORT must be an integer/,
    );
    expect(() => loadApiEnv({ NODE_ENV: "development", PORT: "nope" })).toThrow(
      /PORT must be an integer/,
    );
  });
});
