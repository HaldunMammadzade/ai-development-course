import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton h-4 w-full ${className}`} aria-hidden="true" />;
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <div className="grid gap-2 py-2">
      <h2 className="text-lg font-medium">{title}</h2>
      {body ? <p className="text-sm text-muted-foreground">{body}</p> : null}
    </div>
  );
}

export function ErrorState({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="grid gap-2 border-l-2 border-destructive py-2 pl-4" role="alert">
      <h2 className="text-lg font-medium">{title}</h2>
      <p className="text-sm text-destructive">{body}</p>
    </div>
  );
}
