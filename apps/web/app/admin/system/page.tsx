import { LoadError } from "@/components/ui/load-error";
import { DataTable, WindowLinks } from "@/components/admin/admin-shell";
import { readPageData } from "@/lib/api/page-data";
import { display, readList, readRecord } from "@/lib/admin/read";
import { adminWindow, loadAdmin } from "@/lib/admin/server";
import { copy } from "@/lib/copy";

export default async function AdminSystemPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const window = adminWindow((await searchParams).window);
  const loaded = await readPageData(() => loadAdmin(`/api/v1/admin/system?window=${window}`));
  if (typeof loaded === "string") {
    return <LoadError message={loaded} />;
  }
  const failures = readList(readRecord(loaded)?.failures) ?? [];
  return (
    <>
      <WindowLinks path="/admin/system" current={window} />
      <DataTable
        headers={["Kateqoriya", "Say", "Son", "Kod"]}
        rows={failures.flatMap((item) => {
          const row = readRecord(item);
          if (row === null) {
            return [];
          }
          return [
            [
              display(row.category),
              row.recorded === true ? display(row.count) : copy.admin.notRecorded,
              display(row.lastAt),
              display(row.code),
            ],
          ];
        })}
      />
    </>
  );
}
