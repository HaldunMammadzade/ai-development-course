import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmailConfig } from "@platform/config";
import { DisabledEmailProvider, FakeEmailProvider } from "./email-provider";
import { HttpEmailProvider } from "./http-email";
import { ResendEmailProvider } from "./resend-email";
import { JobError } from "./ops.tokens";

const message = {
  to: "ada@example.com",
  subject: "E-poçtunuzu təsdiqləyin",
  text: "Keçid",
  idempotencyKey: "verification:abc",
};

const config: EmailConfig = {
  provider: "http",
  apiKey: "email-test-key",
  baseUrl: "https://mail.example.test",
  fromAddress: "noreply@example.test",
  fromName: "Müəllim",
  timeoutMs: 1000,
  publicUrl: "https://app.example.test",
};

describe("email providers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("records a fake send and refuses a disabled send", async () => {
    const fake = new FakeEmailProvider();
    await fake.send(message);
    expect(fake.sent).toEqual([message]);
    const disabled = new DisabledEmailProvider();
    expect(disabled.delivers).toBe(false);
    await expect(disabled.send()).rejects.toMatchObject({
      code: "EMAIL_UNAVAILABLE",
      permanent: true,
    });
  });

  it("classifies provider responses without exposing the API key", async () => {
    const provider = new HttpEmailProvider(config);
    const fetchMock = vi.fn<(input: URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(null, { status: 400 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(provider.send(message)).rejects.toBeInstanceOf(JobError);
    await expect(provider.send(message)).rejects.toMatchObject({
      code: "EMAIL_REJECTED",
      permanent: true,
    });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    await expect(provider.send(message)).rejects.toMatchObject({
      code: "EMAIL_TRANSIENT",
      permanent: false,
    });
    fetchMock.mockRejectedValueOnce(new Error("Bearer email-test-key"));
    try {
      await provider.send(message);
    } catch (error) {
      expect(error).toBeInstanceOf(JobError);
      expect((error as Error).message).not.toContain("email-test-key");
    }
    expect(fetchMock.mock.calls[0]?.[0]?.toString()).toBe("https://mail.example.test/messages");
    expect(JSON.stringify(fetchMock.mock.calls[0]?.[1])).toContain("email-test-key");
  });

  it("sends Resend mail to /emails and hides the provider body", async () => {
    const provider = new ResendEmailProvider({ ...config, provider: "resend", baseUrl: "https://api.resend.com" });
    const fetchMock = vi.fn<(input: URL, init?: RequestInit) => Promise<Response>>(
      async () => new Response(JSON.stringify({ id: "msg_test" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await provider.send(message);
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(url?.toString()).toBe("https://api.resend.com/emails");
    const body = JSON.parse(String(init?.body));
    expect(body.from).toBe("Müəllim <noreply@example.test>");
    expect(body.to).toEqual(["ada@example.com"]);
    expect(body.subject).toBe(message.subject);
    expect(JSON.stringify(init?.headers)).not.toContain("sk-");
    fetchMock.mockResolvedValueOnce(new Response("secret-provider-body", { status: 422 }));
    await expect(provider.send(message)).rejects.toMatchObject({
      code: "EMAIL_REJECTED",
      permanent: true,
      message: expect.not.stringContaining("secret-provider-body"),
    });
  });
});
