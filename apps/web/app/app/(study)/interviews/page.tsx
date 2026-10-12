import { redirect } from "next/navigation";
import { InterviewList } from "@/components/interviews/interview-list";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadCurrentUser, loadInterviews } from "@/lib/api/server";

export default async function InterviewsPage() {
  const user = await loadCurrentUser();
  if (user === null) {
    redirect("/login");
  }
  if (!user.emailVerified) {
    return null;
  }
  const interviews = await readPageData(loadInterviews);
  if (typeof interviews === "string") {
    return <LoadError message={interviews} />;
  }
  return <InterviewList interviews={interviews} />;
}
