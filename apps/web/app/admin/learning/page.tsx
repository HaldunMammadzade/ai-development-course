import { LoadError } from "@/components/ui/load-error";
import { DataTable, MetricGrid, WindowLinks } from "@/components/admin/admin-shell";
import { readPageData } from "@/lib/api/page-data";
import { display, metrics, readList, readRecord, readText } from "@/lib/admin/read";
import { adminWindow, loadAdmin } from "@/lib/admin/server";
import { copy } from "@/lib/copy";

export default async function AdminLearningPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const window = adminWindow((await searchParams).window);
  const loaded = await readPageData(() => loadAdmin(`/api/v1/admin/learning?window=${window}`));
  if (typeof loaded === "string") {
    return <LoadError message={loaded} />;
  }
  const body = readRecord(loaded);
  const counts = readRecord(body?.counts);
  const highlights = readRecord(body?.highlights);
  const lessons = readList(body?.lessons) ?? [];
  const concepts = readList(body?.concepts) ?? [];
  if (counts === null) {
    return <LoadError message={copy.admin.failed} />;
  }
  return (
    <>
      <WindowLinks path="/admin/learning" current={window} />
      <MetricGrid
        items={metrics([
          ["Dərs başladı", counts.lessonsStarted],
          ["Dərs bitdi", counts.lessonsCompleted],
          ["Məşq", counts.exercisesAttempted],
          ["Keçən məşq", counts.exercisesPassed],
        ])}
      />
      <p className="mt-4 text-sm">
        Asan: {listText(highlights?.easiest)} · Çətin: {listText(highlights?.hardest)} · Düşmə:{" "}
        {listText(highlights?.highestDropOff)}
      </p>
      <section className="mt-8">
        <DataTable
          headers={["Dərs", "Başlanğıc", "Bitmə", "Nisbət", "Məşq"]}
          rows={lessons.flatMap((item) => {
            const row = readRecord(item);
            return row === null
              ? []
              : [
                  [
                    display(row.title),
                    display(row.starts),
                    display(row.completions),
                    display(row.completionRate),
                    display(row.exercisePassRate),
                  ],
                ];
          })}
        />
      </section>
      <section className="mt-8">
        <h2 className="mb-3 font-serif text-2xl">Konseptlər</h2>
        <DataTable
          headers={["Konsept", "Orta", "Zəif", "Güclü", "Dəlil"]}
          rows={concepts.flatMap((item) => {
            const row = readRecord(item);
            return row === null
              ? []
              : [
                  [
                    display(row.slug),
                    display(row.averageMastery),
                    display(row.weak),
                    display(row.strong),
                    display(row.evidence),
                  ],
                ];
          })}
        />
      </section>
    </>
  );
}

function listText(value: unknown): string {
  const list = readList(value);
  if (list === null || list.length === 0) {
    return "—";
  }
  return list.map((item) => readText(item) ?? "—").join(", ");
}
