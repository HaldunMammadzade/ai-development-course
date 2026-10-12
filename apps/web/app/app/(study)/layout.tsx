import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { loadAssessment } from "@/lib/api/server";

export default async function StudyLayout({ children }: { children: ReactNode }) {
  let status: string | null = null;
  try {
    status = (await loadAssessment()).status;
  } catch {
    status = null;
  }
  if (status === "in_progress") {
    redirect("/app/assessment");
  }
  return children;
}
