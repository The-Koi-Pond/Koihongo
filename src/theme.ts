// The app's colour theme, remembered on this PC (like Library's folded kinds).
//
// The theme is a `data-theme` attribute on <html>. App.css keeps the purple
// theme's colours on `:root` and overrides them per theme, and Scene.tsx picks
// each theme's sky colours and scenery pictures with useTheme().

import { useSyncExternalStore } from "react";

export const THEMES = [
  { id: "purple", name: "That tasted purple!", blurb: "Twilight indigo with pastel glows. The original look." },
  { id: "night-water", name: "Night Water", blurb: "A cold, moonlit koi pond in deep teal." },
  { id: "lantern-dusk", name: "Lantern Dusk", blurb: "A warm dusk with paper lanterns over still water." },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const KEY = "koihongo.theme";
const DEFAULT: ThemeId = "purple";

function isTheme(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

function saved(): ThemeId {
  try {
    const value = localStorage.getItem(KEY);
    return isTheme(value) ? value : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let current: ThemeId = saved();
const listeners = new Set<() => void>();

/** Puts the saved theme on the page. Called once in main.tsx, before the first paint. */
export function applySavedTheme() {
  document.documentElement.dataset.theme = current;
}

export function setTheme(id: ThemeId) {
  current = id;
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Not remembered this time; the theme still changes for now.
  }
  listeners.forEach((listener) => listener());
}

/** The current theme; re-renders when it changes. */
export function useTheme(): ThemeId {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}
