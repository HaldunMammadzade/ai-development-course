import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import {
  loadAchievements,
  loadCatalog,
  loadCurrentUser,
  loadHomework,
  loadProject,
  loadProjects,
} from "@/lib/api/server";
import { buildDashboard } from "@/lib/learning/dashboard";

export default async function DashboardPage() {
  const user = await loadCurrentUser();
  if (user === null) {
    redirect("/login");
  }
  if (!user.emailVerified) {
    return null;
  }

  const [catalog, achievements] = await Promise.all([
    readPageData(loadCatalog),
    readPageData(loadAchievements),
  ]);
  if (typeof catalog === "string") {
    return <LoadError message={catalog} />;
  }
  const latest = typeof achievements === "string" ? null : achievements.latest;

  const [homework, projects] = await Promise.all([
    readPageData(loadHomework),
    readPageData(loadProjects),
  ]);
  const summary =
    typeof projects === "string"
      ? null
      : (projects.find((item) => !item.completed) ?? projects[0] ?? null);
  const detailResult =
    summary === null ? null : await readPageData(() => loadProject(summary.slug));
  const projectDetail =
    detailResult === null || typeof detailResult === "string" ? null : detailResult;

  return (
    <DashboardView
      user={user}
      model={buildDashboard({ catalog, homework, projects, projectDetail })}
      achievement={latest}
    />
  );
}
