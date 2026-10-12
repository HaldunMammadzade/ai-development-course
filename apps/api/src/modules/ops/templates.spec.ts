import { describe, expect, it } from "vitest";
import { renderEmail } from "./templates";

const token = "a".repeat(43);

describe("transactional email", () => {
  it("renders the Azerbaijani messages with only an opaque link", () => {
    const verification = renderEmail({
      template: "verification",
      publicUrl: "https://app.example.test",
      token,
    });
    const reset = renderEmail({
      template: "password_reset",
      publicUrl: "https://app.example.test",
      token,
    });
    expect(verification?.subject).toBe("E-poçtunuzu təsdiqləyin");
    expect(verification?.text).toContain(`token=${token}`);
    expect(reset?.text).toContain("/reset-password?token=");
    for (const message of [verification, reset]) {
      expect(message?.text).not.toMatch(/Bearer |api[_-]?key|session=/i);
      expect(message?.text?.split("token=")[1]?.split("\n")[0]).toBe(token);
    }
    expect(
      renderEmail({ template: "subscription_activated", publicUrl: "https://app.example.test" })
        ?.text,
    ).toContain("aktivdir");
    expect(
      renderEmail({ template: "payment_failed", publicUrl: "https://app.example.test" })?.subject,
    ).toBe("Ödəniş alınmadı");
    expect(
      renderEmail({ template: "subscription_canceled", publicUrl: "https://app.example.test" })
        ?.text,
    ).toContain("tarixçəniz");
  });

  it("refuses a link when the token or public URL is unsafe", () => {
    expect(
      renderEmail({ template: "verification", publicUrl: "https://app.example.test" }),
    ).toBeNull();
    expect(
      renderEmail({
        template: "verification",
        publicUrl: "https://user:secret@app.example.test",
        token,
      }),
    ).toBeNull();
  });
});
