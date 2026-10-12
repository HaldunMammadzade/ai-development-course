import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { onceSignal } from "./shutdown";

describe("runner shutdown", () => {
  it("closes once when SIGTERM arrives", () => {
    const source = new EventEmitter();
    let closed = 0;
    onceSignal(source, ["SIGTERM", "SIGINT"], () => {
      closed += 1;
    });
    source.emit("SIGTERM");
    source.emit("SIGINT");
    expect(closed).toBe(1);
  });
});
