import { RevisionView } from "@/components/revision/revision-view";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadRevision } from "@/lib/api/server";

export default async function RevisionPage() {
  const queue = await readPageData(loadRevision);
  if (typeof queue === "string") {
    return <LoadError message={queue} />;
  }
  return <RevisionView queue={queue} />;
}
