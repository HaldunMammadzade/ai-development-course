"use client";

import type { ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function Sheet({
  open,
  title,
  closeLabel,
  onClose,
  children,
  until = "lg",
  side = "left",
}: {
  open: boolean;
  title: string;
  closeLabel?: string;
  onClose: () => void;
  children: ReactNode;
  until?: "lg" | "xl";
  side?: "left" | "right";
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector<HTMLElement>("button, a, input")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className={cn("fixed inset-0 z-40", until === "xl" ? "xl:hidden" : "lg:hidden")}>
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={closeLabel ?? title}
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "absolute inset-y-0 flex w-[min(100%,22.5rem)] flex-col gap-4 overflow-y-auto bg-[var(--color-bg-sidebar)] p-4",
          side === "right" ? "right-0 border-l border-border" : "left-0 border-r border-border",
        )}
      >
        <h2 id={titleId} className="text-sm font-medium">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label={title} onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md border border-border bg-[var(--color-bg-elevated)] p-5"
        style={{ borderRadius: "var(--radius-lg)" }}
      >
        <h2 id={titleId} className="text-lg font-medium">
          {title}
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>
  );
}

export function Dropdown({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        className="min-h-11 rounded-sm px-3 text-sm font-medium hover:bg-secondary"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 min-w-40 border border-border bg-[var(--color-bg-elevated)] p-1"
          style={{ borderRadius: "var(--radius-sm)" }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute top-full left-1/2 z-20 mt-1 hidden -translate-x-1/2 bg-[var(--color-bg-inverse)] px-2 py-1 text-xs whitespace-nowrap text-[var(--color-text-inverse)] group-focus-within:block group-hover:block"
      >
        {label}
      </span>
    </span>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          className={cn(
            "min-h-11 px-3 text-sm font-medium",
            value === tab.id ? "border-b-2 border-[var(--color-accent-primary)]" : "text-muted-foreground",
          )}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
