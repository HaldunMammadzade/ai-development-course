import { notFound, redirect } from "next/navigation";
import { SpeakingRoom } from "@/components/speaking/speaking-room";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadCurrentUser, loadSpeakingSession } from "@/lib/api/server";

export default async function SpeakingSessionPage({
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
  const session = await readPageData(() => loadSpeakingSession(sessionId));
  if (typeof session === "string") {
    return <LoadError message={session} />;
  }
  if (session === null) {
    notFound();
  }
  return <SpeakingRoom initial={session} />;
}
