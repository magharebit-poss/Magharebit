// Ambient zellige lattice for dark brand screens (activation, license gate, login).
// The pattern's stroke is pine green, which vanishes on Deep Forest, so it is used
// as a MASK over Moroccan Gold at 4–6% opacity (brand-handoff README).
//
// Rules: behind content only, never over product UI. The parent must be
// position: relative/fixed, and its content must sit above this layer
// (position: relative; z-index: 1).

interface Props {
  /** 0.04–0.06 per the brand rules. */
  opacity?: number;
}

export function ZelligeBackdrop({ opacity = 0.05 }: Props) {
  const mask = "url('/brand/zellige-pattern.svg')";
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
        backgroundColor: 'var(--color-gold-400)',
        opacity,
        WebkitMaskImage: mask,
        maskImage: mask,
        WebkitMaskRepeat: 'repeat',
        maskRepeat: 'repeat',
        WebkitMaskSize: '368px 506.7px',
        maskSize: '368px 506.7px',
      }}
    />
  );
}
