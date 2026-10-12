import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell/app-shell";
import { appGate } from "@/lib/auth/gate";
import { loadCurrentUser } from "@/lib/api/server";
import { copy } from "@/lib/copy";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: ReactNode }) {
  const user = await loadCurrentUser();
  if (appGate(user) === "login" || user === null) {
    redirect("/login");
  }
  if (appGate(user) === "verify") {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-6">
        <h1 className="font-serif text-4xl">{copy.auth.unverifiedTitle}</h1>
        <p className="mt-4 leading-7 text-muted-foreground">{copy.auth.unverifiedBody}</p>
        <Link className="mt-6 text-sm font-semibold text-primary" href="/verify-email">
          {copy.auth.verifyTitle}
        </Link>
      </main>
    );
  }

  return (
    <AppShell name={user.name} email={user.email}>
      {children}
    </AppShell>
  );
}
