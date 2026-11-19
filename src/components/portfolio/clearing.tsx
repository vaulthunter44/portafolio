"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconSwap, PlainButton, SeamButton } from "./buttons";
import { ChapterCard } from "./chapter-card";
import { Contact } from "./contact";
import { UI } from "./content";
import { ArrowIcon, GoIcon, MarkGlyph, SunIcon } from "./icons";
import { lang as currentLang, onLang, setLang, type Lang } from "./lang";
import { SITUATIONS } from "./scenes";
import { SkyCode } from "./sky-code";
import { onDusk, setTheme, theme } from "./theme";

type Mode = "cover" | "tour";

function HomeMark({ lang }: { lang: Lang }) {
  return (
    <span className="mark" data-home="true">
      <MarkGlyph />
      <span className="mark__say" data-tip="">{UI.here[lang]}</span>
    </span>
  );
}

function ThemeToggle({ lang }: { lang: Lang }) {
  const night = useSyncExternalStore(onDusk, theme, () => "day") === "night";
  const label = night ? UI.sunUp[lang] : UI.sunDown[lang];
  return (
    <PlainButton variant="ghost" size="icon-sm" aria-label={label} title={label} onClick={() => setTheme(night ? "day" : "night")}>
      <IconSwap><SunIcon /></IconSwap>
    </PlainButton>
  );
}

function LangToggle({ lang }: { lang: Lang }) {
  const other: Lang = lang === "en" ? "es" : "en";
  return (
    <PlainButton variant="ghost" size="icon-sm" className="lang" aria-label={UI.switchLang[lang]} title={UI.switchLang[lang]} lang={other} onClick={() => setLang(other)}>
      {other.toUpperCase()}
    </PlainButton>
  );
}

/** The home page: a field you can turn, under a hand-typed name. "View portfolio" walks into it. */
export function Clearing() {
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const mast = useRef<HTMLElement>(null);
  const view = useRef<HTMLButtonElement & HTMLAnchorElement>(null);
  const chapterTitle = useRef<HTMLHeadingElement>(null);
  const lang = useSyncExternalStore(onLang, currentLang, (): Lang => "en");
  const [mode, setMode] = useState<Mode>("cover");
  const [chapter, setChapter] = useState(0);

  useEffect(() => {
    const parts = { root: root.current, stage: stage.current, track: track.current, hero: hero.current, mast: mast.current };
    if (!parts.root || !parts.stage || !parts.track || !parts.hero || !parts.mast) return;
    const elements = parts as { [K in keyof typeof parts]: NonNullable<(typeof parts)[K]> };
    clearTimeout((window as unknown as { __uncover?: number }).__uncover);
    const uncover = window.setTimeout(() => elements.root.classList.remove("is-entering"), 4000);
    const follow = (e: Event) => setChapter((e as CustomEvent<number>).detail);
    elements.root.addEventListener("portfolio:chapter", follow);
    let cancelled = false;
    let unmount: (() => void) | undefined;
    import("./scene/mount-clearing").then(({ mountClearing }) => {
      if (!cancelled) unmount = mountClearing(elements);
    });
    return () => {
      cancelled = true;
      clearTimeout(uncover);
      elements.root.removeEventListener("portfolio:chapter", follow);
      unmount?.();
    };
  }, []);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // Escape walks back out to the cover.
  useEffect(() => {
    if (mode !== "tour") return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && !e.defaultPrevented) leave(); };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [mode]);

  const send = (type: "portfolio:goto" | "portfolio:turn", detail: number) => root.current?.dispatchEvent(new CustomEvent(type, { detail }));

  function enter() {
    setMode("tour");
    send("portfolio:goto", 0);
    requestAnimationFrame(() => chapterTitle.current?.focus({ preventScroll: true }));
  }

  function leave() {
    setMode("cover");
    requestAnimationFrame(() => view.current?.focus({ preventScroll: true }));
  }

  return (
    <div className="clearing is-entering" ref={root} data-sky="off" data-mode={mode}>
      {/* the watercolour sky canvas is added here by the scene */}
      <div className="sky" aria-hidden="true" />
      <section className="hero" ref={hero} inert={mode === "tour"}>
        <h1 className="hero__word">
          <span className="hero__row">
            <span data-type="true">Erick</span>
            <span data-type="true"> Mollinedo</span>
          </span>
        </h1>
        <p className="hero__blurb" key={lang}>{UI.blurb[lang]}</p>
        <p className="hero__go">
          <SeamButton ref={view} variant="primary" size="md" icon={<GoIcon />} onClick={enter}>{UI.view[lang]}</SeamButton>
        </p>
        <SkyCode root={root} lang={lang} />
      </section>
      <div className="stage" ref={stage} tabIndex={0} role="application" aria-label={UI.field[lang]} />
      {mode === "tour" && (
        <ChapterCard
          lang={lang}
          chapter={chapter}
          titleRef={chapterTitle}
          onGo={(i) => send("portfolio:goto", i)}
          onTurn={(by) => send("portfolio:turn", by)}
        />
      )}
      <header className="mast" ref={mast}>
        <div className="mast__start">
          <HomeMark lang={lang} />
          {mode === "tour" && (
            <PlainButton variant="ghost" size="sm" className="mast__home" onClick={leave}>
              <ArrowIcon /> {UI.home[lang]}
            </PlainButton>
          )}
        </div>
        <div className="mast__end">
          <ThemeToggle lang={lang} />
          <LangToggle lang={lang} />
          <Contact lang={lang} />
        </div>
      </header>
      <div className="track" ref={track} inert={mode === "tour"}>
        <div className="track__inner">
          <div className="track__bar" tabIndex={0} role="slider" aria-label={UI.turnField[lang]} aria-valuemin={0} aria-valuemax={SITUATIONS.length - 1} aria-valuenow={0}>
            <span className="track__seg track__seg--l" />
            <span className="track__seg track__seg--r" />
          </div>
          <div className="track__meta">
            <p>{UI.drag[lang]}</p>
            <p className="track__keys">
              <PlainButton variant="ghost" size="icon-sm" data-turn="-1" aria-label={UI.turnLeft[lang]}>
                <IconSwap><ArrowIcon /></IconSwap>
              </PlainButton>
              <PlainButton variant="ghost" size="icon-sm" data-turn="1" aria-label={UI.turnRight[lang]}>
                <IconSwap><ArrowIcon flip /></IconSwap>
              </PlainButton>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
