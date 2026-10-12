import { describe, expect, it } from "vitest";
import {
  emailSchema,
  isIanaTimeZone,
  loginSchema,
  passwordSchema,
  registerRequestSchema,
  registrationSchema,
} from "./identity";

describe("emailSchema", () => {
  it("accepts and normalizes a valid email", () => {
    expect(emailSchema.parse("  Ada@Example.com ")).toBe("ada@example.com");
  });

  it("rejects an invalid email", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("accepts a password that meets the policy", () => {
    expect(passwordSchema.parse("correct horse battery")).toBe("correct horse battery");
  });

  it("rejects a password that is too short", () => {
    const result = passwordSchema.safeParse("short");
    expect(result.success).toBe(false);
  });

  it("rejects a password that is too long", () => {
    const result = passwordSchema.safeParse("a".repeat(129));
    expect(result.success).toBe(false);
  });

  it("rejects a common password", () => {
    const result = passwordSchema.safeParse("password123");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.message === "Password is too common.")).toBe(
        true,
      );
      expect(JSON.stringify(result.error.issues)).not.toContain("password123");
    }
  });
});

describe("registration and login schemas", () => {
  it("accepts registration input", () => {
    expect(
      registrationSchema.parse({
        email: "Ada@Example.com",
        password: "correct horse battery",
      }),
    ).toEqual({
      email: "ada@example.com",
      password: "correct horse battery",
    });
  });

  it("rejects registration with a weak password", () => {
    expect(
      registrationSchema.safeParse({ email: "ada@example.com", password: "password123" }).success,
    ).toBe(false);
  });

  it("accepts a login password without applying the strength policy", () => {
    expect(loginSchema.parse({ email: "ada@example.com", password: "password123" })).toEqual({
      email: "ada@example.com",
      password: "password123",
    });
  });

  it("rejects an empty login password", () => {
    expect(loginSchema.safeParse({ email: "ada@example.com", password: "" }).success).toBe(false);
  });
});

describe("registerRequestSchema", () => {
  it("normalizes email and applies defaults by omission", () => {
    expect(
      registerRequestSchema.parse({
        email: " Ada@Example.com ",
        password: "correct horse battery",
        name: " Aysel ",
      }),
    ).toEqual({
      email: "ada@example.com",
      password: "correct horse battery",
      name: "Aysel",
    });
  });

  it("rejects an invalid timezone and an unknown key", () => {
    expect(isIanaTimeZone("Asia/Baku")).toBe(true);
    expect(isIanaTimeZone("Not/AZone")).toBe(false);
    expect(
      registerRequestSchema.safeParse({
        email: "ada@example.com",
        password: "correct horse battery",
        name: "Aysel",
        timezone: "Not/AZone",
      }).success,
    ).toBe(false);
    expect(
      registerRequestSchema.safeParse({
        email: "ada@example.com",
        password: "correct horse battery",
        name: "Aysel",
        extra: true,
      }).success,
    ).toBe(false);
  });
});
