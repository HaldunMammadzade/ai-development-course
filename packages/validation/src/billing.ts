import { z } from "zod";

export const billingCheckoutSchema = z.strictObject({
  priceSlug: z.string().trim().min(1).max(80),
  clientCheckoutId: z.uuid(),
});

export const billingEmptySchema = z.strictObject({});

export const paymentEventSchema = z.strictObject({
  id: z.string().trim().min(8).max(120),
  type: z.enum(["subscription.upsert", "payment.failed"]),
  occurredAt: z.iso.datetime(),
  data: z.strictObject({
    checkoutId: z.uuid().optional(),
    subscriptionId: z.string().trim().min(1).max(120),
    customerId: z.string().trim().min(1).max(120),
    providerPriceId: z.string().trim().min(1).max(120),
    status: z.enum(["incomplete", "trialing", "active", "past_due", "canceled", "expired"]),
    currentPeriodStart: z.iso.datetime(),
    currentPeriodEnd: z.iso.datetime(),
    cancelAtPeriodEnd: z.boolean(),
    userId: z.uuid(),
  }),
});
