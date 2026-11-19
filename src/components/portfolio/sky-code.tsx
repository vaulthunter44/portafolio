"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { UI } from "./content";
import type { Lang } from "./lang";
import { tick } from "./sound";

const BEAT = 62;   // ms per character, the same rhythm as the title

/**
 * `sky = true;` written in the sky. Clicking the value retypes it and turns
 * the sky picture on or off (the field and everything else stay).
 */
export function SkyCode({ root, lang }: { root: RefObject<HTMLDivElement | null>; lang: Lang }) {
  // starts off: the visitor paints the sky in by switching it to true
  const [on, setOn] = useState(false);
  const [text, setText] = useState("false");
  const [typing, setTyping] = useState(false);
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const apply = (show: boolean) => {
    setOn(show);
    root.current?.setAttribute("data-sky", show ? "on" : "off");
  };

  const toggle = () => {
    if (typing) return;
    const next = !on;
    const target = String(next);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setText(target);
      apply(next);
      return;
    }
    setTyping(true);
    const later = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, ms));
    let at = 0;
    for (let i = text.length - 1; i >= 0; i--) {
      at += BEAT * (0.46 + 0.18 * Math.random());
      later(at, () => { setText(text.slice(0, i)); tick(); });
    }
    at += 180;
    for (let i = 1; i <= target.length; i++) {
      at += BEAT * (0.74 + 0.52 * Math.random());
      later(at, () => { setText(target.slice(0, i)); tick(); });
    }
    later(at + 120, () => { apply(next); setTyping(false); });
  };

  return (
    <p className="hero__code" data-typing={typing || undefined}>
      <span className="tok-name">{UI.sky[lang]}</span>
      <span className="tok-op">=</span>
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? UI.skyOn[lang] : UI.skyOff[lang]}
        onClick={toggle}
      >
        <span className="tok-value">{text}</span>
        <i className="code-caret" aria-hidden="true" />
      </button>
      <span className="tok-op">;</span>
    </p>
  );
}
