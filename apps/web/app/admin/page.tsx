import { LoadError } from "@/components/ui/load-error";
import { MetricGrid, WindowLinks } from "@/components/admin/admin-shell";
import { readPageData } from "@/lib/api/page-data";
import { adminWindow, loadAdmin } from "@/lib/admin/server";
import { display, metrics, readList, readNumber, readRecord, readText } from "@/lib/admin/read";
import { copy } from "@/lib/copy";

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const params = await searchParams;
  const window = adminWindow(params.window);
  const loaded = await readPageData(() => loadAdmin(`/api/v1/admin/overview?window=${window}`));
  if (typeof loaded === "string") {
    return <LoadError message={loaded} />;
  }
  const body = readRecord(loaded);
  const students = readRecord(body?.students);
  const learning = readRecord(body?.learning);
  const ai = readRecord(body?.ai);
  const billing = readRecord(body?.billing);
  const plans = readRecord(billing?.plans);
  const subscriptions = readRecord(billing?.subscriptions);
  if (students === null || learning === null || ai === null || plans === null) {
    return <LoadError message={copy.admin.failed} />;
  }
  const funnel = readList(body?.funnel) ?? [];
  return (
    <>
      <WindowLinks path="/admin" current={window} />
      <section className="space-y-3">
        <h2 className="font-serif text-2xl">{copy.admin.students}</h2>
        <MetricGrid
          items={metrics([
            ["Qeydiyyat", students.registered],
            ["Təsdiqlənmiş", students.verified],
            ["Təsdiqlənməmiş", students.unverified],
            ["Aktiv", students.active],
          ])}
        />
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="font-serif text-2xl">{copy.admin.learning}</h2>
        <MetricGrid
          items={metrics([
            ["Dərs başladı", learning.lessonsStarted],
            ["Dərs bitdi", learning.lessonsCompleted],
            ["Məşq cəhdi", learning.exercisesAttempted],
            ["Məşq keçdi", learning.exercisesPassed],
            ["Layihə başladı", learning.projectsStarted],
            ["Layihə bitdi", learning.projectsCompleted],
            ["Müsahibə bitdi", learning.interviewsCompleted],
            ["Danışıq cəhdi", learning.speakingAttempts],
          ])}
        />
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="font-serif text-2xl">{copy.admin.ai}</h2>
        <MetricGrid
          items={metrics([
            ["Müəllim", ai.teach],
            ["Kod rəyi", ai.codeReview],
            ["Layihə rəyi", ai.projectReview],
            ["Müsahibə", ai.interview],
            ["Danışıq", ai.speaking],
            ["Token", ai.totalTokens],
            ["costMicros", ai.costMicros],
          ])}
        />
        <p className="text-sm text-muted-foreground">{copy.admin.storedCost}</p>
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="font-serif text-2xl">{copy.admin.billing}</h2>
        <MetricGrid
          items={metrics([
            ["Free", plans.free],
            ["Starter", plans.starter],
            ["Pro", plans.pro],
            ["Premium", plans.premium],
            ["Aktiv abunə", subscriptions?.active],
            ["Ləğv", subscriptions?.canceled],
            ["past_due", subscriptions?.pastDue],
          ])}
        />
        <Revenue billing={billing} />
      </section>
      <section className="mt-8 space-y-3">
        <h2 className="font-serif text-2xl">Müşahidə olunan keçid</h2>
        <ul className="space-y-2 text-sm">
          {funnel.map((step) => {
            const row = readRecord(step);
            const rate = readNumber(row?.rate);
            return (
              <li key={readText(row?.id) ?? "step"}>
                {readText(row?.id) ?? "—"}: {display(row?.numerator)} / {display(row?.denominator)}{" "}
                ({rate === null ? "—" : `${rate}%`})
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}

function Revenue({ billing }: { billing: Record<string, unknown> | null }) {
  if (billing?.paymentConfigured !== true) {
    return <p className="text-sm">{copy.admin.paymentMissing}</p>;
  }
  const revenue = readRecord(billing.revenue);
  if (revenue === null) {
    return <p className="text-sm">{copy.admin.paymentMissing}</p>;
  }
  const amount = readNumber(revenue.amountMinor);
  return (
    <p className="text-sm">
      {copy.admin.estimatedRevenue}: {amount === null ? "—" : (amount / 100).toFixed(2)}{" "}
      {readText(revenue.currency) ?? "AZN"}
    </p>
  );
}
