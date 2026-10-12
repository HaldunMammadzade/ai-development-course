import { redirect } from "next/navigation";
import { ProjectList } from "@/components/projects/project-list";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadCurrentUser, loadProjects } from "@/lib/api/server";

export default async function ProjectsPage() {
  const user = await loadCurrentUser();
  if (user === null) {
    redirect("/login");
  }
  if (!user.emailVerified) {
    return null;
  }
  const projects = await readPageData(loadProjects);
  if (typeof projects === "string") {
    return <LoadError message={projects} />;
  }
  return <ProjectList projects={projects} />;
}
