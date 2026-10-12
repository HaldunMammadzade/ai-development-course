"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { LindelLockup } from "@/components/brand/lindel-mark";
import { PageContainer } from "@/components/layout/primitives";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  IconDashboard,
  IconHomework,
  IconInterview,
  IconLearn,
  IconBilling,
  IconSpeaking,
  IconMilestone,
  IconProgress,
  IconGit,
  IconTest,
  IconProject,
  IconRevision,
} from "@/components/ui/icon";
import { Sheet } from "@/components/ui/overlay";
import { apiPost } from "@/lib/api/client";
import { copy } from "@/lib/copy";
import { cn } from "@/lib/utils";

const groups = [
  {
    label: copy.nav.groupLearn,
    links: [
      { href: "/app/dashboard", label: copy.nav.dashboard, icon: IconDashboard },
      { href: "/app/learn", label: copy.nav.learn, icon: IconLearn },
      { href: "/app/revision", label: copy.nav.revision, icon: IconRevision },
    ],
  },
  {
    label: copy.nav.groupPractice,
    links: [
      { href: "/app/homework", label: copy.nav.homework, icon: IconHomework },
      { href: "/app/projects", label: copy.nav.projects, icon: IconProject },
      { href: "/app/git", label: copy.nav.git, icon: IconGit },
      { href: "/app/testing", label: copy.nav.testing, icon: IconTest },
      { href: "/app/interviews", label: copy.nav.interviews, icon: IconInterview },
      { href: "/app/speaking", label: copy.nav.speaking, icon: IconSpeaking },
    ],
  },
  {
    label: copy.nav.groupProgress,
    links: [
      { href: "/app/progress", label: copy.nav.progress, icon: IconProgress },
      { href: "/app/achievements", label: copy.nav.achievements, icon: IconMilestone },
    ],
  },
  {
    label: copy.nav.groupAccount,
    links: [{ href: "/app/billing", label: copy.nav.billing, icon: IconBilling }],
  },
] as const;

export function AppShell({
  name,
  email,
  children,
}: {
  name: string | null;
  email: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  async function logout() {
    setPending(true);
    try {
      await apiPost("/api/v1/auth/logout");
    } catch {
      // The next /me decides whether the session is still alive.
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh overflow-x-hidden bg-background lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-card focus:px-3 focus:py-2"
      >
        {copy.nav.skip}
      </a>
      <aside className="hidden overflow-y-auto border-r border-[var(--color-border-subtle)] bg-[var(--color-bg-sidebar)] lg:flex lg:flex-col lg:px-3 lg:py-5">
        <Brand />
        <Nav pathname={pathname} />
        <div className="mt-6 border-t border-[var(--color-border-subtle)] pt-4">
          <ThemeToggle />
        </div>
        <UserBlock name={name} email={email} pending={pending} onLogout={() => void logout()} />
      </aside>
      <div className="flex min-h-dvh min-w-0 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-bg-navbar)] px-4 lg:hidden">
          <Brand />
          <button
            type="button"
            className="min-h-11 rounded-sm px-3 text-sm font-medium"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen(true)}
          >
            {copy.nav.openMenu}
          </button>
        </header>
        <Sheet open={open} title="Lindel" closeLabel={copy.nav.closeMenu} onClose={close}>
          <div id="mobile-nav">
            <Nav pathname={pathname} onNavigate={close} />
            <div className="mt-4 border-t border-[var(--color-border-subtle)] pt-4">
              <ThemeToggle />
            </div>
            <div className="mt-4">
              <UserBlock
                name={name}
                email={email}
                pending={pending}
                onLogout={() => void logout()}
              />
            </div>
          </div>
        </Sheet>
        <PageContainer id="content" className="min-w-0 flex-1 px-4 py-6 md:px-6 md:py-8 lg:px-10">
          {children}
        </PageContainer>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link
      href="/app/dashboard"
      aria-label="Lindel"
      className="inline-flex min-h-11 items-center px-2"
    >
      <LindelLockup />
    </Link>
  );
}

function Nav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="mt-8 grid gap-6" aria-label="Lindel">
      {groups.map((group) => (
        <div key={group.label} className="grid gap-1">
          <p className="px-3 text-xs font-medium text-muted-foreground">{group.label}</p>
          {group.links.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm transition-colors duration-[var(--motion-fast)]",
                  active
                    ? "bg-accent font-medium text-foreground shadow-[inset_2px_0_0_var(--color-accent-fill)]"
                    : "text-foreground hover:bg-secondary",
                )}
              >
                <Icon className="size-4 shrink-0" />
                {link.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function UserBlock({
  name,
  email,
  pending,
  onLogout,
}: {
  name: string | null;
  email: string;
  pending: boolean;
  onLogout: () => void;
}) {
  const label = name?.trim() || email;
  const initial = label.slice(0, 1).toUpperCase();
  return (
    <div className="mt-auto grid gap-3 border-t border-[var(--color-border-subtle)] pt-4">
      <div className="flex items-center gap-3 px-1">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-medium">
          {initial}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{label}</span>
          {name?.trim() ? (
            <span className="block truncate text-xs text-muted-foreground">{email}</span>
          ) : null}
        </span>
      </div>
      <Button variant="secondary" disabled={pending} onClick={onLogout}>
        {copy.nav.logout}
      </Button>
    </div>
  );
}
