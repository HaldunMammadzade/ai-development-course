import { notFound, redirect } from "next/navigation";
import { ProjectBoard } from "@/components/projects/project-board";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadCurrentUser, loadProject } from "@/lib/api/server";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectSlug: string }>;
}) {
  const user = await loadCurrentUser();
  if (user === null) {
    redirect("/login");
  }
  if (!user.emailVerified) {
    return null;
  }
  const { projectSlug } = await params;
  const project = await readPageData(() => loadProject(projectSlug));
  if (typeof project === "string") {
    return <LoadError message={project} />;
  }
  if (project === null) {
    notFound();
  }
  return <ProjectBoard initial={project} timeZone={user.timezone} />;
}
