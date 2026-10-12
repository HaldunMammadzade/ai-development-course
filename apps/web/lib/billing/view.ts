export interface BillingFeatures {
  codeReview: boolean;
  projects: boolean;
  interviews: boolean;
  speaking: boolean;
  strongModel: boolean;
}

export interface BillingPlan {
  slug: string;
  plan: string;
  name: string;
  description: string;
  amountMinor: number;
  currency: string;
  interval: string;
  features: BillingFeatures;
}

export interface BillingSubscription {
  plan: string;
  name: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  features: BillingFeatures;
}

export function readPlans(value: unknown): BillingPlan[] | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !Array.isArray((value as { plans?: unknown }).plans)
  ) {
    return null;
  }
  const plans: BillingPlan[] = [];
  for (const item of (value as { plans: unknown[] }).plans) {
    const plan = readPlan(item);
    if (plan === null) {
      return null;
    }
    plans.push(plan);
  }
  return plans;
}

export function readSubscription(value: unknown): BillingSubscription | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const subscription = (value as { subscription?: unknown }).subscription;
  if (typeof subscription !== "object" || subscription === null) {
    return null;
  }
  const row = subscription as Record<string, unknown>;
  const features = readFeatures(row.features);
  if (
    typeof row.plan !== "string" ||
    typeof row.name !== "string" ||
    typeof row.status !== "string" ||
    typeof row.cancelAtPeriodEnd !== "boolean" ||
    features === null
  ) {
    return null;
  }
  return {
    plan: row.plan,
    name: row.name,
    status: row.status,
    currentPeriodEnd: typeof row.currentPeriodEnd === "string" ? row.currentPeriodEnd : null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    features,
  };
}

function readPlan(value: unknown): BillingPlan | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const row = value as Record<string, unknown>;
  const features = readFeatures(row.features);
  if (
    typeof row.slug !== "string" ||
    typeof row.plan !== "string" ||
    typeof row.name !== "string" ||
    typeof row.description !== "string" ||
    typeof row.amountMinor !== "number" ||
    typeof row.currency !== "string" ||
    typeof row.interval !== "string" ||
    features === null
  ) {
    return null;
  }
  return {
    slug: row.slug,
    plan: row.plan,
    name: row.name,
    description: row.description,
    amountMinor: row.amountMinor,
    currency: row.currency,
    interval: row.interval,
    features,
  };
}

function readFeatures(value: unknown): BillingFeatures | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.codeReview !== "boolean" ||
    typeof row.projects !== "boolean" ||
    typeof row.interviews !== "boolean" ||
    typeof row.speaking !== "boolean" ||
    typeof row.strongModel !== "boolean"
  ) {
    return null;
  }
  return {
    codeReview: row.codeReview,
    projects: row.projects,
    interviews: row.interviews,
    speaking: row.speaking,
    strongModel: row.strongModel,
  };
}

export function formatPlanPrice(amountMinor: number, currency: string): string {
  const amount = (amountMinor / 100).toFixed(2);
  return `${amount} ${currency}`;
}
