"use client";

import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";
import { THEME_STORAGE_KEY, parseThemeChoice, type ThemeChoice } from "@/lib/theme";

const choices: { id: ThemeChoice; label: string }[] = [
  { id: "dark", label: copy.nav.themeDark },
  { id: "light", label: copy.nav.themeLight },
  { id: "system", label: copy.nav.themeSystem },
];

function applyTheme(next: ThemeChoice) {
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = next === "dark" || (next === "system" && systemDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(THEME_STORAGE_KEY, next);
  window.dispatchEvent(new Event("lindel-theme"));
}

export function ThemeToggle() {
  const [choice, setChoice] = useState<ThemeChoice>("dark");

  useEffect(() => {
    const read = () => setChoice(parseThemeChoice(document.documentElement.dataset.theme ?? null));
    read();
    window.addEventListener("lindel-theme", read);
    return () => window.removeEventListener("lindel-theme", read);
  }, []);

  function apply(next: ThemeChoice) {
    applyTheme(next);
  }

  return (
    <div className="grid gap-1" role="group" aria-label={copy.nav.theme}>
      {choices.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-pressed={choice === item.id}
          onClick={() => apply(item.id)}
          className="min-h-11 rounded-sm px-3 text-left text-sm font-medium text-foreground hover:bg-secondary aria-pressed:bg-accent"
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
