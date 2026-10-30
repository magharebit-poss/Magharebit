'use client';

import { useState } from 'react';
import Image from 'next/image';
import VideoModal from '@/components/VideoModal';
import { DEMO_VIDEO, parseVideoUrl } from '@/content/media';
import { useLang, type Lang } from './useLang';

const COPY: Record<Lang, { badge: string; title: string; subtitle: string; play: string; soon: string; points: string[] }> = {
  ar: {
    badge: 'شاهد',
    title: 'MAGHAREBIT في متجر حقيقي',
    subtitle: 'من أول عملية بيع إلى تقرير المساء: كيف يبدو يوم عمل مع الصندوق.',
    play: 'تشغيل الفيديو التعريفي',
    soon: 'الفيديو قريباً',
    points: ['بيع بالباركود والميزان', 'وصل مطبوع باسم متجرك', 'العمل بدون إنترنت'],
  },
  fr: {
    badge: 'En vidéo',
    title: 'MAGHAREBIT dans une vraie boutique',
    subtitle: 'De la première vente au rapport du soir : une journée de travail avec la caisse.',
    play: 'Lire la vidéo de démonstration',
    soon: 'Vidéo bientôt disponible',
    points: ['Vente au code-barres et à la balance', 'Ticket à votre nom', 'Fonctionne sans internet'],
  },
  en: {
    badge: 'Watch',
    title: 'MAGHAREBIT in a real shop',
    subtitle: 'From the first sale to the evening report: a working day with the till.',
    play: 'Play the demo video',
    soon: 'Video coming soon',
    points: ['Barcode and scale sales', 'A receipt with your shop’s name', 'Works without internet'],
  },
};

/** Video block below the hero: a cover with a play button; the player itself loads only on click. */
export default function VideoSection() {
  const { lang, isRTL } = useLang();
  const c = COPY[lang];
  const [open, setOpen] = useState(false);
  const hasVideo = parseVideoUrl(DEMO_VIDEO.url) !== null;

  return (
    <section
      id="video"
      aria-labelledby="video-heading"
      dir={isRTL ? 'rtl' : 'ltr'}
      className={`${isRTL ? 'font-arabic' : 'font-sans'} scroll-mt-20 bg-brand-950 px-4 py-16 sm:px-6 md:py-24`}
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-10 text-center">
          <span className="mb-4 inline-block rounded-full border border-[#F0B429]/50 px-4 py-1.5 text-sm font-semibold text-[#F0B429]">
            {c.badge}
          </span>
          <h2 id="video-heading" className="mb-3 font-bold text-white" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)', lineHeight: 1.25 }}>
            {c.title}
          </h2>
          <p className="mx-auto max-w-[560px] text-base leading-[1.8] text-white/65">{c.subtitle}</p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="group relative block w-full overflow-hidden rounded-[1.25rem] border border-white/10 bg-brand-900 text-start shadow-[0_30px_80px_rgba(0,0,0,0.45)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold-400"
          style={{ aspectRatio: '16 / 9' }}
        >
          {DEMO_VIDEO.poster ? (
            <Image src={DEMO_VIDEO.poster} alt="" fill sizes="(min-width: 1100px) 1100px, 100vw" className="object-cover" />
          ) : (
            <span aria-hidden="true" className="absolute inset-0">
              {/* Branded cover until the real poster frame exists */}
              <span
                className="absolute inset-0"
                style={{
                  backgroundColor: '#F0B429',
                  WebkitMaskImage: "url('/brand/zellige-pattern.svg')",
                  maskImage: "url('/brand/zellige-pattern.svg')",
                  WebkitMaskSize: '368px 506.7px',
                  maskSize: '368px 506.7px',
                  opacity: 0.06,
                }}
              />
              <span className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 60% at 50% 50%, rgba(240,180,41,0.18), transparent 70%)' }} />
            </span>
          )}
          <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-brand-950/80 via-transparent to-transparent" />

          {/* Play button */}
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-gold-400 text-brand-950 shadow-[0_0_0_12px_rgba(240,180,41,0.18)] transition-transform group-hover:scale-105 motion-reduce:transition-none sm:h-24 sm:w-24">
              <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="currentColor" className="translate-x-[2px]"><path d="M8 5.5v13l11-6.5z" /></svg>
            </span>
          </span>

          <span className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 p-5 sm:p-7">
            <span className="text-base font-bold text-white sm:text-lg">{c.play}</span>
            {!hasVideo && (
              <span className="rounded-full border border-gold-400/40 bg-brand-950/90 px-3 py-1 text-xs font-semibold text-gold-400">{c.soon}</span>
            )}
          </span>
        </button>

        <ul className="mt-8 flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-white/75">
          {c.points.map((p) => (
            <li key={p} className="flex items-center gap-2">
              <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-gold-400" />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <VideoModal isOpen={open} onClose={() => setOpen(false)} />
    </section>
  );
}
