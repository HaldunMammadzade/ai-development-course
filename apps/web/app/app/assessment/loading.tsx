import { Skeleton } from "@/components/ui/status";
import { copy } from "@/lib/copy";

export default function AssessmentLoading() {
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4" aria-busy="true">
      <span className="sr-only">{copy.auth.working}</span>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-full max-w-md" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
