import { tick } from "./sound";

type Parts = { root: HTMLElement; hero: HTMLElement; mast: HTMLElement; track: HTMLElement; signal: AbortSignal };

const BEAT = 62;                          // ms per typed character, before jitter
const EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
const WGHT = [340, 720], OPSZ = [12, 144], SOFT = [0, 40];
const REACH = 220;                        // px at which a letter starts to respond

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function show(ch: HTMLElement, on: boolean) {
  ch.style.visibility = on ? "visible" : "hidden";
}

/** Replace an element's text with one span per character (words kept together). */
function splitChars(el: HTMLElement) {
  const text = el.textContent ?? "";
  el.textContent = "";
  const chars: HTMLElement[] = [];
  const add = (parent: HTMLElement, c: string) => {
    const span = document.createElement("span");
    span.className = "ch";
    span.textContent = c;
    show(span, false);
    parent.append(span);
    chars.push(span);
  };
  for (const token of text.split(/(\s+)/)) {
    if (!token) continue;
    if (/^\s+$/.test(token)) { add(el, token); continue; }
    const word = document.createElement("span");
    word.className = "word";
    for (const c of token) add(word, c);
    el.append(word);
  }
  return chars;
}

function typeOut(chars: HTMLElement[], onEach: (ch: HTMLElement) => void, beat = BEAT) {
  let at = 0;
  for (const ch of chars) {
    setTimeout(() => { show(ch, true); onEach(ch); tick(); }, at);
    const c = ch.textContent ?? "";
    at += beat * (0.74 + 0.52 * Math.random());
    if (!c.trim()) at += 0.9 * beat;
    if (/[?.,]/.test(c)) at += 1.8 * beat;
  }
  return wait(at);
}

function fadeIn(el: HTMLElement, duration: number) {
  el.style.opacity = "1";
  el.animate([{ opacity: 0 }, { opacity: 1 }], { duration, easing: EASE });
}

/**
 * Types the name, then the blurb, then brings in the button, header and
 * slider. Afterwards the heading reacts to the pointer.
 */
export function runIntro({ root, hero, mast, track, signal }: Parts) {
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const word = hero.querySelector<HTMLElement>(".hero__word")!;
  const blurb = hero.querySelector<HTMLElement>(".hero__blurb")!;
  const go = hero.querySelector<HTMLElement>(".hero__go")!;
  const code = hero.querySelector<HTMLElement>(".hero__code");
  const later = code ? [code] : [];

  for (const el of [blurb, go, mast, track, ...later]) el.style.opacity = "0";
  word.style.opacity = "1";
  const typed = [...word.querySelectorAll<HTMLElement>("[data-type]")].map((el) => splitChars(el));
  const blurbChars = splitChars(blurb);
  clearTimeout((window as unknown as { __uncover?: number }).__uncover);
  root.classList.remove("is-entering");

  const letterWeight = new WeakMap<HTMLElement, number>();
  let letters: HTMLElement[] = [];
  const pointer = { x: -1e4, y: -1e4 };
  let frame = 0;

  // Each letter swells (weight, optical size, softness) as the pointer nears it.
  function breathe() {
    frame = requestAnimationFrame(breathe);
    for (const ch of letters) {
      const r = ch.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      const near = Math.max(0, 1 - Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2)) / REACH);
      const goal = near * near * (3 - 2 * near);
      const prev = letterWeight.get(ch) ?? 0;
      const k = prev + (goal - prev) * 0.13;
      letterWeight.set(ch, k);
      const at = (range: number[]) => range[0] + (range[1] - range[0]) * k;
      ch.style.fontVariationSettings = `"wght" ${at(WGHT).toFixed(0)}, "opsz" ${at(OPSZ).toFixed(0)}, "SOFT" ${at(SOFT).toFixed(0)}, "WONK" 1`;
    }
  }

  if (!reduced) {
    addEventListener("pointermove", (e) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
    }, { passive: true, signal });
    addEventListener("pointerleave", () => { pointer.x = pointer.y = -1e4; }, { signal });
  }

  // Stops the sequence quietly if the page unmounts mid-intro.
  const pause = (ms: number) => wait(ms).then(() => { if (signal.aborted) throw new Error("intro aborted"); });

  async function play() {
    if (reduced) {
      for (const el of [word, blurb, go, mast, track, ...later]) el.style.opacity = "1";
      for (const ch of [...typed.flat(), ...blurbChars]) show(ch, true);
      return;
    }
    blurb.style.opacity = "1";
    const caret = document.createElement("i");
    caret.className = "caret";
    word.append(caret);
    const follow = (ch: HTMLElement) => {
      caret.style.translate = `${ch.offsetLeft + ch.offsetWidth}px ${ch.offsetTop}px`;
      caret.style.blockSize = `${ch.offsetHeight}px`;
    };

    await pause(1100);
    caret.classList.add("caret--on");
    await pause(300);
    for (const part of typed) await typeOut(part, follow);
    await pause(420);

    const [first] = blurbChars;
    if (first) {
      blurb.append(caret);
      caret.style.translate = `${first.offsetLeft}px ${first.offsetTop}px`;
      caret.style.blockSize = `${first.offsetHeight}px`;
    }
    await typeOut(blurbChars, follow, 15);
    await pause(240);
    caret.classList.remove("caret--on");
    setTimeout(() => caret.remove(), 420);

    go.style.opacity = "1";
    go.animate([{ opacity: 0, transform: "translate3d(0, 14px, 0)" }, { opacity: 1, transform: "none" }], { duration: 800, easing: EASE });
    await pause(360);
    fadeIn(mast, 900);
    await pause(220);
    fadeIn(track, 900);
    if (code) {
      await pause(260);
      fadeIn(code, 900);
    }

    letters = [...word.querySelectorAll<HTMLElement>(".ch")];
    breathe();
  }

  play().catch(() => {});
  return {
    dispose() { cancelAnimationFrame(frame); },
  };
}
