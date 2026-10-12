import type { PersonalizedPath } from "@platform/types";
import { redirect } from "next/navigation";
import { AssessmentScreen } from "@/components/assessment/assessment-screen";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadAssessment, loadCatalog, loadCurrentUser } from "@/lib/api/server";

export default async function AssessmentPage() {
  const user = await loadCurrentUser();
  if (user === null) {
    redirect("/login");
  }
  if (!user.emailVerified) {
    return null;
  }
  const assessment = await readPageData(loadAssessment);
  if (typeof assessment === "string") {
    return <LoadError message={assessment} />;
  }
  if (assessment.status === "not_required" || assessment.status === "skipped") {
    redirect("/app/dashboard");
  }
  let route: PersonalizedPath | null = null;
  if (assessment.status === "completed") {
    const catalog = await readPageData(loadCatalog);
    if (typeof catalog !== "string") {
      route = catalog.personalized ?? null;
    }
  }
  return <AssessmentScreen view={assessment} route={route} />;
}
