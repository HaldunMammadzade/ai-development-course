export default function AchievementsLoading() {
  return (
    <div className="grid w-full max-w-3xl gap-4" aria-busy="true" aria-live="polite">
      <div className="h-10 w-64 rounded-sm bg-[var(--color-bg-surface)]" />
      <div className="h-24 rounded-sm bg-[var(--color-bg-surface)]" />
    </div>
  );
}
