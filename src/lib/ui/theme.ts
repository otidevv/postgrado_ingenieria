export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "unamad-admin-theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/** Resolve a stored preference into the concrete palette to paint. */
export function resolveTheme(theme: Theme): "light" | "dark" {
  if (theme === "system") {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  }
  return theme;
}

/**
 * Runs in <head> before first paint to set data-theme synchronously and avoid
 * a flash of the wrong palette. Reads localStorage, falls back to the OS.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k="${THEME_KEY}";var s=localStorage.getItem(k);var t=(s==="light"||s==="dark"||s==="system")?s:"system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;
