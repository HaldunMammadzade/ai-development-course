import { redirect } from "next/navigation";
import { BillingDesk } from "@/components/billing/billing-desk";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadBillingPlans, loadBillingSubscription, loadCurrentUser } from "@/lib/api/server";

export default async function BillingPage() {
  const user = await loadCurrentUser();
  if (user === null) {
    redirect("/login");
  }
  if (!user.emailVerified) {
    return null;
  }
  const plans = await readPageData(loadBillingPlans);
  const subscription = await readPageData(loadBillingSubscription);
  if (typeof plans === "string") {
    return <LoadError message={plans} />;
  }
  if (typeof subscription === "string") {
    return <LoadError message={subscription} />;
  }
  return <BillingDesk plans={plans} subscription={subscription} />;
}
