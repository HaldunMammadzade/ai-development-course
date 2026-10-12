import type { ReactNode } from "react";
import type { BillingFeatures, BillingPlan } from "@/lib/billing/view";
import { formatPlanPrice } from "@/lib/billing/view";
import { copy } from "@/lib/copy";

const featureKeys = ["codeReview", "projects", "interviews", "speaking", "strongModel"] as const;

export function PlanCards({
  plans,
  currentPlan,
  action,
}: {
  plans: BillingPlan[];
  currentPlan?: string;
  action?: (plan: BillingPlan) => ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => (
        <article
          key={plan.slug}
          className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-4"
        >
          <header className="grid gap-1">
            <h2 className="font-serif text-2xl">{plan.name}</h2>
            <p className="text-sm font-semibold">
              {plan.amountMinor === 0
                ? copy.billing.free
                : formatPlanPrice(plan.amountMinor, plan.currency)}
              {plan.amountMinor === 0 ? "" : ` / ${copy.billing.month}`}
            </p>
            <p className="break-words text-sm text-muted-foreground">{plan.description}</p>
          </header>
          <ul className="grid gap-1 text-sm">
            {featureKeys.map((key) => (
              <li key={key}>
                {copy.billing.features[key]}: {label(plan.features, key)}
              </li>
            ))}
          </ul>
          {currentPlan === plan.plan ? (
            <p className="text-sm font-semibold">{copy.billing.currentAction}</p>
          ) : null}
          {action?.(plan)}
        </article>
      ))}
    </div>
  );
}

function label(features: BillingFeatures, key: (typeof featureKeys)[number]): string {
  return features[key] ? copy.billing.included : copy.billing.excluded;
}
