// Theme handling shared between the no-flash init script and the toggle.

export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "hivemind-theme";
export const THEMES: Theme[] = ["system", "light", "dark"];

export function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

/** Whether a theme choice resolves to the dark palette right now. */
export function resolvesToDark(theme: Theme): boolean {
  return theme === "dark" || (theme === "system" && systemPrefersDark());
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  try {
    const t = window.localStorage.getItem(THEME_KEY) as Theme | null;
    return t && THEMES.includes(t) ? t : "system";
  } catch {
    return "system";
  }
}

/** Apply a theme: toggle the `dark` class, persist it, and remember the choice. */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", resolvesToDark(theme));
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore (private mode etc.)
  }
}

/**
 * Inline script (stringified) that applies the stored/system theme before the
 * first paint, avoiding a flash of the wrong theme. Kept dependency-free
 * because it runs before hydration and can't import.
 *
 * COUPLING: this mirrors getStoredTheme() + resolvesToDark() + applyTheme().
 * It shares THEME_KEY, but if the dark-resolution rule changes, update both.
 */
export const themeInitScript = `(function(){try{var k='${THEME_KEY}';var t=localStorage.getItem(k)||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.dataset.theme=t;}catch(e){document.documentElement.classList.add('dark');}})();`;
