import type { Achievement, AchievementCategory, AchievementList } from "@platform/types";
import { IconCheck } from "@/components/ui/icon";
import { copy } from "@/lib/copy";

const order: AchievementCategory[] = ["learning", "skill", "practice", "project", "interview"];

export function AchievementsView({ list, timeZone }: { list: AchievementList; timeZone: string }) {
  const groups = order
    .map((category) => ({
      category,
      items: list.items.filter((item) => item.category === category),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="grid w-full max-w-3xl min-w-0 gap-10">
      <header>
        <h1 className="font-serif text-4xl tracking-tight">{copy.achievements.title}</h1>
        <p className="mt-3 max-w-[65ch] leading-7 text-muted-foreground">
          {copy.achievements.lead}
        </p>
      </header>
      {list.earnedCount === 0 ? (
        <div className="grid gap-2">
          <p className="text-sm leading-6">{copy.achievements.empty}</p>
          <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
            {copy.achievements.emptyBody}
          </p>
        </div>
      ) : null}
      {groups.map((group) => (
        <section key={group.category} className="grid gap-2" aria-labelledby={group.category}>
          <h2 id={group.category} className="text-sm font-medium text-muted-foreground">
            {copy.achievements.categories[group.category]}
          </h2>
          <ul className="divide-y divide-[var(--color-border-subtle)]">
            {group.items.map((item) => (
              <AchievementRow key={item.id} item={item} timeZone={timeZone} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function AchievementRow({ item, timeZone }: { item: Achievement; timeZone: string }) {
  const earned = item.state === "earned";
  const when = earned && item.earnedAt !== null ? earnedOn(item.earnedAt, timeZone) : null;
  return (
    <li className="grid min-w-0 gap-1 py-5">
      <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className={earned ? "break-words text-base font-medium" : "break-words text-base"}>
          {item.title}
        </h3>
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          {earned ? <IconCheck className="size-4 shrink-0" /> : null}
          <span>
            {when !== null ? `${copy.achievements.earned} · ${when}` : copy.achievements.locked}
          </span>
        </p>
      </div>
      <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">{item.description}</p>
    </li>
  );
}

function earnedOn(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("az-AZ", { day: "numeric", month: "long", timeZone }).format(
      date,
    );
  } catch {
    return new Intl.DateTimeFormat("az-AZ", {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(date);
  }
}
