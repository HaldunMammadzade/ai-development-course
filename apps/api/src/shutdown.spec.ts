import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { onceSignal } from "./shutdown";

describe("graceful shutdown", () => {
  it("runs the SIGTERM action once", () => {
    const source = new EventEmitter();
    let runs = 0;
    onceSignal(source, ["SIGTERM", "SIGINT"], () => {
      runs += 1;
    });
    source.emit("SIGTERM");
    source.emit("SIGTERM");
    source.emit("SIGINT");
    expect(runs).toBe(1);
  });
});
