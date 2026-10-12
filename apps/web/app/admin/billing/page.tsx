import { LoadError } from "@/components/ui/load-error";
import { MetricGrid, WindowLinks } from "@/components/admin/admin-shell";
import { readPageData } from "@/lib/api/page-data";
import { metrics, readNumber, readRecord, readText } from "@/lib/admin/read";
import { adminWindow, loadAdmin } from "@/lib/admin/server";
import { copy } from "@/lib/copy";

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const window = adminWindow((await searchParams).window);
  const loaded = await readPageData(() => loadAdmin(`/api/v1/admin/billing?window=${window}`));
  if (typeof loaded === "string") {
    return <LoadError message={loaded} />;
  }
  const body = readRecord(loaded);
  const plans = readRecord(body?.plans);
  const subscriptions = readRecord(body?.subscriptions);
  if (body === null || plans === null || subscriptions === null) {
    return <LoadError message={copy.admin.failed} />;
  }
  const revenue = readRecord(body.revenue);
  const amount = readNumber(revenue?.amountMinor);
  return (
    <>
      <WindowLinks path="/admin/billing" current={window} />
      <MetricGrid
        items={metrics([
          ["Free", plans.free],
          ["Starter", plans.starter],
          ["Pro", plans.pro],
          ["Premium", plans.premium],
          ["Aktiv", subscriptions.active],
          ["Sınaq", subscriptions.trialing],
          ["past_due", subscriptions.pastDue],
          ["Ləğv", subscriptions.canceled],
          ["Bitmiş", subscriptions.expired],
          ["Natamam", subscriptions.incomplete],
          ["Checkout", body.checkoutAttempts],
          ["Uğurlu hadisə", body.processedSubscriptionEvents],
          ["Uğursuz ödəniş", body.failedPaymentEvents],
        ])}
      />
      {body.paymentConfigured === true && revenue !== null ? (
        <p className="mt-4 text-sm">
          {copy.admin.estimatedRevenue}: {amount === null ? "—" : (amount / 100).toFixed(2)}{" "}
          {readText(revenue.currency) ?? "AZN"}
        </p>
      ) : (
        <p className="mt-4 text-sm">{copy.admin.paymentMissing}</p>
      )}
    </>
  );
}
