import Link from "next/link";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadAdmin } from "@/lib/admin/server";
import { display, readList, readRecord, readText } from "@/lib/admin/read";
import { copy } from "@/lib/copy";

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cursor?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  const q = (params.q ?? "").trim().slice(0, 80);
  if (q.length > 0) {
    query.set("q", q);
  }
  if (params.cursor !== undefined && params.cursor.length > 0) {
    query.set("cursor", params.cursor);
  }
  query.set("limit", "20");
  const loaded = await readPageData(() => loadAdmin(`/api/v1/admin/students?${query.toString()}`));
  if (typeof loaded === "string") {
    return <LoadError message={loaded} />;
  }
  const body = readRecord(loaded);
  const students = readList(body?.students) ?? [];
  const nextCursor = readText(body?.nextCursor);
  return (
    <>
      <form action="/admin/students" className="mb-6 flex flex-wrap gap-2" method="get">
        <input
          className="min-w-0 flex-1 rounded-md border border-border px-3 py-2"
          defaultValue={q}
          maxLength={80}
          name="q"
          placeholder={copy.admin.searchPlaceholder}
          type="search"
        />
        <button
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          type="submit"
        >
          {copy.admin.search}
        </button>
      </form>
      {students.length === 0 ? (
        <p className="text-sm text-muted-foreground">{copy.admin.empty}</p>
      ) : (
        <ul className="divide-y divide-border">
          {students.map((item) => {
            const student = readRecord(item);
            const id = readText(student?.id);
            if (student === null || id === null) {
              return null;
            }
            return (
              <li key={id} className="py-3">
                <Link className="font-semibold text-primary" href={`/admin/students/${id}`}>
                  {display(student.name)} · {display(student.email)}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {student.verified === true ? "təsdiqli" : "təsdiqsiz"} · {display(student.plan)} ·{" "}
                  {display(student.createdAt)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
      {nextCursor === null ? null : (
        <Link
          className="mt-4 inline-block text-sm font-semibold text-primary"
          href={`/admin/students?${new URLSearchParams({ ...(q.length > 0 ? { q } : {}), cursor: nextCursor, limit: "20" }).toString()}`}
        >
          {copy.admin.next}
        </Link>
      )}
    </>
  );
}
