import { createHmac, timingSafeEqual } from "node:crypto";

export class PaymentUnavailableError extends Error {
  readonly code = "PAYMENT_UNAVAILABLE";

  constructor() {
    super("Payment is temporarily unavailable.");
    this.name = "PaymentUnavailableError";
  }
}

export interface PaymentCheckoutRequest {
  customerId: string;
  providerPriceId: string;
  checkoutId: string;
}

export interface PaymentCheckoutResult {
  providerCheckoutId: string;
  url: string;
}

export interface PaymentProvider {
  readonly id: string;
  createCheckoutSession(input: PaymentCheckoutRequest): Promise<PaymentCheckoutResult>;
  verifyWebhook(raw: Buffer, signature: string | undefined): boolean;
  createPortalSession(): Promise<string | null>;
}

export function signWebhook(secret: string, raw: Buffer): string {
  return createHmac("sha256", secret).update(raw).digest("hex");
}

export function signaturesMatch(expected: string, received: string): boolean {
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export class DisabledPaymentProvider implements PaymentProvider {
  readonly id = "disabled";

  createCheckoutSession(): Promise<PaymentCheckoutResult> {
    return Promise.reject(new PaymentUnavailableError());
  }

  verifyWebhook(): boolean {
    return false;
  }

  createPortalSession(): Promise<string | null> {
    return Promise.resolve(null);
  }
}

export class FakePaymentProvider implements PaymentProvider {
  readonly id = "fake";
  calls = 0;

  constructor(private readonly webhookSecret: string) {}

  createCheckoutSession(input: PaymentCheckoutRequest): Promise<PaymentCheckoutResult> {
    this.calls += 1;
    return Promise.resolve({
      providerCheckoutId: `cs_${input.checkoutId}`,
      url: `https://payments.test/checkout/${input.checkoutId}`,
    });
  }

  verifyWebhook(raw: Buffer, signature: string | undefined): boolean {
    if (signature === undefined || signature.length === 0) {
      return false;
    }
    return signaturesMatch(signWebhook(this.webhookSecret, raw), signature);
  }

  createPortalSession(): Promise<string | null> {
    return Promise.resolve(null);
  }
}
