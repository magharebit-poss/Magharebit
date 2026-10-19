// MAGHAREBIT horizontal lockup (emblem + wordmark + Arabic wordmark) for DARK
// backgrounds: logo-horizontal-dark.svg. Prefer a height of 32px; at 28px the
// Arabic line is very small. The artwork is fixed-direction, so it is wrapped in
// dir="ltr" and never mirrors in RTL layouts.

interface Props {
  /** Rendered height in px (32 recommended). Width follows the 453:120 ratio. */
  height?: number;
  /** Localised alt text from the dictionary (t.brand.logoAlt). */
  alt: string;
}

const ASPECT = 453 / 120;

export function BrandLockup({ height = 32, alt }: Props) {
  return (
    <span dir="ltr" style={{ display: 'inline-flex', flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/logo-horizontal-dark.svg"
        alt={alt}
        height={height}
        width={Math.round(height * ASPECT)}
        draggable={false}
        style={{ display: 'block', height, width: 'auto' }}
      />
    </span>
  );
}
