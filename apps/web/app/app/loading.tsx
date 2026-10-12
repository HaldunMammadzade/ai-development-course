export default function LoadingStudent() {
  return (
    <div className="mx-auto grid max-w-5xl gap-4" aria-busy="true" aria-live="polite">
      <div className="skeleton h-8 w-48" />
      <div className="skeleton h-44" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="skeleton h-36" />
        <div className="skeleton h-36" />
      </div>
    </div>
  );
}
