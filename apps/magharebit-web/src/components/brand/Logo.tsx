import Image from 'next/image';

/**
 * MAGHAREBIT brand mark.
 *
 * `on` is the background the logo sits on, not the file suffix. The asset
 * names are not consistent between families:
 *   emblem-light.svg            → reversed (white + gold), for DARK backgrounds
 *   emblem-dark.svg             → pine + gold,             for LIGHT backgrounds
 *   logo-horizontal-dark.svg    → reversed,                for DARK backgrounds
 *   logo-horizontal-light.svg   → pine + gold,             for LIGHT backgrounds
 * Keeping the mapping here means call sites never have to remember it.
 */

export type LogoVariant = 'emblem' | 'horizontal';
export type LogoBackground = 'dark' | 'light';

const SRC: Record<LogoVariant, Record<LogoBackground, string>> = {
  emblem: {
    dark: '/brand/emblem-light.svg',
    light: '/brand/emblem-dark.svg',
  },
  horizontal: {
    dark: '/brand/logo-horizontal-dark.svg',
    light: '/brand/logo-horizontal-light.svg',
  },
};

/** Intrinsic viewBox sizes of the delivered SVGs. */
const RATIO: Record<LogoVariant, { w: number; h: number }> = {
  emblem: { w: 240, h: 280 },
  horizontal: { w: 453, h: 120 },
};

export interface LogoProps {
  /** `emblem` = shield only, `horizontal` = emblem + wordmark lockup. */
  variant?: LogoVariant;
  /** Background the logo is placed on. Picks the correct colorway. */
  on?: LogoBackground;
  /** Rendered height in px. Width follows the asset's aspect ratio. */
  height?: number;
  /** Accessible name. Pass `""` when adjacent text already names the brand. */
  alt?: string;
  className?: string;
  priority?: boolean;
}

export default function Logo({
  variant = 'horizontal',
  on = 'dark',
  height = 40,
  alt = 'MAGHAREBIT',
  className,
  priority = false,
}: LogoProps) {
  const { w, h } = RATIO[variant];
  const width = Math.round((height * w) / h);

  return (
    <Image
      src={SRC[variant][on]}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      // SVGs are already vector and tiny; skip the image optimizer.
      unoptimized
      className={className}
      style={{ width, height, flexShrink: 0 }}
    />
  );
}
