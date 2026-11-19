import type { AnchorHTMLAttributes, ButtonHTMLAttributes, CSSProperties, ReactNode, Ref } from "react";

/** Two copies of an icon: on hover the first slides out right as the second slides in. */
export function IconSwap({ children }: { children: ReactNode }) {
  return (
    <span data-slot="icon-swap" aria-hidden="true" className="icon-swap">
      <span>{children}</span>
      <span>{children}</span>
    </span>
  );
}

type Variant = "primary" | "accent";
type Size = "sm" | "md";

type SeamProps = {
  variant: Variant;
  size: Size;
  icon: ReactNode;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement & HTMLAnchorElement>;
} & (
  | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
  | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
);

/**
 * The pill CTA: a label segment and an icon cap. On hover a seam opens between
 * them and the cap rounds into a circle.
 */
export function SeamButton({ variant, size, icon, children, className = "", ref, ...rest }: SeamProps) {
  const inner = (
    <>
      <span aria-hidden="true" className="seam__bg">
        <span className="seam__body">
          <span data-slot="button-bg" className="seam__fill" />
          <span className="seam__bar" />
        </span>
        <span className="seam__cap">
          <span className="seam__fill" />
          <span className="seam__bar" />
        </span>
      </span>
      <span className="seam__label">{children}</span>
      <span className="seam__icon">
        <IconSwap>{icon}</IconSwap>
      </span>
    </>
  );
  const cls = `btn seam btn--${variant} btn--${size} ${className}`.trim();
  if (rest.href !== undefined) {
    return (
      <a data-slot="button" data-filled="true" className={cls} ref={ref} style={{ "--seam-travel": "0.35em" } as CSSProperties} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" data-slot="button" data-filled="true" className={cls} ref={ref} style={{ "--seam-travel": "0.35em" } as CSSProperties} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {inner}
    </button>
  );
}

type PlainProps = {
  variant: "ghost" | "outline" | "accent";
  size: "sm" | "icon-sm";
  children: ReactNode;
} & (
  | ({ href: string } & AnchorHTMLAttributes<HTMLAnchorElement>)
  | ({ href?: undefined } & ButtonHTMLAttributes<HTMLButtonElement>)
);

/** Ghost, outline and filled buttons: a background layer behind the content. */
export function PlainButton({ variant, size, children, className = "", ...rest }: PlainProps) {
  const cls = `btn btn--${variant} btn--${size} ${className}`.trim();
  const bg = <span data-slot="button-bg" aria-hidden="true" className="btn__bg" />;
  if (rest.href !== undefined) {
    return (
      <a data-slot="button" className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
        {bg}
        {children}
      </a>
    );
  }
  return (
    <button type="button" data-slot="button" className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
      {bg}
      {children}
    </button>
  );
}
