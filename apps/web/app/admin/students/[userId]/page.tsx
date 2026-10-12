import Link from "next/link";
import { notFound } from "next/navigation";
import { LoadError } from "@/components/ui/load-error";
import { DataTable, MetricGrid } from "@/components/admin/admin-shell";
import { isApiError } from "@/lib/api/errors";
import { loadAdmin } from "@/lib/admin/server";
import { display, metrics, readList, readNumber, readRecord } from "@/lib/admin/read";
import { copy } from "@/lib/copy";

export default async function AdminStudentPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  let loaded: unknown;
  try {
    loaded = await loadAdmin(`/api/v1/admin/students/${encodeURIComponent(userId)}`);
  } catch (error) {
    if (isApiError(error) && (error.status === 404 || error.status === 401)) {
      notFound();
    }
    return <LoadError message={isApiError(error) ? error.message : copy.admin.failed} />;
  }
  const student = readRecord(readRecord(loaded)?.student);
  if (student === null) {
    return <LoadError message={copy.admin.failed} />;
  }
  const exercises = readRecord(student.exercises);
  const projects = readRecord(student.projects);
  const interviews = readRecord(student.interviews);
  const speaking = readRecord(student.speaking);
  const ai = readRecord(student.ai);
  const lessons = readList(student.lessons) ?? [];
  const mastery = readList(student.mastery) ?? [];
  return (
    <>
      <Link className="text-sm font-semibold text-primary" href="/admin/students">
        {copy.admin.back}
      </Link>
      <h2 className="mt-3 font-serif text-2xl">{display(student.name)}</h2>
      <p className="text-sm text-muted-foreground">
        {display(student.email)} · {display(student.status)} ·{" "}
        {student.verified === true ? "təsdiqli" : "təsdiqsiz"} · {display(student.plan)}
      </p>
      <p className="mt-2 text-sm">{copy.admin.noSecrets}</p>
      <div className="mt-6">
        <MetricGrid
          items={metrics([
            ["Məşq", exercises?.attempted],
            ["Keçən məşq", exercises?.passed],
            ["Layihə", projects?.started],
            ["Mərhələ", projects?.milestonesPassed],
            ["Müsahibə", interviews?.completed],
            ["Danışıq", speaking?.finished],
            ["AI token", ai?.totalTokens],
            ["AI costMicros", ai?.costMicros],
          ])}
        />
      </div>
      <section className="mt-8">
        <h3 className="mb-3 font-semibold">Dərslər</h3>
        <DataTable
          headers={["Dərs", "Status", "Saniyə"]}
          rows={lessons.flatMap((item) => {
            const row = readRecord(item);
            return row === null
              ? []
              : [[display(row.title), display(row.status), display(row.timeSpentSeconds)]];
          })}
        />
      </section>
      <section className="mt-8">
        <h3 className="mb-3 font-semibold">Konseptlər</h3>
        <DataTable
          headers={["Konsept", "Bal", "Dəlil"]}
          rows={mastery.flatMap((item) => {
            const row = readRecord(item);
            const score = readNumber(row?.score);
            return row === null
              ? []
              : [[display(row.slug), score === null ? "—" : String(score), display(row.evidence)]];
          })}
        />
      </section>
    </>
  );
}
