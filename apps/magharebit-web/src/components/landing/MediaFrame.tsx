import type { ReactNode } from 'react';

interface Props {
  /** Id from the media manifest (docs/landing-ux-plan.md), e.g. "C1", "R2". */
  mediaId: string;
  /** Reserved aspect box: prevents layout shift when real media replaces the illustration. */
  aspect?: '4/3' | '16/10';
  /** Accessible description of what the frame shows. */
  label: string;
  children: ReactNode;
}

/**
 * Fixed-aspect, brand-styled frame for a feature clip or hardware render.
 * Phase 1 renders an illustration inside it; later phases swap in the poster /
 * video for the same media id without changing the surrounding layout.
 */
export default function MediaFrame({ mediaId, aspect = '4/3', label, children }: Props) {
  return (
    <figure
      data-media-id={mediaId}
      className="relative m-0 w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-900 to-brand-950"
      style={{ aspectRatio: aspect === '4/3' ? '4 / 3' : '16 / 10' }}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% 55%, rgba(240,180,41,0.14), transparent 70%)',
        }}
      />
      <div role="img" aria-label={label} className="absolute inset-0 flex items-center justify-center p-6">
        {children}
      </div>
    </figure>
  );
}
