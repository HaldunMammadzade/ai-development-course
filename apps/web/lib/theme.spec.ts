import { describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, parseThemeChoice, resolveTheme } from "./theme";

describe("theme preference", () => {
  it("defaults to dark and only stores a theme name", () => {
    expect(THEME_STORAGE_KEY).toBe("lindel-theme");
    expect(parseThemeChoice(null)).toBe("dark");
    expect(parseThemeChoice("nope")).toBe("dark");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
});
