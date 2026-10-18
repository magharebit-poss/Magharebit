'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { toArabicNumerals } from '@/lib/formatters';

function useCounter(end: number, decimals: number, duration: number, active: boolean) {
  const [value, setValue] = useState('0');
  useEffect(() => {
    if (!active) return;
    let startTime: number | null = null;
    function step(ts: number) {
      if (!startTime) startTime = ts;
      const progress = Math.min((ts - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue((end * eased).toFixed(decimals));
      if (progress < 1) requestAnimationFrame(step);
      else setValue(end.toFixed(decimals));
    }
    requestAnimationFrame(step);
  }, [active, end, decimals, duration]);
  return value;
}

export default function ProofBar() {
  const t = useTranslations('proof');
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActive(true);
          obs.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const stores = useCounter(500, 0, 1500, active);
  const uptime = useCounter(99.9, 1, 1500, active);
  const rating = useCounter(4.9, 1, 1200, active);

  return (
    <section ref={ref} className="bg-brand-900 border-y border-white/[0.08] py-10 px-6" style={{ background: '#0F3D2A' }}>
      <div
        className="max-w-[900px] mx-auto text-center"
        style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr auto 1fr', gap: '0', alignItems: 'center' }}
      >

        <div>
          <div className="font-display font-extrabold text-[2rem] text-gold-400 leading-none">
            +{toArabicNumerals(stores, locale)}
          </div>
          <div className="font-arabic text-sm text-white/50 mt-1.5">{t('stores_label')}</div>
        </div>

        <div style={{ width: '1px', background: 'rgba(255,255,255,0.12)', alignSelf: 'stretch', margin: '0 1rem' }} />

        <div>
          <div className="font-display font-extrabold text-[2rem] text-gold-400 leading-none">
            {toArabicNumerals(uptime, locale)}{locale === 'ar' ? '٪' : '%'}
          </div>
          <div className="font-arabic text-sm text-white/50 mt-1.5">{t('uptime_label')}</div>
        </div>

        <div style={{ width: '1px', background: 'rgba(255,255,255,0.12)', alignSelf: 'stretch', margin: '0 1rem' }} />

        <div>
          <div className="font-display font-extrabold text-[2rem] text-gold-400 leading-none">
            {toArabicNumerals(rating, locale)}/{toArabicNumerals(5, locale)}
          </div>
          <div className="font-arabic text-sm text-white/50 mt-1.5">{t('rating_label')}</div>
        </div>

        <div style={{ width: '1px', background: 'rgba(255,255,255,0.12)', alignSelf: 'stretch', margin: '0 1rem' }} />

        <div>
          <div className="font-display font-extrabold text-[2rem] text-gold-400 leading-none">
            {toArabicNumerals(t('setup_num'), locale)}
          </div>
          <div className="font-arabic text-sm text-white/50 mt-1.5">{t('setup_label')}</div>
        </div>
      </div>
    </section>
  );
}
