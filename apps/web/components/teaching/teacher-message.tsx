import { LindelMark } from "@/components/brand/lindel-mark";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

export function TeacherMessage({ role, speech }: { role: "student" | "teacher"; speech: string }) {
  const teacher = role === "teacher";
  return (
    <article className="max-w-[65ch]">
      <p className="flex items-center gap-2 text-sm font-medium">
        {teacher ? <LindelMark className="size-4" /> : null}
        {teacher ? copy.teacher.label : copy.teacher.studentLabel}
      </p>
      <div
        className={cn(
          "mt-3 whitespace-pre-wrap break-words text-base leading-7",
          teacher ? "border-l-2 border-l-[var(--color-accent-fill)] pl-4" : "",
        )}
      >
        {speech}
      </div>
    </article>
  );
}
