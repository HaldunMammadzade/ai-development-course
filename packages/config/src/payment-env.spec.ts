import { describe, expect, it } from "vitest";
import { ConfigError } from "./env";
import { loadPaymentEnv } from "./payment-env";

const configured = {
  PAYMENT_PROVIDER: "http",
  PAYMENT_API_KEY: "server-side-key",
  PAYMENT_WEBHOOK_SECRET: "server-side-secret",
  PAYMENT_BASE_URL: "https://payments.example.test",
};

describe("loadPaymentEnv", () => {
  it("stays disabled when payment is not configured", () => {
    expect(loadPaymentEnv({})).toBeNull();
  });

  it("rejects a partial configuration and a fake provider in production", () => {
    expect(() => loadPaymentEnv({ PAYMENT_API_KEY: "server-side-key" })).toThrow(ConfigError);
    expect(() =>
      loadPaymentEnv({ ...configured, NODE_ENV: "production", PAYMENT_PROVIDER: "fake" }),
    ).toThrow(ConfigError);
    expect(() =>
      loadPaymentEnv({ ...configured, PAYMENT_BASE_URL: "http://payments.example.test" }),
    ).toThrow(ConfigError);
  });

  it("returns the server configuration without echoing the key", () => {
    const config = loadPaymentEnv(configured);
    expect(config?.provider).toBe("http");
    expect(config?.baseUrl).toBe("https://payments.example.test");
    expect(config?.timeoutMs).toBe(10_000);
  });
});
