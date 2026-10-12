import { redirect } from "next/navigation";
import { SpeakingStart } from "@/components/speaking/speaking-start";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadCurrentUser, loadSpeaking } from "@/lib/api/server";

export default async function SpeakingPage() {
  const user = await loadCurrentUser();
  if (user === null) {
    redirect("/login");
  }
  if (!user.emailVerified) {
    return null;
  }
  const practice = await readPageData(() => loadSpeaking());
  if (typeof practice === "string") {
    return <LoadError message={practice} />;
  }
  return <SpeakingStart practice={practice} />;
}
