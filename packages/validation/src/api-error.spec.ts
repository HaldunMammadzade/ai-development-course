import type { ApiErrorBody } from "@platform/types";
import { describe, expect, it } from "vitest";
import { parseApiErrorBody } from "./index";

describe("parseApiErrorBody", () => {
  it("accepts the shared error contract", () => {
    const body = parseApiErrorBody({
      error: { code: "NOT_FOUND", message: "Missing." },
    });
    const typed: ApiErrorBody = body;

    expect(typed.error.code).toBe("NOT_FOUND");
  });

  it("rejects an empty code", () => {
    expect(() => parseApiErrorBody({ error: { code: "", message: "Missing." } })).toThrow();
  });
});
