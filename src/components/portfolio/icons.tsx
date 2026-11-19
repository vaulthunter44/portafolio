const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export function GoIcon() {
  return (
    <svg viewBox="0 0 16 16" strokeWidth="1.5" {...stroke}>
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg viewBox="0 0 16 16" strokeWidth="1.5" {...stroke}>
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" />
      <path d="M2.6 5.2 8 8.9l5.4-3.7" />
    </svg>
  );
}

export function ArrowIcon({ flip = false }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 12 12" strokeWidth="1.25" aria-hidden="true" style={flip ? { scale: "-1 1" } : undefined} {...stroke}>
      <path d="M10 6H2M5 3 2 6l3 3" />
    </svg>
  );
}

export function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13M7.12 20.45H3.56V9h3.56z" />
    </svg>
  );
}

/** The sun; a mask "bite" slides in with --night to make it a crescent moon. */
export function SunIcon() {
  return (
    <svg className="sun" viewBox="0 0 20 20" aria-hidden="true">
      <mask id="sun-bite">
        <rect width="20" height="20" fill="#fff" />
        <circle className="sun__bite" cx="19" cy="2" r="5.5" fill="#000" />
      </mask>
      <circle cx="10" cy="10" r="5" fill="currentColor" mask="url(#sun-bite)" />
      <g className="sun__rays" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round">
        <path d="M10 1.4v1.6M10 17v1.6M18.6 10H17M3 10H1.4" />
        <path d="M16.1 3.9l-1.1 1.1M5 15l-1.1 1.1M16.1 16.1L15 15M5 5L3.9 3.9" />
      </g>
    </svg>
  );
}

/** A small globe: the Earth the models learn to read. */
export function MarkGlyph() {
  return (
    <svg className="mark__glyph" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <ellipse cx="12" cy="12" rx="3.9" ry="9" />
      <path d="M3.4 9h17.2M3.4 15h17.2" />
    </svg>
  );
}
