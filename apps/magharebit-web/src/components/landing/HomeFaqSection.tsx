'use client';

import { useTranslations, useLocale } from 'next-intl';
import FaqAccordion from './FaqAccordion';

export default function HomeFaqSection() {
  const t = useTranslations('pricing');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const items = [1, 2, 3, 4, 5].map((i) => ({ q: t(`faq_q${i}`), a: t(`faq_a${i}`) }));

  return (
    // Light section: white cards on the soft grey page tone, green headings, gold badge (same language as /about)
    <section dir={isRTL ? 'rtl' : 'ltr'} className="relative overflow-hidden bg-[#F8F9FA] px-6 py-20">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#0F3D2A] opacity-[0.035] [-webkit-mask-image:url('/brand/zellige-pattern.svg')] [-webkit-mask-size:368px_506.7px] [mask-image:url('/brand/zellige-pattern.svg')] [mask-size:368px_506.7px]" />
      <div className="relative mx-auto max-w-[760px]">
        <div className="mb-12 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#B8860B]/40 bg-[#F0B429]/10 px-4 py-1.5 font-sans text-[11px] font-bold uppercase tracking-[0.1em] text-[#8A6508]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5 text-[#B8860B]" fill="currentColor"><path d="M12 1.5l2.6 4.2 4.8-1.1-1.1 4.8 4.2 2.6-4.2 2.6 1.1 4.8-4.8-1.1L12 22.5l-2.6-4.2-4.8 1.1 1.1-4.8L1.5 12l4.2-2.6-1.1-4.8 4.8 1.1z" /></svg>
            {t('faq_label')}
          </span>
          <h2 className={`${isRTL ? 'font-arabic' : 'font-display'} m-0 text-balance text-[clamp(1.5rem,3vw,2rem)] font-extrabold leading-tight text-[#111827]`}>
            {t('faq_title')}
          </h2>
        </div>

        <FaqAccordion items={items} isRTL={isRTL} tone="light" />
      </div>
    </section>
  );
}
