export function Progress({
  value,
  label,
  valueText,
  max = 100,
}: {
  value: number;
  label: string;
  valueText?: string;
  max?: number;
}) {
  const safe = Number.isFinite(value) ? Math.max(0, Math.min(max, value)) : 0;
  const width = max === 0 ? 0 : (safe / max) * 100;
  return (
    <div
      className="h-1 overflow-hidden bg-[var(--color-border-default)]"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(safe)}
      aria-valuetext={valueText}
    >
      <div
        className="h-full bg-[var(--color-accent-primary)] transition-[width] duration-[var(--motion-normal)] ease-[var(--motion-ease)] motion-reduce:transition-none"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
