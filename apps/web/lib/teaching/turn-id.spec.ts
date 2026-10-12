import { describe, expect, it } from "vitest";
import { createClientTurnId } from "./turn-id";

describe("clientTurnId", () => {
  it("creates a fresh UUID for each turn", () => {
    const first = createClientTurnId();
    const second = createClientTurnId();
    expect(first).not.toBe(second);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
