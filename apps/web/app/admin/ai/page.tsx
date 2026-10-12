import { LoadError } from "@/components/ui/load-error";
import { DataTable, MetricGrid, WindowLinks } from "@/components/admin/admin-shell";
import { readPageData } from "@/lib/api/page-data";
import { display, metrics, readList, readRecord } from "@/lib/admin/read";
import { adminWindow, loadAdmin } from "@/lib/admin/server";
import { copy } from "@/lib/copy";

export default async function AdminAiPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const window = adminWindow((await searchParams).window);
  const loaded = await readPageData(() => loadAdmin(`/api/v1/admin/ai?window=${window}`));
  if (typeof loaded === "string") {
    return <LoadError message={loaded} />;
  }
  const body = readRecord(loaded);
  const totals = readRecord(body?.totals);
  const speech = readRecord(body?.speech);
  if (totals === null || speech === null) {
    return <LoadError message={copy.admin.failed} />;
  }
  return (
    <>
      <WindowLinks path="/admin/ai" current={window} />
      <MetricGrid
        items={metrics([
          ["Çağırış", totals.calls],
          ["Giriş token", totals.inputTokens],
          ["Çıxış token", totals.outputTokens],
          ["costMicros", totals.costMicros],
          ["Transkripsiya", speech.calls],
          ["Müddət, ms", speech.durationMs],
          ["STT costMicros", speech.costMicros],
        ])}
      />
      <p className="mt-3 text-sm text-muted-foreground">{copy.admin.storedCost}</p>
      <p className="text-sm text-muted-foreground">{copy.admin.speechCost}</p>
      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Tapşırıq</h2>
        <GroupTable rows={readList(body?.byTask) ?? []} />
      </section>
      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Model</h2>
        <GroupTable rows={readList(body?.byModel) ?? []} />
      </section>
      <section className="mt-8">
        <h2 className="mb-3 font-semibold">Plan</h2>
        <GroupTable rows={readList(body?.byPlan) ?? []} />
      </section>
    </>
  );
}

function GroupTable({ rows }: { rows: unknown[] }) {
  return (
    <DataTable
      headers={["Açar", "Çağırış", "costMicros"]}
      rows={rows.flatMap((item) => {
        const row = readRecord(item);
        return row === null
          ? []
          : [[display(row.key), display(row.calls), display(row.costMicros)]];
      })}
    />
  );
}
