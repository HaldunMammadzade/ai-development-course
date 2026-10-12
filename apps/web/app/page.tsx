import Link from "next/link";
import { copy } from "@/lib/copy";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-4 py-16 sm:px-6 sm:py-20">
      <p className="text-sm font-semibold text-primary">{copy.product}</p>
      <h1 className="mt-4 max-w-2xl font-serif text-3xl leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
        {copy.homeTitle}
      </h1>
      <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">{copy.homeLead}</p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/register"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {copy.startLearning}
        </Link>
        <Link
          href="/pricing"
          className="rounded-md border border-border bg-card px-5 py-2.5 text-sm font-semibold shadow-[var(--shadow)] transition-colors hover:bg-secondary"
        >
          Planlar
        </Link>
        <Link
          href="/login"
          className="rounded-md border border-border bg-card px-5 py-2.5 text-sm font-semibold shadow-[var(--shadow)] transition-colors hover:bg-secondary"
        >
          {copy.auth.goLogin}
        </Link>
      </div>
    </main>
  );
}
