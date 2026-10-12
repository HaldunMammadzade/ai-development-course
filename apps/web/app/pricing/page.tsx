import Link from "next/link";
import { PlanCards } from "@/components/billing/plan-cards";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadBillingPlans } from "@/lib/api/server";
import { copy } from "@/lib/copy";

export const dynamic = "force-dynamic";

export default async function PricingPage() {
  const plans = await readPageData(loadBillingPlans);
  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-6xl min-w-0 gap-6 overflow-x-hidden px-4 py-10 sm:px-6">
      <header className="grid gap-2">
        <p className="text-sm font-semibold text-primary">{copy.product}</p>
        <h1 className="font-serif text-4xl">{copy.billing.pricingTitle}</h1>
        <p className="max-w-2xl break-words text-muted-foreground">{copy.billing.pricingLead}</p>
      </header>
      {typeof plans === "string" ? <LoadError message={plans} /> : <PlanCards plans={plans} />}
      <Link className="text-sm font-semibold text-primary" href="/app/billing">
        {copy.billing.title}
      </Link>
    </main>
  );
}
