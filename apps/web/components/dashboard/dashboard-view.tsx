import Link from "next/link";
import type { Achievement, CurrentUser } from "@platform/types";
import { PathRail } from "@/components/curriculum/path-rail";
import { Progress } from "@/components/ui/progress";
import { copy } from "@/lib/copy";
import { formatWhen } from "@/lib/format";
import type { DashboardModel } from "@/lib/learning/dashboard";

const primaryLink =
  "inline-flex min-h-11 w-fit items-center rounded-sm bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[var(--color-accent-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const textLink =
  "inline-flex min-h-11 w-fit items-center text-sm font-medium underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
const sectionTitle = "[font:var(--type-h3)] text-foreground";
const caption = "[font:var(--type-caption)] text-muted-foreground";

type SecondaryKind = "revision" | "project" | "homework";

export function DashboardView({
  user,
  model,
  achievement = null,
}: {
  user: CurrentUser;
  model: DashboardModel;
  achievement?: Achievement | null;
}) {
  const { hero } = model;
  const secondary = chooseSecondary(model);
  const lessonStep =
    hero.href !== null &&
    (hero.action === copy.actions.start_lesson || hero.action === copy.actions.continue_lesson);
  const earned = achievement !== null && achievement.state === "earned";
  return (
    <div className="grid w-full max-w-3xl gap-12">
      <section className="grid gap-3" aria-labelledby="continue-heading">
        <p className={caption}>{greeting(user)}</p>
        <p className="text-sm text-muted-foreground">{hero.eyebrow}</p>
        <h1 id="continue-heading" className="[font:var(--type-display-lg)] tracking-tight">
          {hero.title}
        </h1>
        {hero.moduleTitle !== null ? (
          <p className="text-sm text-foreground">
            {copy.dashboard.currentModule}: {hero.moduleTitle}
            {hero.minutes !== null ? ` · ${hero.minutes} ${copy.dashboard.minutes}` : ""}
          </p>
        ) : null}
        {hero.description !== null ? (
          <p className="max-w-[65ch] text-base leading-7 text-muted-foreground">
            {hero.description}
          </p>
        ) : null}
        {lessonStep ? (
          <p className="max-w-[65ch] text-sm leading-6">{copy.dashboard.teacherLine}</p>
        ) : null}
        {hero.href !== null ? (
          <Link href={hero.href} className={primaryLink}>
            {hero.action}
          </Link>
        ) : null}
      </section>

      {model.focus !== null ? (
        <p className="max-w-[65ch] text-sm leading-6">
          <span className="font-medium">{model.focus.name}. </span>
          {model.focus.body}{" "}
          <Link href={model.focus.href} className={textLink}>
            {copy.dashboard.reviewAction}
          </Link>
        </p>
      ) : null}

      <div
        className={
          secondary === null
            ? "grid gap-10"
            : "grid items-start gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(16rem,0.8fr)]"
        }
      >
        {model.route !== null ? (
          <PathRail path={model.route} emphasis />
        ) : model.path !== null ? (
          <PathProgress path={model.path} />
        ) : null}
        {secondary === "revision" && model.revision !== null ? (
          <RevisionBlock revision={model.revision} />
        ) : null}
        {secondary === "project" &&
        model.project.status === "ready" &&
        model.project.item !== null ? (
          <ProjectBlock project={model.project.item} />
        ) : null}
        {secondary === "homework" && model.homework.status === "ready" ? (
          <HomeworkBlock user={user} items={model.homework.items} />
        ) : null}
      </div>

      {model.homework.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {model.homework.message}
        </p>
      ) : null}
      {model.project.status === "error" ? (
        <p role="alert" className="text-sm text-destructive">
          {model.project.message}
        </p>
      ) : null}

      <More
        user={user}
        model={model}
        secondary={secondary}
        earned={earned}
        achievement={achievement}
      />
    </div>
  );
}

function chooseSecondary(model: DashboardModel): SecondaryKind | null {
  if (model.revision !== null) {
    return "revision";
  }
  if (
    model.project.status === "ready" &&
    model.project.item !== null &&
    !model.project.item.completed
  ) {
    return "project";
  }
  if (model.homework.status === "ready" && model.homework.items.length > 0) {
    return "homework";
  }
  return null;
}

function greeting(user: CurrentUser): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: user.timezone || "Asia/Baku",
    }).format(new Date()),
  );
  const hello =
    hour < 12
      ? copy.dashboard.greetingMorning
      : hour < 18
        ? copy.dashboard.greetingAfternoon
        : copy.dashboard.greetingEvening;
  const name = user.name?.trim();
  return name ? `${hello}, ${name}.` : `${hello}.`;
}

function PathProgress({ path }: { path: NonNullable<DashboardModel["path"]> }) {
  const remaining = path.total - path.completed;
  const summary = `${path.completed} / ${path.total} ${copy.dashboard.pathCount}`;
  return (
    <section className="grid gap-3" aria-labelledby="path-heading">
      <h2 id="path-heading" className={sectionTitle}>
        {copy.learn.title}
      </h2>
      <p className="text-base font-medium">{path.title}</p>
      <p className="text-sm text-foreground">{summary}</p>
      <Progress value={path.completed} max={path.total} label={path.title} valueText={summary} />
      {path.moduleTitle !== null ? (
        <p className="text-sm text-muted-foreground">
          {copy.dashboard.currentModule}: {path.moduleTitle}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {copy.dashboard.completedCount}: {path.completed}
        {" · "}
        {copy.dashboard.remainingCount}: {remaining}
      </p>
    </section>
  );
}

function RevisionBlock({ revision }: { revision: NonNullable<DashboardModel["revision"]> }) {
  return (
    <section className="grid gap-3" aria-labelledby="revision-heading">
      <h2 id="revision-heading" className={sectionTitle}>
        {copy.dashboard.revisionTitle}
      </h2>
      <p className="text-sm leading-6">{copy.revision.ready(revision.items.length)}</p>
      <ul className="grid gap-1">
        {revision.items.map((item) => (
          <li key={item.slug} className="text-sm leading-6">
            {item.name}
            <span className="text-muted-foreground">
              {" "}
              · {item.state === "overdue" ? copy.revision.states.overdue : copy.revision.states.due}
            </span>
          </li>
        ))}
      </ul>
      <Link href="/app/revision" className={textLink}>
        {copy.dashboard.revisionStart}
      </Link>
    </section>
  );
}

function HomeworkBlock({
  user,
  items,
}: {
  user: CurrentUser;
  items: Extract<DashboardModel["homework"], { status: "ready" }>["items"];
}) {
  return (
    <section className="grid gap-3" aria-labelledby="homework-heading">
      <h2 id="homework-heading" className={sectionTitle}>
        {copy.dashboard.homework}
      </h2>
      <ul className="grid gap-3">
        {items.map((item) => (
          <li key={item.id} className="text-sm leading-6">
            <Link href="/app/homework" className={textLink}>
              {item.title}
            </Link>
            <p className="text-muted-foreground">
              {copy.homework.due}: {formatWhen(item.dueAt, user.timezone)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProjectBlock({
  project,
}: {
  project: NonNullable<Extract<DashboardModel["project"], { status: "ready" }>["item"]>;
}) {
  return (
    <section className="grid gap-2" aria-labelledby="project-heading">
      <h2 id="project-heading" className={sectionTitle}>
        {project.title}
      </h2>
      <p className="text-sm leading-6">
        {project.milestoneTitle !== null
          ? `${copy.projects.current}: ${project.milestoneTitle}`
          : copy.projects.current}
      </p>
      <Link href={project.href} className={textLink}>
        {copy.projects.continueWork}
      </Link>
    </section>
  );
}

function More({
  user,
  model,
  secondary,
  earned,
  achievement,
}: {
  user: CurrentUser;
  model: DashboardModel;
  secondary: SecondaryKind | null;
  earned: boolean;
  achievement: Achievement | null;
}) {
  const homeworkReady = model.homework.status === "ready" ? model.homework.items : [];
  const projectReady = model.project.status === "ready" ? model.project.item : null;
  const showHomework = secondary !== "homework";
  const showProject = projectReady !== null && secondary !== "project";
  const hasMore =
    showHomework ||
    showProject ||
    model.weak.length > 0 ||
    model.activity.length > 0 ||
    earned ||
    model.snapshot !== null;
  if (!hasMore) {
    return null;
  }
  return (
    <details className="grid gap-3">
      <summary className="min-h-11 cursor-pointer list-none py-2 text-sm font-medium text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        {copy.dashboard.more}
      </summary>
      <div className="grid gap-8 pt-2">
        {showHomework ? (
          <section className="grid gap-2" aria-labelledby="homework-more">
            <h2 id="homework-more" className="text-sm font-medium">
              {copy.dashboard.homework}
            </h2>
            {homeworkReady.length === 0 ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {copy.dashboard.noHomework} {copy.dashboard.caughtUp}
              </p>
            ) : (
              <ul className="grid gap-2">
                {homeworkReady.map((item) => (
                  <li key={item.id} className="text-sm leading-6">
                    <Link href="/app/homework" className={textLink}>
                      {item.title}
                    </Link>
                    <p className="text-muted-foreground">
                      {copy.homework.due}: {formatWhen(item.dueAt, user.timezone)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
        {showProject && projectReady !== null ? (
          <section className="grid gap-1">
            <p className="text-sm font-medium">{projectReady.title}</p>
            <p className="text-sm text-muted-foreground">
              {projectReady.completed ? copy.projects.done : copy.projects.current}
            </p>
            <Link href={projectReady.href} className={textLink}>
              {projectReady.completed ? copy.dashboard.projectView : copy.projects.continueWork}
            </Link>
          </section>
        ) : null}
        {model.weak.length > 0 ? (
          <section className="grid gap-2" aria-labelledby="weak-heading">
            <h2 id="weak-heading" className="text-sm font-medium">
              {copy.dashboard.weak}
            </h2>
            <ul className="grid gap-2">
              {model.weak.map((concept) => (
                <li key={concept.slug} className="text-sm leading-6">
                  <span className="font-medium">{concept.name}</span>
                  <span className="text-muted-foreground"> · {concept.status}</span>
                  {concept.href !== null ? (
                    <Link href={concept.href} className={`${textLink} ml-3`}>
                      {copy.progress.review}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {model.activity.length > 0 ? (
          <section className="grid gap-2" aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="text-sm font-medium">
              {copy.dashboard.activity}
            </h2>
            <ol className="grid gap-2">
              {model.activity.map((item) => (
                <li key={item.id} className="text-sm leading-6">
                  <span className="font-medium">{item.label}</span>
                  <span className="text-muted-foreground"> · {item.conceptName}</span>
                  <time dateTime={item.createdAt} className="ml-2 text-muted-foreground">
                    {formatWhen(item.createdAt, user.timezone)}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        {earned && achievement !== null ? (
          <section className="grid gap-1" aria-labelledby="latest-achievement">
            <h2 id="latest-achievement" className="text-sm font-medium">
              {copy.dashboard.latestAchievement}
            </h2>
            <p className="text-sm font-medium">{achievement.title}</p>
            <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
              {achievement.description}
            </p>
            <Link href="/app/achievements" className={textLink}>
              {copy.dashboard.achievementsLink}
            </Link>
          </section>
        ) : null}
        {model.snapshot !== null ? (
          <section className="grid gap-2" aria-labelledby="skill-heading">
            <h2 id="skill-heading" className="text-sm font-medium">
              {copy.dashboard.skillTitle}
            </h2>
            {model.snapshot.moduleTitle !== null ? (
              <p className="text-sm font-medium">{model.snapshot.moduleTitle}</p>
            ) : null}
            {model.snapshot.weak.length > 0 ? (
              <p className="text-sm leading-6">
                <span className="text-muted-foreground">{copy.progress.states.weak}</span>{" "}
                {model.snapshot.weak.join(", ")}
              </p>
            ) : null}
            {model.snapshot.strong.length > 0 ? (
              <p className="text-sm leading-6">
                <span className="text-muted-foreground">{copy.progress.states.strong}</span>{" "}
                {model.snapshot.strong.join(", ")}
              </p>
            ) : null}
            <p className="text-sm leading-6 text-muted-foreground">
              {model.snapshot.unknown} {copy.dashboard.unknownCount}
            </p>
            <Link href="/app/progress" className={textLink}>
              {copy.dashboard.snapshotAction}
            </Link>
          </section>
        ) : null}
      </div>
    </details>
  );
}
