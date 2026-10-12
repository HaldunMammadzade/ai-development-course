import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Normative geometry: docs/brand/assets/lindel-symbol.svg
 * 16-unit grid, short bar 7, long bar 12, shared left edge. Do not add a third bar.
 */
export function LindelMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={cn("shrink-0 text-[var(--color-logo)]", className)}
      {...props}
    >
      <rect x="2" y="5" width="7" height="2" />
      <rect x="2" y="9" width="12" height="2" />
    </svg>
  );
}

export function LindelLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <LindelMark className="size-6" />
      <span className="font-serif text-[15px] leading-none font-medium tracking-[0.012em]">
        lindel
      </span>
    </span>
  );
}
