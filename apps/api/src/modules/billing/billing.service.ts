import { randomUUID } from "node:crypto";
import { HttpException, Inject, Injectable, Logger } from "@nestjs/common";
import {
  BillingRuleError,
  type BillingRepository,
  type IdentityRepository,
  type VerifiedPaymentEvent,
} from "@platform/database";
import { paymentEventSchema } from "@platform/validation";
import { billingLogLine } from "./billing-log";
import { PaymentUnavailableError, type PaymentProvider } from "./payment-provider";
import { BILLING_REPOSITORY, PAYMENT_PROVIDER } from "./billing.tokens";
import { IDENTITY_REPOSITORY } from "../identity/identity.repository";
import { EmailService } from "../ops/email.service";

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @Inject(BILLING_REPOSITORY) private readonly billing: BillingRepository,
    @Inject(PAYMENT_PROVIDER) private readonly payments: PaymentProvider,
    @Inject(IDENTITY_REPOSITORY) private readonly users: IdentityRepository,
    @Inject(EmailService) private readonly mail: EmailService,
  ) {}

  plans() {
    return this.billing.listPlans();
  }

  subscription(userId: string) {
    return this.guard(() => this.billing.subscription(userId, new Date()));
  }

  checkout(userId: string, priceSlug: string, clientCheckoutId: string) {
    return this.guard(() =>
      this.billing.checkout({
        userId,
        priceSlug,
        clientCheckoutId,
        now: new Date(),
        provider: this.payments.id,
        openCheckout: (input) => this.payments.createCheckoutSession(input),
      }),
    );
  }

  cancel(userId: string) {
    return this.guard(() => this.billing.cancel(userId, new Date()));
  }

  reactivate(userId: string) {
    return this.guard(() => this.billing.reactivate(userId, new Date()));
  }

  async portal(): Promise<{ url: string }> {
    const url = await this.payments.createPortalSession();
    if (url === null) {
      throw paymentUnavailable();
    }
    return { url };
  }

  async webhook(
    raw: Buffer,
    signature: string | undefined,
    correlationId: string = randomUUID(),
  ): Promise<{ received: true }> {
    const started = Date.now();
    if (!this.payments.verifyWebhook(raw, signature)) {
      this.logger.log(
        billingLogLine({
          correlationId,
          provider: this.payments.id,
          eventType: "webhook",
          status: "rejected",
          durationMs: Date.now() - started,
        }),
      );
      throw new HttpException(
        { code: "PAYMENT_SIGNATURE", message: "The payment event was rejected." },
        401,
      );
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString("utf8")) as unknown;
    } catch {
      throw new HttpException(
        { code: "VALIDATION", message: "The payment event was rejected." },
        400,
      );
    }
    const event = paymentEventSchema.safeParse(parsed);
    if (!event.success) {
      throw new HttpException(
        { code: "VALIDATION", message: "The payment event was rejected." },
        400,
      );
    }
    const verified: VerifiedPaymentEvent = {
      id: event.data.id,
      type: event.data.type,
      occurredAt: new Date(event.data.occurredAt),
      checkoutId: event.data.data.checkoutId,
      subscriptionId: event.data.data.subscriptionId,
      customerId: event.data.data.customerId,
      providerPriceId: event.data.data.providerPriceId,
      status: event.data.data.status,
      currentPeriodStart: new Date(event.data.data.currentPeriodStart),
      currentPeriodEnd: new Date(event.data.data.currentPeriodEnd),
      cancelAtPeriodEnd: event.data.data.cancelAtPeriodEnd,
      userId: event.data.data.userId,
    };
    const result = await this.guard(() =>
      this.billing.applyEvent(this.payments.id, verified, new Date()),
    );
    if (result === "processed" || result === "duplicate") {
      await this.notifyBilling(verified, correlationId);
    }
    this.logger.log(
      billingLogLine({
        correlationId,
        provider: this.payments.id,
        eventType: verified.type,
        status: result,
        durationMs: Date.now() - started,
      }),
    );
    return { received: true };
  }

  private async notifyBilling(event: VerifiedPaymentEvent, correlationId: string): Promise<void> {
    const template = billingTemplate(event);
    if (template === null || !this.mail.delivers) {
      return;
    }
    const user = await this.users.findUserById(event.userId);
    if (user === null) {
      return;
    }
    await this.mail.queueBilling({
      to: user.email,
      template,
      eventId: event.id,
      correlationId,
    });
  }

  private async guard<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof BillingRuleError) {
        throw new HttpException({ code: error.code, message: error.message }, error.status);
      }
      if (error instanceof PaymentUnavailableError) {
        throw paymentUnavailable();
      }
      throw error;
    }
  }
}

function billingTemplate(
  event: VerifiedPaymentEvent,
): "subscription_activated" | "payment_failed" | "subscription_canceled" | null {
  if (event.type === "payment.failed") {
    return "payment_failed";
  }
  if (event.status === "canceled") {
    return "subscription_canceled";
  }
  if (event.status === "active" || event.status === "trialing") {
    return "subscription_activated";
  }
  return null;
}

function paymentUnavailable(): HttpException {
  return new HttpException(
    { code: "PAYMENT_UNAVAILABLE", message: "Payment is temporarily unavailable." },
    503,
  );
}
