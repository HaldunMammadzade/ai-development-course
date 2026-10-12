import { describe, expect, it } from "vitest";
import { copy } from "@/lib/copy";
import { hasRegistrationIssues, registrationIssues } from "./registration";

describe("registration UI validation", () => {
  it("rejects an empty name, a bad email, and a short or common password", () => {
    const issues = registrationIssues({
      name: " ",
      email: "not-an-email",
      password: "short",
    });
    expect(issues.name).toBe(copy.errors.name);
    expect(issues.email).toBe(copy.errors.email);
    expect(issues.password).toBe(copy.errors.passwordShort);
    expect(hasRegistrationIssues(issues)).toBe(true);
    expect(
      registrationIssues({ name: "Aysel", email: "aysel@example.com", password: "password123" })
        .password,
    ).toBe(copy.errors.passwordCommon);
  });
});
