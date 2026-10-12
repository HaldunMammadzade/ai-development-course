import { PathList } from "@/components/curriculum/path-list";
import { LoadError } from "@/components/ui/load-error";
import { readPageData } from "@/lib/api/page-data";
import { loadCatalog } from "@/lib/api/server";

export default async function LearnPage() {
  const catalog = await readPageData(loadCatalog);
  if (typeof catalog === "string") {
    return <LoadError message={catalog} />;
  }
  return <PathList catalog={catalog} />;
}
