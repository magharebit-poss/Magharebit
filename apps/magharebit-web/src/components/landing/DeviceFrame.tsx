import Image from 'next/image';
import type { Lang } from './useLang';
import { SCREENS, type ScreenId, type Sketch } from '@/content/media';

/**
 * A screenshot inside a drawn device: desktop till (screen on a stand), laptop, tablet or phone.
 * The screen keeps the screenshot's aspect ratio, so swapping the placeholder for the real image
 * (set `src` in src/content/media.ts) moves nothing on the page.
 */

const PLACEHOLDER: Record<Lang, (shot: string) => string> = {
  ar: (shot) => `مكان لقطة الشاشة: ${shot}`,
  fr: (shot) => `Emplacement de capture d’écran : ${shot}`,
  en: (shot) => `Screenshot placeholder: ${shot}`,
};
const CHIP: Record<Lang, string> = { ar: 'لقطة شاشة قريباً', fr: 'Capture à venir', en: 'Screenshot coming' };

export default function DeviceFrame({
  screen,
  lang,
  priority = false,
  sizes = '(min-width: 768px) 50vw, 100vw',
}: {
  screen: ScreenId;
  lang: Lang;
  priority?: boolean;
  sizes?: string;
}) {
  const slot = SCREENS[screen];
  const ratio = `${slot.width} / ${slot.height}`;

  const display = slot.src ? (
    <Image
      src={slot.src}
      alt={slot.alt[lang]}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover object-top"
    />
  ) : (
    <div role="img" aria-label={PLACEHOLDER[lang](slot.shot[lang])} className="absolute inset-0">
      <ScreenSketch kind={slot.sketch} />
      {/* Wraps on narrow frames (the phone at 375 px) instead of clipping */}
      <span className="absolute inset-x-0 bottom-[6%] z-10 mx-auto flex w-fit max-w-[90%] items-center gap-1.5 rounded-xl border border-gold-400/40 bg-brand-950/90 px-3 py-1 text-center text-[11px] font-semibold leading-snug text-gold-400 sm:text-xs">
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
        <span>{CHIP[lang]} · {slot.shot[lang]}</span>
      </span>
    </div>
  );

  const glass = (
    <div className="relative overflow-hidden bg-brand-950" style={{ aspectRatio: ratio }}>
      {display}
    </div>
  );

  if (slot.device === 'phone') {
    return (
      <figure data-screen={screen} className="relative m-0 mx-auto w-[min(260px,62%)]">
        <div className="rounded-[2.2rem] border border-white/15 bg-[#06150E] p-[7px] shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
          <div className="relative overflow-hidden rounded-[1.75rem]">
            {glass}
            <span aria-hidden="true" className="absolute inset-x-0 top-2 z-10 mx-auto h-[14px] w-[34%] rounded-full bg-[#06150E]" />
          </div>
        </div>
      </figure>
    );
  }

  if (slot.device === 'tablet') {
    return (
      <figure data-screen={screen} className="relative m-0 w-full">
        <div className="rounded-[1.6rem] border border-white/15 bg-[#06150E] p-[12px] shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
          <div className="overflow-hidden rounded-[0.9rem]">{glass}</div>
        </div>
      </figure>
    );
  }

  if (slot.device === 'laptop') {
    return (
      <figure data-screen={screen} className="relative m-0 w-full">
        <div className="mx-[6%] rounded-t-[1rem] border border-b-0 border-white/15 bg-[#06150E] p-[10px] pb-[12px]">
          <div className="overflow-hidden rounded-[0.35rem]">{glass}</div>
        </div>
        <div aria-hidden="true" className="relative h-[14px] rounded-b-[14px] bg-gradient-to-b from-[#2A4A3B] to-[#14281F] shadow-[0_24px_40px_rgba(0,0,0,0.5)]">
          <span className="absolute inset-x-0 top-0 mx-auto h-[5px] w-[16%] rounded-b-md bg-[#0B1D15]" />
        </div>
      </figure>
    );
  }

  // desktop: all-in-one till, screen on a stand
  return (
    <figure data-screen={screen} className="relative m-0 w-full">
      <div className="rounded-[1.1rem] border border-white/15 bg-[#06150E] p-[12px] shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
        <div className="overflow-hidden rounded-[0.45rem]">{glass}</div>
      </div>
      <div aria-hidden="true" className="mx-auto h-[34px] w-[14%] bg-gradient-to-b from-[#14281F] to-[#1F3A2D]" />
      <div aria-hidden="true" className="mx-auto h-[10px] w-[38%] rounded-t-[6px] rounded-b-[12px] bg-gradient-to-b from-[#2A4A3B] to-[#14281F] shadow-[0_14px_30px_rgba(0,0,0,0.45)]" />
    </figure>
  );
}

// ── Placeholder screens: a quiet sketch of the real layout, in brand tones, no fake text or numbers ──

const BLOCK = 'rounded-[3px] bg-white/[0.07]';

function ScreenSketch({ kind }: { kind: Sketch }) {
  if (kind === 'pos') {
    return (
      <div aria-hidden="true" className="absolute inset-0 flex gap-[3%] p-[4%]">
        <div className="grid flex-[1.6] grid-cols-4 grid-rows-3 gap-[4%]">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className={`${BLOCK} flex flex-col justify-end p-[8%] ${i === 5 ? 'ring-1 ring-gold-400/60' : ''}`}>
              <span className="mb-[6%] block h-[38%] rounded-[2px] bg-white/[0.06]" />
              <span className="block h-[9%] w-3/4 rounded-full bg-white/15" />
              <span className="mt-[6%] block h-[8%] w-1/3 rounded-full bg-gold-400/50" />
            </div>
          ))}
        </div>
        <div className={`${BLOCK} flex flex-1 flex-col gap-[4%] p-[5%]`}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-[6%]">
              <span className="block h-[10px] flex-1 rounded-full bg-white/10" />
              <span className="block h-[10px] w-1/5 rounded-full bg-white/20" />
            </div>
          ))}
          <div className="mt-auto rounded-[3px] bg-gold-400/90 py-[8%]" />
        </div>
      </div>
    );
  }
  if (kind === 'dashboard') {
    return (
      <div aria-hidden="true" className="absolute inset-0 flex gap-[3%] p-[3.5%]">
        <div className={`${BLOCK} w-[16%]`} />
        <div className="flex flex-1 flex-col gap-[4%]">
          <div className="grid grid-cols-4 gap-[3%]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className={`${BLOCK} p-[8%]`}>
                <span className="block h-[6px] w-1/2 rounded-full bg-white/15" />
                <span className={`mt-[10%] block h-[12px] w-3/4 rounded-full ${i === 0 ? 'bg-gold-400/70' : 'bg-white/25'}`} />
              </div>
            ))}
          </div>
          <div className={`${BLOCK} flex flex-1 items-end gap-[4%] p-[4%]`}>
            {[42, 58, 36, 70, 52, 64, 88].map((h, i) => (
              <span key={i} className={`block flex-1 rounded-t-[2px] ${i === 6 ? 'bg-gold-400/80' : 'bg-[#2E8B57]/70'}`} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }
  // mobile
  return (
    <div aria-hidden="true" className="absolute inset-0 flex flex-col gap-[3%] px-[7%] pb-[6%] pt-[16%]">
      <div className={`${BLOCK} p-[7%]`}>
        <span className="block h-[8px] w-2/5 rounded-full bg-white/15" />
        <span className="mt-[6%] block h-[16px] w-3/5 rounded-full bg-gold-400/70" />
      </div>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={`${BLOCK} flex items-center gap-[6%] p-[5%]`}>
          <span className="block aspect-square w-[16%] rounded-[3px] bg-white/10" />
          <span className="block h-[8px] flex-1 rounded-full bg-white/10" />
          <span className="block h-[8px] w-1/5 rounded-full bg-white/20" />
        </div>
      ))}
      <div className="mt-auto rounded-full bg-gold-400/90 py-[6%]" />
    </div>
  );
}
