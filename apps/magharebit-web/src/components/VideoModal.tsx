'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useLang, type Lang } from '@/components/landing/useLang';
import { DEMO_VIDEO, parseVideoUrl } from '@/content/media';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const COPY: Record<Lang, { title: string; close: string }> = {
  ar: { title: 'فيديو تعريفي بـ MAGHAREBIT POS', close: 'إغلاق الفيديو' },
  fr: { title: 'Vidéo de démonstration MAGHAREBIT POS', close: 'Fermer la vidéo' },
  en: { title: 'MAGHAREBIT POS demo video', close: 'Close the video' },
};

/**
 * The demo video in a native <dialog>: focus stays inside, Esc and the backdrop close it, and focus returns to the
 * button that opened it. The player (iframe or <video>) exists only while the dialog is open, so YouTube/Vimeo get
 * no request before the visitor presses play, and closing stops playback.
 * Source: NEXT_PUBLIC_DEMO_VIDEO_URL (see src/content/media.ts); without one it says the video is coming soon.
 */
export default function VideoModal({ isOpen, onClose }: Props) {
  const t = useTranslations('hero');
  const { lang, isRTL } = useLang();
  const c = COPY[lang];
  const ref = useRef<HTMLDialogElement>(null);
  const video = parseVideoUrl(DEMO_VIDEO.url);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
  }, [isOpen]);

  return (
    <dialog
      ref={ref}
      aria-label={c.title}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close(); }}
      dir={isRTL ? 'rtl' : 'ltr'}
      className="m-auto w-[min(960px,calc(100vw-24px))] overflow-visible border-0 bg-transparent p-0 backdrop:bg-black/85 backdrop:backdrop-blur-[4px]"
    >
      <div className="relative overflow-hidden rounded-2xl bg-brand-950 shadow-[0_40px_100px_rgba(0,0,0,0.8)] ring-1 ring-white/10">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          aria-label={c.close}
          className="absolute end-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white transition-colors hover:bg-black/75 focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>

        {isOpen && video && (video.kind === 'youtube' || video.kind === 'vimeo') && (
          <div className="relative aspect-video w-full">
            <iframe
              src={video.embed}
              title={c.title}
              className="absolute inset-0 h-full w-full border-0"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              referrerPolicy="strict-origin-when-cross-origin"
              allowFullScreen
            />
          </div>
        )}

        {isOpen && video?.kind === 'file' && (
          // Captions (<track> per language) come with the final self-hosted file.
          <video
            src={video.src}
            poster={DEMO_VIDEO.poster ?? undefined}
            controls
            autoPlay
            playsInline
            preload="metadata"
            className="block aspect-video w-full bg-black"
          />
        )}

        {!video && (
          <div className={`px-8 py-16 text-center text-white ${isRTL ? 'font-arabic' : 'font-sans'}`}>
            <span aria-hidden="true" className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-gold-400/15 text-gold-400">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
            </span>
            <p className="mb-2 text-xl font-bold text-gold-400">{t('video_coming_soon')}</p>
            <p className="text-sm text-white/55">MAGHAREBIT POS</p>
          </div>
        )}
      </div>
    </dialog>
  );
}
