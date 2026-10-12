import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { JobRepository } from "@platform/database";
import type { EmailProvider } from "./email-provider";
import { EMAIL_PROVIDER, JOB_REPOSITORY, JobError } from "./ops.tokens";
import { renderEmail, type EmailTemplateName } from "./templates";

export const EMAIL_RUNTIME = Symbol("EMAIL_RUNTIME");

export interface EmailRuntime {
  publicUrl: string;
}

const EMAIL_TEMPLATES = [
  "verification",
  "password_reset",
  "subscription_activated",
  "payment_failed",
  "subscription_canceled",
] as const;

@Injectable()
export class EmailService {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider,
    @Inject(JOB_REPOSITORY) private readonly jobs: JobRepository,
    @Inject(EMAIL_RUNTIME) private readonly runtime: EmailRuntime,
  ) {}

  get delivers(): boolean {
    return this.provider.delivers;
  }

  async queueVerification(input: {
    to: string;
    token: string;
    correlationId: string | null;
  }): Promise<"queued" | "duplicate" | "disabled"> {
    return this.queue({
      template: "verification",
      to: input.to,
      token: input.token,
      idempotencyKey: `verification:${digest(input.token)}`,
      correlationId: input.correlationId,
    });
  }

  async queuePasswordReset(input: {
    to: string;
    token: string;
    correlationId: string | null;
  }): Promise<"queued" | "duplicate" | "disabled"> {
    return this.queue({
      template: "password_reset",
      to: input.to,
      token: input.token,
      idempotencyKey: `reset:${digest(input.token)}`,
      correlationId: input.correlationId,
    });
  }

  async queueBilling(input: {
    to: string;
    template: "subscription_activated" | "payment_failed" | "subscription_canceled";
    eventId: string;
    correlationId: string | null;
  }): Promise<"queued" | "duplicate" | "disabled"> {
    return this.queue({
      template: input.template,
      to: input.to,
      idempotencyKey: `billing:${digest(input.eventId)}:${input.template}`,
      correlationId: input.correlationId,
    });
  }

  async deliver(job: { payload: unknown; idempotencyKey: string }): Promise<void> {
    const payload = readPayload(job.payload);
    if (payload === null) {
      throw new JobError("EMAIL_REJECTED", true);
    }
    const rendered = renderEmail({
      template: payload.template,
      publicUrl: this.runtime.publicUrl,
      ...(payload.token === undefined ? {} : { token: payload.token }),
    });
    if (rendered === null) {
      throw new JobError("EMAIL_CONFIG", true);
    }
    await this.provider.send({
      to: payload.to,
      subject: rendered.subject,
      text: rendered.text,
      idempotencyKey: job.idempotencyKey,
    });
  }

  private async queue(input: {
    template: EmailTemplateName;
    to: string;
    token?: string;
    idempotencyKey: string;
    correlationId: string | null;
  }): Promise<"queued" | "duplicate" | "disabled"> {
    if (!this.provider.delivers) {
      return "disabled";
    }
    return this.jobs.enqueue({
      name: "send_email",
      idempotencyKey: input.idempotencyKey,
      payload: {
        template: input.template,
        to: input.to,
        ...(input.token === undefined ? {} : { token: input.token }),
      },
      correlationId: input.correlationId,
      maxAttempts: 5,
      runAfter: new Date(),
    });
  }
}

function digest(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function readPayload(
  value: unknown,
): { template: EmailTemplateName; to: string; token?: string } | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const body = value as Record<string, unknown>;
  const template = body.template;
  const to = body.to;
  const token = body.token;
  if (typeof template !== "string" || !EMAIL_TEMPLATES.includes(template as EmailTemplateName)) {
    return null;
  }
  if (typeof to !== "string" || to.length === 0 || to.length > 320) {
    return null;
  }
  if (
    token !== undefined &&
    (typeof token !== "string" || token.length < 20 || token.length > 200)
  ) {
    return null;
  }
  return {
    template: template as EmailTemplateName,
    to,
    ...(typeof token === "string" ? { token } : {}),
  };
}
