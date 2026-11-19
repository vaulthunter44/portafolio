"use client";

import { useId, type Ref } from "react";
import { IconSwap, PlainButton } from "./buttons";
import { ContactLinks } from "./contact";
import { CHAPTERS, UI } from "./content";
import { ArrowIcon } from "./icons";
import type { Lang } from "./lang";

type Props = {
  lang: Lang;
  chapter: number;
  /** Jump to a chapter by number. */
  onGo: (chapter: number) => void;
  /** The chapter before (-1) or after (1). */
  onTurn: (by: number) => void;
  titleRef?: Ref<HTMLHeadingElement>;
};

/** The card beside the painting: what this stop of the tour is about. */
export function ChapterCard({ lang, chapter, onGo, onTurn, titleRef }: Props) {
  const c = CHAPTERS[chapter];
  const titleId = useId();

  return (
    <aside className="chapter" aria-labelledby={titleId}>
      <div className="chapter__page" key={c.id} aria-live="polite">
        <p className="chapter__kicker">{c.kicker[lang]}</p>
        <h2 className="chapter__title" id={titleId} ref={titleRef} tabIndex={-1}>{c.title[lang]}</h2>
        {c.meta && <p className="chapter__meta">{c.meta[lang]}</p>}
        {c.body && <p className="chapter__body">{c.body[lang]}</p>}
        {c.list && (
          <ul className="chapter__list">
            {c.list.map((item) => (
              <li key={item.label.en}>
                <span>{item.label[lang]}</span>
                {item.note && <span className="chapter__note">{item.note[lang]}</span>}
              </li>
            ))}
          </ul>
        )}
        {c.tags && (
          <ul className="chapter__tags">
            {c.tags.map((tag) => <li key={tag}>{tag}</li>)}
          </ul>
        )}
        {c.id === "contact" && <ContactLinks lang={lang} />}
      </div>
      <nav className="chapter__nav" aria-label={UI.chapterOf[lang]}>
        <PlainButton variant="ghost" size="icon-sm" aria-label={UI.previous[lang]} onClick={() => onTurn(-1)}>
          <IconSwap><ArrowIcon /></IconSwap>
        </PlainButton>
        <ol className="chapter__dots">
          {CHAPTERS.map((other, i) => (
            <li key={other.id}>
              <button
                type="button"
                aria-label={`${UI.chapterOf[lang]} ${i + 1}: ${other.kicker[lang]}`}
                aria-current={i === chapter ? "step" : undefined}
                onClick={() => onGo(i)}
              />
            </li>
          ))}
        </ol>
        <PlainButton variant="ghost" size="icon-sm" aria-label={UI.next[lang]} onClick={() => onTurn(1)}>
          <IconSwap><ArrowIcon flip /></IconSwap>
        </PlainButton>
      </nav>
    </aside>
  );
}
