import Link from "next/link";
import type { ProjectSummary } from "@platform/types";
import { copy } from "@/lib/copy";

export function ProjectList({ projects }: { projects: ProjectSummary[] }) {
  if (projects.length === 0) {
    return (
      <div className="grid w-full max-w-3xl min-w-0 gap-3">
        <h1 className="font-serif text-4xl tracking-tight">{copy.projects.title}</h1>
        <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
          {copy.projects.empty}
        </p>
      </div>
    );
  }
  return (
    <div className="grid w-full max-w-3xl min-w-0 gap-8">
      <header className="grid gap-2">
        <h1 className="font-serif text-4xl tracking-tight">{copy.projects.title}</h1>
        <p className="max-w-[65ch] leading-7 text-muted-foreground">{copy.projects.lead}</p>
      </header>
      <ul className="divide-y divide-[var(--color-border-subtle)]">
        {projects.map((project) => (
          <li key={project.slug}>
            <Link
              href={`/app/projects/${project.slug}`}
              className="grid min-h-11 min-w-0 gap-1 py-5"
            >
              <span className="break-words text-base font-medium">{project.title}</span>
              <span className="break-words text-sm leading-6 text-muted-foreground">
                {project.description}
              </span>
              <span className="text-sm text-muted-foreground">
                {projectState(project)} · {copy.projects.bands[project.band]} ·{" "}
                {project.estimatedMinutes} {copy.projects.minutes}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function projectState(project: ProjectSummary): string {
  if (project.completed) {
    return copy.projects.done;
  }
  if (project.passedMilestones > 0) {
    return copy.projects.inProgress;
  }
  return copy.projects.notStarted;
}
