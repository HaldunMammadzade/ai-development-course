import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { loadCurrentUser } from "@/lib/api/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await loadCurrentUser();
  if (user === null || !user.emailVerified || user.role !== "admin") {
    notFound();
  }
  return <AdminShell>{children}</AdminShell>;
}
