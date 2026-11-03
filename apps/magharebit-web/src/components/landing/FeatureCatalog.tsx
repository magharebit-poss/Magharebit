'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useLang } from './useLang';
import { SHOW_KDS } from '@/lib/brand';

const CATEGORIES = [
  { n: 1, items: [1, 2, 3, 4], icon: 'M3 4h18v12H3zM8 20h8M12 16v4' },
  { n: 2, items: [1, 2, 3, 4], icon: 'M3 7h18v12H3zM3 11h18M7 15h3' },
  { n: 3, items: [1, 2, 3, 4], icon: 'M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0' },
] as const;
const ROADMAP = [1, 2, 3, 4, 5];

/**
 * Feature catalog in three professional categories (what exists today) plus a clearly separated, dark
 * "Vision 2027 / Prochainement" block for what does NOT exist yet. Nothing in the roadmap is presented as available.
 */
export default function FeatureCatalog() {
  const t = useTranslations('feature_catalog');
  const { isRTL, locale } = useLang();
  const dir = isRTL ? 'rtl' : 'ltr';

  return (
    <>
      <section id="catalog" dir={dir} aria-labelledby="catalog-heading" className={`${isRTL ? 'font-arabic' : 'font-sans'} relative overflow-hidden bg-[#F8F9FA] px-4 py-16 sm:px-6 md:py-24`}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#0F3D2A] opacity-[0.035] [-webkit-mask-image:url('/brand/zellige-pattern.svg')] [-webkit-mask-size:368px_506.7px] [mask-image:url('/brand/zellige-pattern.svg')] [mask-size:368px_506.7px]" />
        <div className="relative mx-auto max-w-[1100px]">
          <div className="mb-12 text-center">
            <span className="mb-4 inline-flex rounded-full border border-[#B8860B]/40 bg-[#F0B429]/10 px-4 py-1.5 text-sm font-semibold text-[#8A6508]">{t('badge')}</span>
            <h2 id="catalog-heading" className={`${isRTL ? 'font-arabic' : 'font-display'} mb-3 text-balance font-bold text-[#111827]`} style={{ fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', lineHeight: 1.2 }}>{t('title')}</h2>
            <p className="mx-auto max-w-[640px] text-base leading-[1.8] text-[#6B7280]">{t('sub')}</p>
          </div>

          <div className="space-y-6">
            {CATEGORIES.map((cat) => (
              <article key={cat.n} className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_1px_3px_rgba(10,35,24,0.06)] transition-[border-color,box-shadow] duration-200 hover:border-[#B8860B]/50 hover:shadow-xl sm:p-7">
                <header className="mb-5 flex items-center gap-3">
                  <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0F3D2A] text-[#F0B429]">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={cat.icon} /></svg>
                  </span>
                  <div>
                    <h3 className="text-xl font-bold text-[#111827]">{t(`cat${cat.n}_title`)}</h3>
                    <p className="text-sm text-[#6B7280]">{t(`cat${cat.n}_sub`)}</p>
                  </div>
                </header>
                <ul className="grid gap-4 sm:grid-cols-2">
                  {cat.items
                    .filter((i) => SHOW_KDS || !(cat.n === 1 && i === 4))
                    .map((i) => (
                      <li key={i} className="flex gap-3 rounded-xl bg-[#F8F9FA] p-4">
                        <span aria-hidden="true" className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#0F3D2A] text-xs text-[#F0B429]">✓</span>
                        <span>
                          <span className="block text-[15px] font-semibold text-[#111827]">{t(`c${cat.n}i${i}_t`)}</span>
                          <span className="mt-0.5 block text-sm leading-relaxed text-[#6B7280]">{t(`c${cat.n}i${i}_x`)}</span>
                        </span>
                      </li>
                    ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section dir={dir} aria-labelledby="roadmap-heading" className={`${isRTL ? 'font-arabic' : 'font-sans'} relative overflow-hidden bg-[#0F3D2A] px-4 py-16 sm:px-6 md:py-24`}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#F0B429] opacity-[0.045] [-webkit-mask-image:url('/brand/zellige-pattern.svg')] [-webkit-mask-size:368px_506.7px] [mask-image:url('/brand/zellige-pattern.svg')] [mask-size:368px_506.7px]" />
        <div className="relative mx-auto max-w-[1100px]">
          <div className="mb-10 text-center">
            <span className="mb-4 inline-flex rounded-full border border-[#F0B429]/40 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#F0B429]">{t('rm_badge')}</span>
            <h2 id="roadmap-heading" className={`${isRTL ? 'font-arabic' : 'font-display'} mb-3 font-extrabold text-white`} style={{ fontSize: 'clamp(1.6rem, 4vw, 2.3rem)' }}>{t('rm_title')}</h2>
            <p className="mx-auto max-w-[560px] text-base leading-[1.8] text-white/70">{t('rm_sub')}</p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ROADMAP.map((i) => (
              <li key={i} className="rounded-2xl border border-dashed border-[#F0B429]/40 bg-white/[0.04] p-5 transition-colors duration-200 hover:border-[#F0B429] hover:bg-white/[0.07]">
                <span className="mb-3 inline-flex rounded-full bg-[#F0B429]/15 px-2.5 py-0.5 text-[11px] font-bold text-[#F0B429]">{t('soon')}</span>
                <h3 className="text-base font-bold text-white">{t(`rm${i}_t`)}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/65">{t(`rm${i}_x`)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-center text-sm text-white/50">{t('rm_note')}</p>
          <div className="mt-8 text-center">
            <Link href={`/${locale}/auth/signup`} className="inline-flex min-h-[52px] items-center justify-center rounded-xl bg-[#F0B429] px-7 text-base font-bold text-[#0A2318] shadow-[0_10px_30px_rgba(240,180,41,0.22)] transition-colors hover:bg-[#F5C451] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#F0B429]">{t('cta')}</Link>
          </div>
        </div>
      </section>
    </>
  );
}
