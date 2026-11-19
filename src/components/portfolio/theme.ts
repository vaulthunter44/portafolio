// Day ↔ night, passing through dusk. The page and the 3D field both read two
// numbers: --night (0 day … 1 night) and --gold (how much dusk light).

export type Theme = "day" | "night";
export type Drivers = { night: number; gold: number };

const STORAGE_KEY = "em-theme";
const DURATION = 2000;
const KEYS = [
  { at: 0, night: 0, gold: 0 },
  { at: 0.16, night: 0.07, gold: 0.5 },
  { at: 0.42, night: 0.34, gold: 1 },
  { at: 0.62, night: 0.66, gold: 0.6 },
  { at: 0.8, night: 0.89, gold: 0.22 },
  { at: 0.92, night: 0.97, gold: 0.06 },
  { at: 1, night: 1, gold: 0 },
];
const GOLDEN_AT = KEYS.reduce((best, k) => (k.gold > best.gold ? k : best)).at;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function driversAt(progress: number): Drivers {
  const p = Math.min(1, Math.max(0, progress));
  let i = 1;
  while (i < KEYS.length - 1 && KEYS[i].at < p) i++;
  const a = KEYS[i - 1], b = KEYS[i];
  const t = b.at === a.at ? 0 : (p - a.at) / (b.at - a.at);
  return { night: lerp(a.night, b.night, t), gold: lerp(a.gold, b.gold, t) };
}

/** Day → night by --night, then pulled towards the dusk value by --gold. */
export const blend = (day: number, dusk: number, night: number, d: Drivers) => lerp(lerp(day, night, d.night), dusk, d.gold);

let animation: Animation | null = null;
let heading: Theme = "night";
let current: Theme = typeof document !== "undefined" && document.documentElement.classList.contains("dark") ? "night" : "day";
const listeners = new Set<(a: Animation | null) => void>();

export const theme = () => current;
export const duskAnimation = () => animation;

export function driversNow(): Drivers {
  if (!animation) return driversAt(current === "night" ? 1 : 0);
  const t = Number(animation.currentTime ?? 0) / DURATION;
  return driversAt(heading === "night" ? t : 1 - t);
}

export function onDusk(fn: (a: Animation | null) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function setTheme(next: Theme, { animate = true } = {}) {
  const root = document.documentElement;
  current = next;
  heading = next;
  try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  animation?.cancel();
  animation = null;

  const settle = () => {
    root.classList.remove("is-dusking");
    root.classList.toggle("dark", next === "night");
    const d = driversAt(next === "night" ? 1 : 0);
    root.style.setProperty("--night", String(d.night));
    root.style.setProperty("--gold", String(d.gold));
  };

  if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    settle();
    for (const fn of listeners) fn(null);
    return;
  }

  const run = root.animate(
    KEYS.map((k) => ({ offset: k.at, "--night": String(k.night), "--gold": String(k.gold) })),
    { duration: DURATION, easing: "linear", fill: "forwards", direction: next === "night" ? "normal" : "reverse" },
  );
  animation = run;
  root.classList.add("is-dusking");
  // Swap the UI palette at the golden moment, when the change is least visible.
  const flip = setTimeout(() => root.classList.toggle("dark", next === "night"), DURATION * (next === "night" ? GOLDEN_AT : 1 - GOLDEN_AT));
  run.finished
    .then(() => {
      if (animation !== run) return;
      animation = null;
      settle();
      run.cancel();
      for (const fn of listeners) fn(null);
    })
    .catch(() => clearTimeout(flip));
  for (const fn of listeners) fn(run);
}

/** Runs before first paint (inlined in <head>) so a returning night visitor never flashes day. */
export const THEME_BOOT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='night'){var r=document.documentElement;r.classList.add('dark');r.style.setProperty('--night','1');r.style.setProperty('--gold','0');}}catch(e){}})()`;
