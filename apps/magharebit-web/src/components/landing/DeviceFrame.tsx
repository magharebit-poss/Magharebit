import Image from 'next/image';
import type { Lang } from './useLang';
import { SCREENS, type ScreenId, type Sketch } from '@/content/media';
import { CheckoutScreen, DashboardScreen, MobileScreen, WhatsAppScreen } from './ScreenMockups';

/**
 * A screenshot inside a drawn device: desktop till (screen on a stand), laptop, tablet or phone.
 * The screen keeps the screenshot's aspect ratio, so swapping the placeholder for the real image
 * (set `src` in src/content/media.ts) moves nothing on the page.
 */

const PLACEHOLDER: Record<Lang, (shot: string) => string> = {
  ar: (shot) => `معاينة توضيحية: ${shot}`,
  fr: (shot) => `Aperçu illustratif : ${shot}`,
  en: (shot) => `Illustrative preview: ${shot}`,
};
// The drawn screens use demo data: the caption under the device says so, so they never pass for a real merchant's
// figures. It sits outside the screen so it hides nothing.
const CAPTION: Record<Lang, string> = {
  ar: 'معاينة توضيحية · بيانات تجريبية',
  fr: 'Aperçu illustratif · données de démonstration',
  en: 'Illustrative preview · demo data',
};

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
      <Mockup kind={slot.sketch} lang={lang} />
    </div>
  );

  const caption = slot.src ? null : (
    <figcaption className="mt-4 text-center text-xs text-white/45">{CAPTION[lang]}</figcaption>
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
        {caption}
      </figure>
    );
  }

  if (slot.device === 'tablet') {
    return (
      <figure data-screen={screen} className="relative m-0 w-full">
        <div className="rounded-[1.6rem] border border-white/15 bg-[#06150E] p-[12px] shadow-[0_30px_60px_rgba(0,0,0,0.5)]">
          <div className="overflow-hidden rounded-[0.9rem]">{glass}</div>
        </div>
        {caption}
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
        {caption}
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
      {caption}
    </figure>
  );
}

// ── Illustrative screens (ScreenMockups.tsx) until the real screenshot is set ──

function Mockup({ kind, lang }: { kind: Sketch; lang: Lang }) {
  if (kind === 'checkout') return <CheckoutScreen lang={lang} variant="shop" />;
  if (kind === 'order') return <CheckoutScreen lang={lang} variant="cafe" />;
  if (kind === 'mobile') return <MobileScreen lang={lang} />;
  if (kind === 'whatsapp') return <WhatsAppScreen lang={lang} />;
  return <DashboardScreen lang={lang} />;
}
