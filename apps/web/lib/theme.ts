export const THEME_STORAGE_KEY = "lindel-theme";

export type ThemeChoice = "dark" | "light" | "system";

export function parseThemeChoice(value: string | null): ThemeChoice {
  if (value === "light" || value === "dark" || value === "system") return value;
  return "dark";
}

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): "dark" | "light" {
  if (choice === "system") return systemDark ? "dark" : "light";
  return choice;
}

export const themeBoot = `(function(){try{var k="${THEME_STORAGE_KEY}";var s=localStorage.getItem(k);var mode=s==="light"||s==="dark"||s==="system"?s:"dark";var systemDark=window.matchMedia("(prefers-color-scheme: dark)").matches;var dark=mode==="dark"||(mode==="system"&&systemDark);document.documentElement.classList.toggle("dark",dark);document.documentElement.dataset.theme=mode;}catch(e){}})();`;
