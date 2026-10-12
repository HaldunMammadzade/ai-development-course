import { notFound, redirect } from "next/navigation";
import { InterviewOverview } from "@/components/interviews/interview-overview";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadCurrentUser, loadInterview } from "@/lib/api/server";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ interviewSlug: string }>;
}) {
  const user = await loadCurrentUser();
  if (user === null) {
    redirect("/login");
  }
  if (!user.emailVerified) {
    return null;
  }
  const { interviewSlug } = await params;
  const interview = await readPageData(() => loadInterview(interviewSlug));
  if (typeof interview === "string") {
    return <LoadError message={interview} />;
  }
  if (interview === null) {
    notFound();
  }
  return <InterviewOverview interview={interview} />;
}
