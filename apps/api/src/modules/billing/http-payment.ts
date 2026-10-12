import type { PaymentConfig } from "@platform/config";
import {
  PaymentUnavailableError,
  signaturesMatch,
  signWebhook,
  type PaymentCheckoutRequest,
  type PaymentCheckoutResult,
  type PaymentProvider,
} from "./payment-provider";

export class HttpPaymentProvider implements PaymentProvider {
  readonly id: string;

  constructor(private readonly config: PaymentConfig) {
    this.id = config.provider;
  }

  async createCheckoutSession(input: PaymentCheckoutRequest): Promise<PaymentCheckoutResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await fetch(`${this.config.baseUrl}/checkout/sessions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.config.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          customerId: input.customerId,
          priceId: input.providerPriceId,
          checkoutId: input.checkoutId,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new PaymentUnavailableError();
      }
      const body: unknown = await response.json();
      if (
        typeof body !== "object" ||
        body === null ||
        typeof (body as { id?: unknown }).id !== "string" ||
        typeof (body as { url?: unknown }).url !== "string"
      ) {
        throw new PaymentUnavailableError();
      }
      return {
        providerCheckoutId: (body as { id: string }).id,
        url: (body as { url: string }).url,
      };
    } catch (error) {
      if (error instanceof PaymentUnavailableError) {
        throw error;
      }
      throw new PaymentUnavailableError();
    } finally {
      clearTimeout(timer);
    }
  }

  verifyWebhook(raw: Buffer, signature: string | undefined): boolean {
    if (signature === undefined) {
      return false;
    }
    return signaturesMatch(signWebhook(this.config.webhookSecret, raw), signature);
  }

  createPortalSession(): Promise<string | null> {
    return Promise.resolve(null);
  }
}
