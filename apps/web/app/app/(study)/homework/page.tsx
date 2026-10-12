import { redirect } from "next/navigation";
import { HomeworkBoard } from "@/components/homework/homework-board";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadCurrentUser, loadHomework } from "@/lib/api/server";

export default async function HomeworkPage() {
  const user = await loadCurrentUser();
  if (user === null) {
    redirect("/login");
  }
  if (!user.emailVerified) {
    return null;
  }
  const homework = await readPageData(loadHomework);
  if (typeof homework === "string") {
    return <LoadError message={homework} />;
  }
  return (
    <HomeworkBoard initial={homework} timeZone={user.timezone} nowIso={new Date().toISOString()} />
  );
}
