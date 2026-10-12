import Link from "next/link";
import { copy } from "@/lib/copy";

export default function BillingSuccessPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4">
      <h1 className="font-serif text-4xl">{copy.billing.returnTitle}</h1>
      <p className="break-words leading-7 text-muted-foreground">{copy.billing.returnBody}</p>
      <Link className="text-sm font-semibold text-primary" href="/app/billing">
        {copy.billing.returnLink}
      </Link>
    </main>
  );
}
