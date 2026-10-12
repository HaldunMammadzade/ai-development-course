import { describe, expect, it } from "vitest";
import { openTeachingSessionSchema, teachingTurnSchema } from "./teaching";

describe("teaching request schemas", () => {
  it("rejects a client-selected lesson and accepts explain or socratic", () => {
    expect(openTeachingSessionSchema.parse({})).toEqual({});
    expect(openTeachingSessionSchema.parse({ mode: "socratic" }).mode).toBe("socratic");
    expect(
      openTeachingSessionSchema.safeParse({ lessonId: "11111111-1111-4111-8111-111111111111" })
        .success,
    ).toBe(false);
    expect(openTeachingSessionSchema.safeParse({ mode: "interview" }).success).toBe(false);
    expect(openTeachingSessionSchema.safeParse({ conceptSlug: "web.http" }).success).toBe(false);
  });

  it("requires one of message or advance and rejects oversized text", () => {
    expect(
      teachingTurnSchema.safeParse({ clientTurnId: "not-a-uuid", advance: true }).success,
    ).toBe(false);
    expect(
      teachingTurnSchema.safeParse({
        clientTurnId: "11111111-1111-4111-8111-111111111111",
        message: "  hello  ",
        advance: true,
      }).success,
    ).toBe(false);
    expect(
      teachingTurnSchema.safeParse({
        clientTurnId: "11111111-1111-4111-8111-111111111111",
      }).success,
    ).toBe(false);
    const parsed = teachingTurnSchema.parse({
      clientTurnId: "11111111-1111-4111-8111-111111111111",
      message: "  hello  ",
    });
    expect(parsed.message).toBe("hello");
    expect(
      teachingTurnSchema.safeParse({
        clientTurnId: "11111111-1111-4111-8111-111111111111",
        message: "x".repeat(2001),
      }).success,
    ).toBe(false);
    expect(
      teachingTurnSchema.safeParse({
        clientTurnId: "11111111-1111-4111-8111-111111111111",
        message: "hello",
        conceptSlug: "web.http",
      }).success,
    ).toBe(false);
  });
});
