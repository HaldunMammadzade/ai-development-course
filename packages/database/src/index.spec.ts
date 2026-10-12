import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getPrismaSchemaPath } from "./index";

describe("getPrismaSchemaPath", () => {
  it("points at the Prisma schema", () => {
    expect(existsSync(getPrismaSchemaPath())).toBe(true);
  });
});
