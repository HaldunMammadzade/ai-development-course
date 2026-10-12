import { Skeleton } from "@/components/ui/status";
import { copy } from "@/lib/copy";

export default function LessonLoading() {
  return (
    <div className="grid max-w-3xl gap-4" aria-busy="true">
      <p className="sr-only">{copy.auth.working}</p>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-11 w-36" />
    </div>
  );
}
