import { describe, expect, it } from "vitest";
import { readRunnerListenToken } from "./runner-env";

describe("runner listen token", () => {
  it("rejects the development token in production", () => {
    expect(() => readRunnerListenToken({ NODE_ENV: "production" })).toThrow(
      /EXECUTION_RUNNER_TOKEN/,
    );
    expect(() =>
      readRunnerListenToken({
        NODE_ENV: "production",
        EXECUTION_RUNNER_TOKEN: "local-development-runner",
      }),
    ).toThrow(/EXECUTION_RUNNER_TOKEN/);
  });

  it("accepts an explicit production token and the development default", () => {
    expect(
      readRunnerListenToken({
        NODE_ENV: "production",
        EXECUTION_RUNNER_TOKEN: "production-runner-token",
      }),
    ).toBe("production-runner-token");
    expect(readRunnerListenToken({ NODE_ENV: "development" })).toBe("local-development-runner");
  });
});
