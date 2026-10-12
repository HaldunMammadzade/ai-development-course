import { notFound, redirect } from "next/navigation";
import { InterviewRoom } from "@/components/interviews/interview-room";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadCurrentUser, loadInterviewSession } from "@/lib/api/server";

export default async function InterviewSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const user = await loadCurrentUser();
  if (user === null) {
    redirect("/login");
  }
  if (!user.emailVerified) {
    return null;
  }
  const { sessionId } = await params;
  const session = await readPageData(() => loadInterviewSession(sessionId));
  if (typeof session === "string") {
    return <LoadError message={session} />;
  }
  if (session === null) {
    notFound();
  }
  return <InterviewRoom initial={session} />;
}
