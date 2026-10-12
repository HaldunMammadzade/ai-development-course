/**
 * @vitest-environment happy-dom
 */
import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { copy } from "@/lib/copy";
import type { BillingPlan, BillingSubscription } from "@/lib/billing/view";

const api = vi.hoisted(() => ({
  post: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/lib/api/client", () => ({
  apiPost: api.post,
}));

import { BillingDesk } from "./billing-desk";

const plans: BillingPlan[] = [
  {
    slug: "free-monthly",
    plan: "free",
    name: "Free",
    description: "Dərslər",
    amountMinor: 0,
    currency: "AZN",
    interval: "month",
    features: {
      codeReview: true,
      projects: true,
      interviews: true,
      speaking: true,
      strongModel: false,
    },
  },
  {
    slug: "pro-monthly",
    plan: "pro",
    name: "Pro",
    description: "Yüksək limit",
    amountMinor: 1990,
    currency: "AZN",
    interval: "month",
    features: {
      codeReview: true,
      projects: true,
      interviews: true,
      speaking: true,
      strongModel: true,
    },
  },
];

const subscription: BillingSubscription = {
  plan: "free",
  name: "Free",
  status: "none",
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  features: {
    codeReview: true,
    projects: true,
    interviews: true,
    speaking: true,
    strongModel: false,
  },
};

describe("BillingDesk", () => {
  let root: Root;
  let host: HTMLDivElement;

  beforeEach(() => {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    api.post.mockReset();
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it("shows the server plan and does not claim activation when payment is unavailable", async () => {
    api.post.mockRejectedValue(new ApiError(503, "PAYMENT_UNAVAILABLE"));
    await act(async () => {
      root.render(createElement(BillingDesk, { plans, subscription }));
    });
    expect(host.textContent).toContain("Free");
    expect(host.textContent).not.toContain("Pro aktiv");
    const button = [...host.querySelectorAll("button")].find(
      (item) => item.textContent === copy.billing.choose,
    );
    expect(button).toBeDefined();
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(host.textContent).toContain(copy.errors.payment);
    expect(api.post).toHaveBeenCalledTimes(1);
    const first = api.post.mock.calls[0]?.[1] as { clientCheckoutId: string };
    await act(async () => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    const second = api.post.mock.calls[1]?.[1] as { clientCheckoutId: string };
    expect(second.clientCheckoutId).toBe(first.clientCheckoutId);
    expect(JSON.stringify(api.post.mock.calls[0]?.[1])).not.toContain("amount");
  });
});
