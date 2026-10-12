import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { entitlementRank, parseEntitlements, subscriptionGrantsAccess } from "./entitlement";
import { readCommercialPlan } from "./commercial-access";

export class BillingRuleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "BillingRuleError";
  }
}

export interface PublicPlanPrice {
  slug: string;
  plan: string;
  name: string;
  description: string;
  amountMinor: number;
  currency: string;
  interval: string;
  features: {
    codeReview: boolean;
    projects: boolean;
    interviews: boolean;
    speaking: boolean;
    strongModel: boolean;
  };
}

export interface SubscriptionView {
  plan: string;
  name: string;
  status: "none" | "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "expired";
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  features: PublicPlanPrice["features"];
}

export interface CheckoutView {
  status: "pending" | "scheduled";
  url: string | null;
}

export interface VerifiedPaymentEvent {
  id: string;
  type: "subscription.upsert" | "payment.failed";
  occurredAt: Date;
  checkoutId?: string;
  subscriptionId: string;
  customerId: string;
  providerPriceId: string;
  status: "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "expired";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  userId: string;
}

export interface BillingRepository {
  listPlans(): Promise<PublicPlanPrice[]>;
  subscription(userId: string, now: Date): Promise<SubscriptionView>;
  checkout(input: {
    userId: string;
    priceSlug: string;
    clientCheckoutId: string;
    now: Date;
    provider: string;
    openCheckout: (input: {
      customerId: string;
      providerPriceId: string;
      checkoutId: string;
    }) => Promise<{ providerCheckoutId: string; url: string }>;
  }): Promise<CheckoutView>;
  cancel(userId: string, now: Date): Promise<SubscriptionView>;
  reactivate(userId: string, now: Date): Promise<SubscriptionView>;
  applyEvent(
    provider: string,
    event: VerifiedPaymentEvent,
    now: Date,
  ): Promise<"processed" | "ignored" | "duplicate">;
  reconcile(userId: string, now: Date): Promise<void>;
  disconnect(): Promise<void>;
}

export function createBillingRepository(databaseUrl: string): BillingRepository {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  return new PrismaBillingRepository(prisma);
}

class PrismaBillingRepository implements BillingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listPlans(): Promise<PublicPlanPrice[]> {
    const prices = await this.prisma.planPrice.findMany({
      where: { active: true, plan: { active: true } },
      include: { plan: true },
      orderBy: { amountMinor: "asc" },
    });
    return prices.map(toPublicPrice);
  }

  async subscription(userId: string, now: Date): Promise<SubscriptionView> {
    return this.prisma.$transaction(async (tx) => viewFor(tx, userId, now));
  }

  async checkout(input: {
    userId: string;
    priceSlug: string;
    clientCheckoutId: string;
    now: Date;
    provider: string;
    openCheckout: (input: {
      customerId: string;
      providerPriceId: string;
      checkoutId: string;
    }) => Promise<{ providerCheckoutId: string; url: string }>;
  }): Promise<CheckoutView> {
    const existing = await this.prisma.checkoutSession.findUnique({
      where: {
        userId_clientCheckoutId: { userId: input.userId, clientCheckoutId: input.clientCheckoutId },
      },
    });
    if (existing !== null && existing.checkoutUrl.length > 0) {
      return { status: "pending", url: existing.checkoutUrl };
    }
    const price = await this.prisma.planPrice.findUnique({
      where: { slug: input.priceSlug },
      include: { plan: true },
    });
    if (
      price === null ||
      !price.active ||
      !price.plan.active ||
      price.amountMinor <= 0 ||
      price.providerPriceId === null
    ) {
      throw new BillingRuleError(400, "VALIDATION", "That price is not available.");
    }
    await this.reconcile(input.userId, input.now);
    const current = await this.prisma.subscription.findUnique({
      where: { userId: input.userId },
      include: { price: true },
    });
    if (
      current !== null &&
      subscriptionGrantsAccess({
        status: current.status,
        cancelAtPeriodEnd: current.cancelAtPeriodEnd,
        currentPeriodEnd: current.currentPeriodEnd,
        now: input.now,
      }) &&
      current.price.planCode === price.planCode
    ) {
      throw new BillingRuleError(409, "SUBSCRIPTION_ACTIVE", "That plan is already active.");
    }
    if (
      current !== null &&
      subscriptionGrantsAccess({
        status: current.status,
        cancelAtPeriodEnd: current.cancelAtPeriodEnd,
        currentPeriodEnd: current.currentPeriodEnd,
        now: input.now,
      }) &&
      entitlementRank(price.planCode) < entitlementRank(current.price.planCode)
    ) {
      await this.prisma.subscription.update({
        where: { id: current.id },
        data: { cancelAtPeriodEnd: true, scheduledPriceId: price.id },
      });
      return { status: "scheduled", url: null };
    }
    const customer = await this.prisma.paymentCustomer.upsert({
      where: { userId: input.userId },
      create: {
        userId: input.userId,
        provider: input.provider,
        providerCustomerId: `cus_${input.userId.replaceAll("-", "")}`,
      },
      update: {},
    });
    let session = existing;
    if (session === null) {
      session = await this.prisma.checkoutSession
        .create({
          data: {
            userId: input.userId,
            clientCheckoutId: input.clientCheckoutId,
            priceId: price.id,
            provider: input.provider,
            status: "pending",
          },
        })
        .catch(async (error: unknown) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return this.prisma.checkoutSession.findUniqueOrThrow({
              where: {
                userId_clientCheckoutId: {
                  userId: input.userId,
                  clientCheckoutId: input.clientCheckoutId,
                },
              },
            });
          }
          throw error;
        });
    }
    if (session.checkoutUrl.length > 0) {
      return { status: "pending", url: session.checkoutUrl };
    }
    const opened = await input.openCheckout({
      customerId: customer.providerCustomerId,
      providerPriceId: price.providerPriceId,
      checkoutId: session.id,
    });
    await this.prisma.checkoutSession.update({
      where: { id: session.id },
      data: { providerCheckoutId: opened.providerCheckoutId, checkoutUrl: opened.url },
    });
    return { status: "pending", url: opened.url };
  }

  async cancel(userId: string, now: Date): Promise<SubscriptionView> {
    const current = await this.prisma.subscription.findUnique({ where: { userId } });
    if (
      current === null ||
      !subscriptionGrantsAccess({
        status: current.status,
        cancelAtPeriodEnd: current.cancelAtPeriodEnd,
        currentPeriodEnd: current.currentPeriodEnd,
        now,
      })
    ) {
      throw new BillingRuleError(
        409,
        "SUBSCRIPTION_CLOSED",
        "There is no paid subscription to cancel.",
      );
    }
    await this.prisma.subscription.update({
      where: { id: current.id },
      data: { cancelAtPeriodEnd: true },
    });
    return this.subscription(userId, now);
  }

  async reactivate(userId: string, now: Date): Promise<SubscriptionView> {
    const current = await this.prisma.subscription.findUnique({ where: { userId } });
    if (current === null || !current.cancelAtPeriodEnd) {
      throw new BillingRuleError(409, "SUBSCRIPTION_CLOSED", "There is no scheduled cancellation.");
    }
    if (current.currentPeriodEnd !== null && current.currentPeriodEnd.getTime() <= now.getTime()) {
      throw new BillingRuleError(409, "SUBSCRIPTION_CLOSED", "There is no scheduled cancellation.");
    }
    await this.prisma.subscription.update({
      where: { id: current.id },
      data: { cancelAtPeriodEnd: false, scheduledPriceId: null },
    });
    return this.subscription(userId, now);
  }

  async applyEvent(
    provider: string,
    event: VerifiedPaymentEvent,
    now: Date,
  ): Promise<"processed" | "ignored" | "duplicate"> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.paymentEvent.findUnique({
        where: { provider_providerEventId: { provider, providerEventId: event.id } },
      });
      if (existing !== null && existing.status !== "failed") {
        return "duplicate";
      }
      if (existing === null) {
        try {
          await tx.paymentEvent.create({
            data: {
              provider,
              providerEventId: event.id,
              eventType: event.type,
              occurredAt: event.occurredAt,
              status: "processing",
            },
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            return "duplicate";
          }
          throw error;
        }
      }
      const checkout =
        event.checkoutId === undefined
          ? null
          : await tx.checkoutSession.findFirst({ where: { id: event.checkoutId, provider } });
      const subscription = await tx.subscription.findFirst({
        where: { providerSubscriptionId: event.subscriptionId },
      });
      const ownerId = checkout?.userId ?? subscription?.userId ?? null;
      if (ownerId === null || ownerId !== event.userId) {
        await tx.paymentEvent.update({
          where: { provider_providerEventId: { provider, providerEventId: event.id } },
          data: { status: "failed", processedAt: now },
        });
        throw new BillingRuleError(400, "VALIDATION", "The payment event could not be applied.");
      }
      if (
        subscription !== null &&
        subscription.lastEventAt !== null &&
        event.occurredAt.getTime() < subscription.lastEventAt.getTime()
      ) {
        await tx.paymentEvent.update({
          where: { provider_providerEventId: { provider, providerEventId: event.id } },
          data: { status: "ignored", processedAt: now },
        });
        return "ignored";
      }
      const price = await tx.planPrice.findUnique({
        where: { providerPriceId: event.providerPriceId },
      });
      if (price === null) {
        await tx.paymentEvent.update({
          where: { provider_providerEventId: { provider, providerEventId: event.id } },
          data: { status: "failed", processedAt: now },
        });
        throw new BillingRuleError(400, "VALIDATION", "The payment event could not be applied.");
      }
      const status = event.type === "payment.failed" ? "past_due" : event.status;
      await tx.subscription.upsert({
        where: { userId: ownerId },
        create: {
          userId: ownerId,
          provider,
          providerCustomerId: event.customerId,
          providerSubscriptionId: event.subscriptionId,
          priceId: price.id,
          status,
          currentPeriodStart: event.currentPeriodStart,
          currentPeriodEnd: event.currentPeriodEnd,
          cancelAtPeriodEnd: event.cancelAtPeriodEnd,
          lastEventAt: event.occurredAt,
        },
        update: {
          providerCustomerId: event.customerId,
          providerSubscriptionId: event.subscriptionId,
          priceId: price.id,
          status,
          currentPeriodStart: event.currentPeriodStart,
          currentPeriodEnd: event.currentPeriodEnd,
          cancelAtPeriodEnd: event.cancelAtPeriodEnd,
          canceledAt: status === "canceled" ? now : null,
          lastEventAt: event.occurredAt,
        },
      });
      if (checkout !== null) {
        await tx.checkoutSession.update({
          where: { id: checkout.id },
          data: { status: "completed" },
        });
      }
      const grants = subscriptionGrantsAccess({
        status,
        cancelAtPeriodEnd: event.cancelAtPeriodEnd,
        currentPeriodEnd: event.currentPeriodEnd,
        now,
      });
      await tx.userPlan.updateMany({
        where: { userId: ownerId },
        data: grants
          ? {
              planCode: price.planCode,
              status: "active",
              periodStart: event.currentPeriodStart,
              periodEnd: event.currentPeriodEnd,
            }
          : { planCode: "free", status: "active" },
      });
      await tx.paymentEvent.update({
        where: { provider_providerEventId: { provider, providerEventId: event.id } },
        data: { status: "processed", processedAt: now },
      });
      return "processed";
    });
  }

  async reconcile(userId: string, now: Date): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await readCommercialPlan(tx, userId, now);
    });
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

function toPublicPrice(price: {
  slug: string;
  currency: string;
  amountMinor: number;
  billingInterval: string;
  plan: { code: string; name: string; description: string; entitlements: Prisma.JsonValue };
}): PublicPlanPrice {
  const entitlements = parseEntitlements(price.plan.entitlements);
  return {
    slug: price.slug,
    plan: price.plan.code,
    name: price.plan.name,
    description: price.plan.description,
    amountMinor: price.amountMinor,
    currency: price.currency,
    interval: price.billingInterval,
    features: {
      codeReview: entitlements.codeReview,
      projects: entitlements.projects,
      interviews: entitlements.interviews,
      speaking: entitlements.speaking,
      strongModel: entitlements.strongModel,
    },
  };
}

async function viewFor(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<SubscriptionView> {
  const plan = await readCommercialPlan(tx, userId, now);
  const subscription = await tx.subscription.findUnique({ where: { userId } });
  const code = plan?.code ?? "free";
  const row = await tx.plan.findUnique({ where: { code: code as "free" } });
  const entitlements = parseEntitlements(row?.entitlements);
  const grants =
    subscription !== null &&
    subscriptionGrantsAccess({
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
      now,
    });
  return {
    plan: code,
    name: row?.name ?? "Free",
    status:
      subscription === null
        ? "none"
        : grants || subscription.status === "incomplete"
          ? subscription.status
          : "expired",
    currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
    features: {
      codeReview: entitlements.codeReview,
      projects: entitlements.projects,
      interviews: entitlements.interviews,
      speaking: entitlements.speaking,
      strongModel: entitlements.strongModel,
    },
  };
}
