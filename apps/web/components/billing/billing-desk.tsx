"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlanCards } from "@/components/billing/plan-cards";
import { apiPost } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import type { BillingPlan, BillingSubscription } from "@/lib/billing/view";
import { copy } from "@/lib/copy";

export function BillingDesk({
  plans,
  subscription,
}: {
  plans: BillingPlan[];
  subscription: BillingSubscription;
}) {
  const router = useRouter();
  const keys = useRef(new Map<string, string>());
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function choose(plan: BillingPlan): Promise<void> {
    if (plan.amountMinor <= 0) {
      return;
    }
    setPending(plan.slug);
    setMessage(null);
    const clientCheckoutId = keyFor(keys.current, plan.slug);
    try {
      const body: unknown = await apiPost("/api/v1/billing/checkout", {
        priceSlug: plan.slug,
        clientCheckoutId,
      });
      const checkout = readCheckout(body);
      if (checkout === null) {
        setMessage(copy.errors.generic);
        return;
      }
      if (checkout.status === "scheduled") {
        setMessage(copy.billing.scheduled);
        router.refresh();
        return;
      }
      if (checkout.url === null) {
        setMessage(copy.billing.pending);
        return;
      }
      window.location.assign(checkout.url);
    } catch (error) {
      setMessage(isApiError(error) ? error.message : copy.errors.generic);
    } finally {
      setPending(null);
    }
  }

  async function change(
    path: "/api/v1/billing/cancel" | "/api/v1/billing/reactivate",
  ): Promise<void> {
    setPending(path);
    setMessage(null);
    try {
      await apiPost(path, {});
      router.refresh();
    } catch (error) {
      setMessage(isApiError(error) ? error.message : copy.errors.generic);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid min-w-0 gap-6 overflow-x-hidden">
      <header className="grid gap-2">
        <h1 className="font-serif text-3xl">{copy.billing.title}</h1>
        <p className="break-words text-muted-foreground">{copy.billing.lead}</p>
      </header>
      <section className="grid gap-2 rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{copy.billing.current}</p>
        <p className="font-serif text-2xl">{subscription.name}</p>
        <p className="text-sm">{statusLabel(subscription)}</p>
        {subscription.currentPeriodEnd === null ? null : (
          <p className="text-sm text-muted-foreground">
            {copy.billing.renewal}: {subscription.currentPeriodEnd.slice(0, 10)}
          </p>
        )}
        {subscription.cancelAtPeriodEnd ? (
          <Button
            type="button"
            variant="secondary"
            disabled={pending !== null}
            onClick={() => void change("/api/v1/billing/reactivate")}
          >
            {copy.billing.reactivate}
          </Button>
        ) : subscription.status === "none" || subscription.plan === "free" ? null : (
          <Button
            type="button"
            variant="secondary"
            disabled={pending !== null}
            onClick={() => void change("/api/v1/billing/cancel")}
          >
            {copy.billing.cancel}
          </Button>
        )}
      </section>
      {message === null ? null : (
        <p role="status" className="break-words text-sm">
          {message}
        </p>
      )}
      <PlanCards
        plans={plans}
        currentPlan={subscription.plan}
        action={(plan) =>
          plan.plan === subscription.plan || plan.amountMinor <= 0 ? null : (
            <Button type="button" disabled={pending !== null} onClick={() => void choose(plan)}>
              {pending === plan.slug ? copy.auth.working : copy.billing.choose}
            </Button>
          )
        }
      />
    </div>
  );
}

function keyFor(keys: Map<string, string>, slug: string): string {
  const existing = keys.get(slug);
  if (existing !== undefined) {
    return existing;
  }
  const created = crypto.randomUUID();
  keys.set(slug, created);
  return created;
}

function readCheckout(value: unknown): { status: string; url: string | null } | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const checkout = (value as { checkout?: unknown }).checkout;
  if (typeof checkout !== "object" || checkout === null) {
    return null;
  }
  const row = checkout as { status?: unknown; url?: unknown };
  if (typeof row.status !== "string") {
    return null;
  }
  return { status: row.status, url: typeof row.url === "string" ? row.url : null };
}

function statusLabel(subscription: BillingSubscription): string {
  if (subscription.cancelAtPeriodEnd) {
    return copy.billing.canceling;
  }
  if (subscription.status === "none") {
    return copy.billing.none;
  }
  if (subscription.status === "incomplete" || subscription.status === "payment_pending") {
    return copy.billing.pending;
  }
  return subscription.status;
}
