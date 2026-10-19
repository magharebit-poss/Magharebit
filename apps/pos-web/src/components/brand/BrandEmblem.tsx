// MAGHAREBIT shield emblem. Pick the variant by the BACKGROUND it sits on, not by
// the file suffix: 'onDark' → emblem-light.svg, 'onLight' → emblem-dark.svg.
// The SVGs are bundled in /public/brand (no remote requests, works offline).

interface Props {
  variant: 'onDark' | 'onLight';
  /** Rendered height in px; width follows the 240:280 emblem aspect ratio. */
  height: number;
  /** Gold glow used on the login/activation screens (dark backgrounds only). */
  glow?: boolean;
  /** Localised alt text from the dictionary (t.brand.logoAlt). */
  alt: string;
}

const ASPECT = 240 / 280;

export function BrandEmblem({ variant, height, glow = false, alt }: Props) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={variant === 'onDark' ? '/brand/emblem-light.svg' : '/brand/emblem-dark.svg'}
      alt={alt}
      height={height}
      width={Math.round(height * ASPECT)}
      draggable={false}
      style={{
        display: 'block',
        height,
        width: 'auto',
        flexShrink: 0,
        filter: glow ? 'drop-shadow(0 0 32px rgba(240,180,41,0.45))' : undefined,
      }}
    />
  );
}
