export type Theme = "light" | "dark";

export function getStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem("gv-theme");
    if (v === "light" || v === "dark") return v;
  } catch {
    // ignore
  }
  return null;
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem("gv-theme", theme);
  } catch {
    // ignore
  }
}

export function initTheme() {
  const stored = getStoredTheme();
  if (stored) {
    applyTheme(stored);
    return stored;
  }
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  const theme: Theme = prefersDark ? "dark" : "light";
  applyTheme(theme);
  return theme;
}