import { AchievementsView } from "@/components/achievements/achievements-view";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadAchievements, loadCurrentUser } from "@/lib/api/server";

export default async function AchievementsPage() {
  const [list, user] = await Promise.all([
    readPageData(loadAchievements),
    readPageData(loadCurrentUser),
  ]);
  if (typeof list === "string") {
    return <LoadError message={list} />;
  }
  const timeZone = typeof user === "string" || user === null ? "Asia/Baku" : user.timezone;
  return <AchievementsView list={list} timeZone={timeZone} />;
}
