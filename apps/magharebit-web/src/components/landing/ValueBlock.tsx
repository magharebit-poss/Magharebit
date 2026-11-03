'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLang } from './useLang';
import { waUrl } from '@/lib/brand';

const PILLAR_ICONS = [
  'M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01',
  'M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5A8.5 8.5 0 1 1 21 11.5ZM8.5 10.5h7M8.5 13.5h4.5',
  'M12 3l8 3v6c0 5-3.4 8.4-8 9-4.6-.6-8-4-8-9V6zM9 12l2 2 4-4',
];

/**
 * Replaces the former testimonial: no person, business, city, rating or figure, only an invitation and three
 * product facts. Green section with gold accents between the dark pricing and the light FAQ.
 */
export default function ValueBlock() {
  const t = useTranslations('value_block');
  const { isRTL, locale } = useLang();

  return (
    <section dir={isRTL ? 'rtl' : 'ltr'} aria-labelledby="value-heading" className={`${isRTL ? 'font-arabic' : 'font-sans'} relative overflow-hidden bg-[#0F3D2A] px-6 py-20 sm:py-24`}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#F0B429] opacity-[0.045] [-webkit-mask-image:url('/brand/zellige-pattern.svg')] [-webkit-mask-size:368px_506.7px] [mask-image:url('/brand/zellige-pattern.svg')] [mask-size:368px_506.7px]" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%] bg-[radial-gradient(ellipse_55%_70%_at_50%_100%,rgba(240,180,41,0.14),transparent_70%)]" />
      <div className="relative mx-auto max-w-[1000px] text-center">
        <p className="mb-4 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-[#F0B429]">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 1.5l2.6 4.2 4.8-1.1-1.1 4.8 4.2 2.6-4.2 2.6 1.1 4.8-4.8-1.1L12 22.5l-2.6-4.2-4.8 1.1 1.1-4.8L1.5 12l4.2-2.6-1.1-4.8 4.8 1.1z" /></svg>
          {t('kicker')}
        </p>
        <h2 id="value-heading" className={`${isRTL ? 'font-arabic' : 'font-display'} mx-auto max-w-[760px] text-balance text-[clamp(1.6rem,3.8vw,2.6rem)] font-extrabold leading-[1.15] text-white`}>{t('title')}</h2>
        <p className="mx-auto mt-5 max-w-[660px] text-lg leading-[1.8] text-white/70">{t('sub')}</p>

        <ul className="mt-12 grid gap-4 text-start sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <li key={i} className="rounded-2xl border border-white/10 bg-white/[0.05] p-6 transition-colors duration-200 hover:border-[#F0B429]/45">
              <span aria-hidden="true" className="grid h-11 w-11 place-items-center rounded-xl bg-[#F0B429]/15 text-[#F0B429]">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d={PILLAR_ICONS[i - 1]} /></svg>
              </span>
              <h3 className="mt-4 text-lg font-bold text-white">{t(`p${i}_title`)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/65">{t(`p${i}_text`)}</p>
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={`/${locale}/auth/signup`}
            className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-[#F0B429] px-7 text-base font-bold text-[#0A2318] shadow-[0_10px_30px_rgba(240,180,41,0.22)] transition-colors hover:bg-[#F5C451] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F0B429]"
            data-testid="value-cta"
          >
            {t('cta')}
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </Link>
          <a
            href={waUrl()} target="_blank" rel="noopener noreferrer"
            className="inline-flex min-h-[52px] items-center justify-center rounded-xl border border-white/25 px-7 text-base font-semibold text-white transition-colors hover:border-[#F0B429] hover:text-[#F0B429] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F0B429]"
          >
            {t('wa')}
          </a>
        </div>
        <p className="mt-5 text-sm text-white/50">{t('note')}</p>
      </div>
    </section>
  );
}
