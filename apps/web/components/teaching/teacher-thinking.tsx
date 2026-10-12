import { LindelMark } from "@/components/brand/lindel-mark";
import { copy } from "@/lib/copy";

export function TeacherThinking() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
      <LindelMark className="size-4" />
      {copy.teacher.thinking}
    </p>
  );
}
