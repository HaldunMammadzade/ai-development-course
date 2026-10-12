import Link from "next/link";
import type { ReactNode } from "react";
import { copy } from "@/lib/copy";

const links = [
  ["/admin", copy.admin.overview],
  ["/admin/students", copy.admin.students],
  ["/admin/learning", copy.admin.learning],
  ["/admin/ai", copy.admin.ai],
  ["/admin/billing", copy.admin.billing],
  ["/admin/system", copy.admin.system],
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-6xl px-4 py-6 sm:px-6">
      <header className="border-b border-border pb-4">
        <p className="text-sm text-muted-foreground">{copy.product}</p>
        <h1 className="font-serif text-3xl">{copy.admin.title}</h1>
        <nav className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {links.map(([href, label]) => (
            <Link key={href} className="font-semibold text-primary" href={href}>
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="min-w-0 py-6">{children}</div>
    </div>
  );
}

export function WindowLinks({ path, current }: { path: string; current: string }) {
  const items = [
    ["today", copy.admin.today],
    ["7d", copy.admin.week],
    ["30d", copy.admin.month],
  ] as const;
  return (
    <nav className="mb-6 flex flex-wrap gap-2">
      {items.map(([id, label]) => (
        <Link
          key={id}
          className={`rounded-full border px-3 py-1 text-sm ${current === id ? "border-primary font-semibold" : "border-border"}`}
          href={`${path}?window=${id}`}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function MetricGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.admin.empty}</p>;
  }
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-border p-3">
          <dt className="text-sm text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 text-2xl font-semibold">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{copy.admin.empty}</p>;
  }
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border">
            {headers.map((header) => (
              <th key={header} className="px-2 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row[0] ?? "row"}-${index}`} className="border-b border-border">
              {row.map((cell, cellIndex) => (
                <td key={`${headers[cellIndex] ?? "cell"}-${cell}`} className="px-2 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
