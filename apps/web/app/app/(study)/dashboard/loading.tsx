import { Skeleton } from "@/components/ui/status";
import { copy } from "@/lib/copy";

export default function DashboardLoading() {
  return (
    <div className="grid w-full max-w-3xl gap-4" aria-busy="true">
      <p className="sr-only">{copy.auth.working}</p>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-12 w-2/3" />
      <Skeleton className="h-11 w-36" />
    </div>
  );
}
