import { EXECUTION_LIMITS } from "@platform/execution";
import { describe, expect, it } from "vitest";
import { consumeStdout, lastResult } from "./docker-runner";

describe("execution output limits", () => {
  it("keeps stdout at the cap and marks the next chunk as overflow", () => {
    const first = consumeStdout("", "A".repeat(20_000), EXECUTION_LIMITS.maxStdoutBytes);
    expect(first.text).toHaveLength(EXECUTION_LIMITS.maxStdoutBytes);
    expect(first.overflow).toBe(false);
    const second = consumeStdout(
      first.text,
      '{"status":"completed"}\n',
      EXECUTION_LIMITS.maxStdoutBytes,
    );
    expect(second.text).toBe(first.text);
    expect(second.overflow).toBe(true);
  });

  it("ignores a result line above the size limit and keeps the harness line", () => {
    const oversized = `{"status":"timeout","pad":"${"B".repeat(9_000)}"}`;
    expect(oversized.length).toBeGreaterThan(EXECUTION_LIMITS.maxResultBytes);
    const harness = '{"status":"completed","tests":[{"id":"add-a","passed":true}]}';
    const parsed = lastResult(`${oversized}\n${harness}\n`);
    expect(parsed).toEqual({
      status: "completed",
      tests: [{ id: "add-a", passed: true }],
    });
    expect(lastResult(oversized)).toBeNull();
  });
});
