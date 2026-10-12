import Link from "next/link";
import { copy } from "@/lib/copy";

export function LockedLesson({ href }: { href: string }) {
  return (
    <article className="mx-auto grid w-full max-w-2xl gap-4">
      <h1 className="font-serif text-3xl tracking-tight">{copy.learn.lockedTitle}</h1>
      <p className="max-w-[65ch] text-sm leading-6 text-muted-foreground">
        {copy.learn.lockedBody}
      </p>
      <Link
        href={href}
        className="inline-flex min-h-11 w-fit items-center rounded-sm bg-primary px-3 text-sm font-medium text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {copy.learn.lockedAction}
      </Link>
    </article>
  );
}
