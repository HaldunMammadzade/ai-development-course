import { describe, expect, it } from "vitest";
import { ConfigError } from "./env";
import { loadEmailEnv } from "./email-env";

const complete = {
  EMAIL_PROVIDER: "http",
  EMAIL_API_KEY: "email-test-key",
  EMAIL_BASE_URL: "https://mail.example.test",
  EMAIL_FROM_ADDRESS: "noreply@example.test",
  EMAIL_FROM_NAME: "Müəllim",
  APP_PUBLIC_URL: "https://app.example.test",
};

describe("loadEmailEnv", () => {
  it("stays disabled when email is unset", () => {
    expect(loadEmailEnv({})).toBeNull();
    expect(loadEmailEnv({ APP_PUBLIC_URL: "https://app.example.test" })).toBeNull();
  });

  it("rejects a partial configuration without echoing secrets", () => {
    expect(() => loadEmailEnv({ EMAIL_PROVIDER: "http", EMAIL_API_KEY: "email-test-key" })).toThrow(
      ConfigError,
    );
    try {
      loadEmailEnv({ EMAIL_PROVIDER: "http", EMAIL_API_KEY: "email-test-key" });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as Error).message).not.toContain("email-test-key");
    }
  });

  it("rejects the fake provider in production", () => {
    expect(() =>
      loadEmailEnv({ ...complete, NODE_ENV: "production", EMAIL_PROVIDER: "fake" }),
    ).toThrow("EMAIL_PROVIDER is not allowed in production.");
  });

  it("accepts an https provider outside production", () => {
    const config = loadEmailEnv({ ...complete, NODE_ENV: "test" });
    expect(config?.provider).toBe("http");
    expect(config?.timeoutMs).toBe(10_000);
    expect(config?.publicUrl).toBe("https://app.example.test");
  });
});
