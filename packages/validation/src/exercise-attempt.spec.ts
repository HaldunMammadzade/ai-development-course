import { describe, expect, it } from "vitest";
import { exerciseAttemptRequestSchema } from "./exercise";

describe("exercise attempt request", () => {
  it("rejects a client-supplied score or pass", () => {
    const result = exerciseAttemptRequestSchema.safeParse({
      clientAttemptId: "6f1c0c3e-1b2a-4c8d-9e0f-123456789abc",
      submission: "Add task filtering",
      score: 100,
      passed: true,
    });
    expect(result.success).toBe(false);
  });
});