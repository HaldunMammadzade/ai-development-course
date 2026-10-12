import type { Prisma } from "./generated/prisma/client";
import { parseEntitlements, subscriptionGrantsAccess, type PlanEntitlements } from "./entitlement";

export class CommercialRuleError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CommercialRuleError";
  }
}

export interface CommercialPlan {
  code: string;
  entitlements: PlanEntitlements;
  dailyTeacherTurns: number;
  monthlyTeacherTurns: number;
  dailyStrongCalls: number;
}

export async function readCommercialPlan(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<CommercialPlan | null> {
  await reconcileSubscription(tx, userId, now);
  const row = await tx.userPlan.findUnique({
    where: { userId },
    include: { plan: true },
  });
  if (row === null || row.status !== "active" || !row.plan.active) {
    return null;
  }
  return {
    code: row.planCode,
    entitlements: parseEntitlements(row.plan.entitlements),
    dailyTeacherTurns: row.plan.dailyTeacherTurns,
    monthlyTeacherTurns: row.plan.monthlyTeacherTurns,
    dailyStrongCalls: row.plan.dailyStrongCalls,
  };
}

export function assertFeature(plan: CommercialPlan, feature: keyof PlanEntitlements): void {
  if (plan.entitlements[feature] !== true) {
    throw new CommercialRuleError(
      402,
      "FEATURE_NOT_INCLUDED",
      "This feature is not included in the current plan.",
    );
  }
}

async function reconcileSubscription(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<void> {
  const subscription = await tx.subscription.findUnique({
    where: { userId },
    include: { price: true },
  });
  if (subscription === null) {
    return;
  }
  const grants = subscriptionGrantsAccess({
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    currentPeriodEnd: subscription.currentPeriodEnd,
    now,
  });
  if (grants) {
    await tx.userPlan.updateMany({
      where: { userId, NOT: { planCode: subscription.price.planCode } },
      data: {
        planCode: subscription.price.planCode,
        status: "active",
        periodStart: subscription.currentPeriodStart ?? now,
        periodEnd: subscription.currentPeriodEnd ?? now,
      },
    });
    return;
  }
  if (subscription.status !== "expired" && subscription.status !== "incomplete") {
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { status: "expired" },
    });
  }
  await tx.userPlan.updateMany({
    where: { userId, NOT: { planCode: "free" } },
    data: { planCode: "free", status: "active" },
  });
}
