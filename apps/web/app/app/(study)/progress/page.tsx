import Link from "next/link";
import { PathRail } from "@/components/curriculum/path-rail";
import { SkillMap } from "@/components/progress/skill-map";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadAchievements, loadCatalog } from "@/lib/api/server";
import { copy } from "@/lib/copy";

export default async function ProgressPage() {
  const [catalog, achievements] = await Promise.all([
    readPageData(loadCatalog),
    readPageData(loadAchievements),
  ]);
  if (typeof catalog === "string") {
    return <LoadError message={catalog} />;
  }
  const milestones = typeof achievements === "string" ? null : achievements;
  const skill = catalog.skill;
  const path = catalog.personalized;

  return (
    <div className="grid w-full max-w-6xl min-w-0 gap-10">
      <header>
        <p className="text-sm font-medium text-primary">{catalog.path?.title ?? copy.product}</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">{copy.progress.title}</h1>
        <p className="mt-3 max-w-[65ch] leading-7 text-muted-foreground">{copy.progress.lead}</p>
      </header>
      {milestones !== null ? (
        <section className="grid gap-2" aria-labelledby="milestones">
          <h2 id="milestones" className="text-sm font-medium text-muted-foreground">
            {copy.achievements.progressTitle}
          </h2>
          {milestones.earnedCount > 0 ? (
            <p className="text-sm leading-6">
              {copy.achievements.earnedCount(milestones.earnedCount)}
            </p>
          ) : (
            <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
              {copy.achievements.empty}
            </p>
          )}
          <Link
            href="/app/achievements"
            className="inline-flex min-h-11 w-fit items-center text-sm font-medium underline-offset-4 hover:underline"
          >
            {copy.dashboard.achievementsLink} →
          </Link>
        </section>
      ) : null}
      {path !== undefined && (path.current !== null || path.concepts.length > 0) ? (
        <PathRail path={path} />
      ) : null}
      {skill !== undefined && skill.concepts.length > 0 ? (
        <SkillMap graph={skill} />
      ) : (
        <div className="surface p-6">
          <p className="text-sm leading-6">{copy.progress.empty}</p>
          <Link
            href="/app/learn"
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            {copy.startLearning}
          </Link>
        </div>
      )}
    </div>
  );
}
