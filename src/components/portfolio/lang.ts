// English or Spanish. A tiny store like the theme's, so the React parts and the
// scene (for its aria text) read the same value.

export type Lang = "en" | "es";

const STORAGE_KEY = "em-lang";
const listeners = new Set<() => void>();

function stored(): Lang {
  try { return localStorage.getItem(STORAGE_KEY) === "es" ? "es" : "en"; } catch { return "en"; }
}

let current: Lang = typeof window === "undefined" ? "en" : stored();

export const lang = () => current;

export function onLang(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function setLang(next: Lang) {
  current = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  document.documentElement.lang = next;
  for (const fn of listeners) fn();
}
