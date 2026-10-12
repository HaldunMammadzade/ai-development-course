export default function RevisionLoading() {
  return (
    <div className="grid w-full max-w-3xl gap-4" aria-busy="true" aria-live="polite">
      <div className="h-10 w-40 rounded-md bg-[var(--color-bg-surface)]" />
      <div className="h-24 rounded-md bg-[var(--color-bg-surface)]" />
    </div>
  );
}
