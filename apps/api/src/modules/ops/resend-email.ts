import type { EmailConfig } from "@platform/config";
import type { EmailProvider, OutboundEmail } from "./email-provider";
import { JobError } from "./ops.tokens";

export class ResendEmailProvider implements EmailProvider {
  readonly delivers = true;
  readonly id: string;

  constructor(private readonly config: EmailConfig) {
    this.id = config.provider;
  }

  async send(message: OutboundEmail): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(new URL("/emails", this.config.baseUrl), {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/json",
          "idempotency-key": message.idempotencyKey,
        },
        body: JSON.stringify({
          from: `${this.config.fromName} <${this.config.fromAddress}>`,
          to: [message.to],
          subject: message.subject,
          text: message.text,
        }),
        signal: controller.signal,
      });
      if (response.ok) {
        return;
      }
      const permanent =
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 408 &&
        response.status !== 429;
      throw new JobError(permanent ? "EMAIL_REJECTED" : "EMAIL_TRANSIENT", permanent);
    } catch (error) {
      if (error instanceof JobError) {
        throw error;
      }
      throw new JobError("EMAIL_TRANSIENT", false);
    } finally {
      clearTimeout(timer);
    }
  }
}
