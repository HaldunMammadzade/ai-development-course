import { JobError } from "./ops.tokens";

export interface OutboundEmail {
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}

export interface EmailProvider {
  readonly id: string;
  readonly delivers: boolean;
  send(message: OutboundEmail): Promise<void>;
}

export class FakeEmailProvider implements EmailProvider {
  readonly id = "fake";
  readonly delivers = true;
  readonly sent: OutboundEmail[] = [];
  fail: "none" | "transient" | "permanent" = "none";

  async send(message: OutboundEmail): Promise<void> {
    if (this.fail === "permanent") {
      throw new JobError("EMAIL_REJECTED", true);
    }
    if (this.fail === "transient") {
      throw new JobError("EMAIL_TRANSIENT", false);
    }
    this.sent.push(message);
  }
}

export class DisabledEmailProvider implements EmailProvider {
  readonly id = "disabled";
  readonly delivers = false;

  async send(): Promise<void> {
    throw new JobError("EMAIL_UNAVAILABLE", true);
  }
}
