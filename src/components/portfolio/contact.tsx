"use client";

import { Popover } from "@base-ui/react/popover";
import { useId, useState } from "react";
import { SeamButton } from "./buttons";
import { CV_URL, EMAIL, LINKEDIN_URL, UI } from "./content";
import { GoIcon, LinkedInIcon, MailIcon } from "./icons";
import type { Lang } from "./lang";

/** The ways to reach me, as a list of links. Shared by the popover and the last chapter. */
export function ContactLinks({ lang }: { lang: Lang }) {
  return (
    <ul className="contact__links">
      <li>
        <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
          <LinkedInIcon />
          <span>LinkedIn</span>
          <span className="contact__hint">/in/erickmollinedolara</span>
        </a>
      </li>
      {EMAIL && (
        <li>
          <a href={`mailto:${EMAIL}`}>
            <MailIcon />
            <span>{UI.email[lang]}</span>
            <span className="contact__hint">{EMAIL}</span>
          </a>
        </li>
      )}
      {CV_URL && (
        <li>
          <a href={CV_URL} download>
            <GoIcon />
            <span>{UI.cv[lang]}</span>
          </a>
        </li>
      )}
    </ul>
  );
}

export function Contact({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={(props) => (
          <SeamButton {...(props as object)} variant="accent" size="sm" icon={<MailIcon />} className="contact__trigger">
            {UI.contact[lang]}
          </SeamButton>
        )}
      />
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={({ anchor }) => -anchor.height} collisionPadding={16} className="contact__positioner">
          <Popover.Popup className="contact" aria-labelledby={titleId}>
            <div className="contact__body">
              <p className="contact__kicker">{UI.contact[lang]}</p>
              <p className="contact__title" id={titleId}>{UI.talk[lang]}</p>
              <p className="contact__lede">{UI.contactLede[lang]}</p>
              <ContactLinks lang={lang} />
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
