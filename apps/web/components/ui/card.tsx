import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const states = {
  default: "border-[var(--color-border-subtle)] bg-card",
  interactive: "border-[var(--color-border-subtle)] bg-card hover:border-border",
  selected: "border-[var(--color-border-subtle)] bg-accent shadow-[inset_2px_0_0_var(--color-accent-primary)]",
  locked: "border-[var(--color-border-subtle)] bg-card text-muted-foreground",
  completed: "border-[var(--color-border-subtle)] bg-card shadow-[inset_2px_0_0_var(--color-success)]",
} as const;

export function Card({
  state = "default",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { state?: keyof typeof states }) {
  return (
    <div
      className={cn("min-w-0 rounded-md border p-5 shadow-none", states[state], className)}
      {...props}
    />
  );
}
