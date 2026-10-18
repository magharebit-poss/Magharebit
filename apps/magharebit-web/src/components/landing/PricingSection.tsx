'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';

export default function PricingSection() {
  const t = useTranslations('pricing');
  const locale = useLocale();
  const [isAnnual, setIsAnnual] = useState(false);

  const prices = {
    starter:  isAnnual ? 199 : 249,
    business: isAnnual ? 599 : 749,
  };

  return (
    <section id="pricing" className="bg-brand-950 py-24 px-6">
      <div className="max-w-[1100px] mx-auto" style={{ direction: locale === 'ar' ? 'rtl' : 'ltr' }}>

        <div className="text-center mb-12">
          <span className="inline-block border border-gold-400/50 text-gold-400 bg-transparent text-sm font-semibold px-4 py-1.5 rounded-full mb-4 font-display">
            {t('label')}
          </span>
          <h2
            data-aos="fade-up"
            className="font-arabic font-bold text-white mb-3"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)' }}
          >
            {t('heading')}
          </h2>
          <p
            data-aos="fade-up"
            data-aos-delay="100"
            className="font-arabic text-white/65 text-lg"
          >
            {t('sub')}
          </p>
        </div>

        {/* Toggle */}
        <div data-aos="fade-up" className="flex flex-col items-center mb-12">
          {/* Savings badge */}
          <div
            className="font-arabic font-semibold"
            style={{
              marginBottom: '8px',
              background: 'rgba(240,180,41,0.15)',
              border: '1px solid rgba(240,180,41,0.3)',
              color: '#F0B429',
              borderRadius: '999px',
              padding: '3px 12px',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            {t('annual_badge')}
          </div>
          {/* Pill toggle */}
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '999px',
              padding: '4px',
              direction: 'ltr',
            }}
          >
            {[
              { label: t('monthly'), annual: false },
              { label: t('annual'),  annual: true  },
            ].map((opt) => (
              <button
                key={String(opt.annual)}
                onClick={() => setIsAnnual(opt.annual)}
                className="font-arabic"
                style={{
                  padding: '8px 24px',
                  borderRadius: '999px',
                  border: 'none',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: isAnnual === opt.annual ? '#F0B429' : 'transparent',
                  color: isAnnual === opt.annual ? '#0A2318' : 'rgba(255,255,255,0.65)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cards */}
        <div
          data-aos="fade-up"
          data-aos-delay="100"
          className="grid grid-cols-1 md:grid-cols-3"
          style={{ gap: '1.5rem', margin: '3rem auto 0', alignItems: 'start' }}
        >
          {/* Starter */}
          <div
            className={`card-hover ${locale === 'ar' ? 'text-right' : 'text-left'}`}
            style={{
              direction: locale === 'ar' ? 'rtl' : 'ltr',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '16px',
              padding: '32px',
              position: 'relative',
            }}
          >
            <div className="font-display font-extrabold text-xl text-white">{t('starter_name')}</div>
            <div className="font-arabic text-white/65 text-sm mb-6">{t('starter_sub')}</div>
            <div className="flex items-baseline gap-1 justify-end mb-1">
              {isAnnual && (
                <span className="font-display text-white/30 leading-none" style={{ fontSize: '1.4rem', textDecoration: 'line-through', marginInlineEnd: '4px' }}>
                  249
                </span>
              )}
              <span className="font-display font-extrabold text-white leading-none" style={{ fontSize: '2.6rem', letterSpacing: '-0.02em' }}>
                {prices.starter}
              </span>
              <span className="font-sans text-white/65 text-sm">MAD</span>
            </div>
            <div className="font-arabic text-white/65 text-xs mb-1">{t('per_month')}</div>
            {isAnnual ? (
              <div className="font-arabic text-gold-400 text-xs mb-6">{t('annual_note')}</div>
            ) : (
              <div className="mb-6" />
            )}
            <ul className="space-y-2 mb-6 list-none p-0">
              {(t.raw('starter_features') as string[]).map((f) => (
                <li key={f} className="font-arabic text-sm text-white/80 flex items-center gap-2 pb-2 border-b border-white/10">
                  <span className="text-gold-400 font-bold flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={`/${locale}/demo`}
              className="w-full py-3 rounded-2xl font-arabic font-bold text-sm border border-white/20 bg-transparent text-white hover:border-gold-400 hover:text-gold-400 transition-all cursor-pointer"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
            >
              {t('free_trial')}
            </Link>
          </div>

          {/* Business — featured */}
          <div className="relative" style={{ direction: locale === 'ar' ? 'rtl' : 'ltr', marginTop: '-1rem', paddingTop: '28px' }}>
            <div
              style={{
                position: 'absolute',
                top: '0px',
                left: '50%',
                transform: 'translateX(-50%)',
                whiteSpace: 'nowrap',
                zIndex: 10,
                background: '#F0B429',
                color: '#0A2318',
                fontFamily: 'Noto Naskh Arabic, Cairo, serif',
                fontWeight: 700,
                fontSize: '13px',
                padding: '4px 16px',
                borderRadius: '999px',
              }}
            >
              {t('most_popular')}
            </div>
            <div
              className={`card-hover pricing-featured-glow ${locale === 'ar' ? 'text-right' : 'text-left'}`}
              style={{
                transform: 'scale(1.03)',
                position: 'relative',
                zIndex: 10,
                border: '2px solid #F0B429',
                background: 'rgba(240,180,41,0.06)',
                borderRadius: '16px',
                padding: '32px',
              }}
            >
              <div className="font-display font-extrabold text-xl text-white">{t('business_name')}</div>
              <div className="font-arabic text-white/60 text-sm mb-6">{t('business_sub')}</div>
              <div className="flex items-baseline gap-1 justify-end mb-1">
                {isAnnual && (
                  <span className="font-display text-white/30 leading-none" style={{ fontSize: '1.4rem', textDecoration: 'line-through', marginInlineEnd: '4px' }}>
                    749
                  </span>
                )}
                <span className="font-display font-extrabold text-white leading-none" style={{ fontSize: '2.6rem', letterSpacing: '-0.02em' }}>
                  {prices.business}
                </span>
                <span className="font-sans text-white/50 text-sm">MAD</span>
              </div>
              <div className="font-arabic text-white/50 text-xs mb-1">{t('per_month')}</div>
              {isAnnual ? (
                <div className="font-arabic text-gold-400 text-xs mb-6">{t('annual_note')}</div>
              ) : (
                <div className="mb-6" />
              )}
              <ul className="space-y-2 mb-6 list-none p-0">
                {(t.raw('business_features') as string[]).map((f) => (
                  <li key={f} className="font-arabic text-sm text-white/80 flex items-center gap-2 pb-2 border-b border-white/10">
                    <span className="text-gold-400 font-bold flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/${locale}/demo`}
                className="w-full py-3 rounded-2xl font-arabic font-bold text-sm bg-gold-400 text-brand-950 hover:bg-gold-500 transition-all shadow-[0_4px_16px_rgba(240,180,41,0.4)] cursor-pointer"
                style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
              >
                {t('free_trial')}
              </Link>
            </div>
          </div>

          {/* Enterprise */}
          <div
            className={`card-hover ${locale === 'ar' ? 'text-right' : 'text-left'}`}
            style={{
              direction: locale === 'ar' ? 'rtl' : 'ltr',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '16px',
              padding: '32px',
              position: 'relative',
            }}
          >
            <div className="font-display font-extrabold text-xl text-white">{t('enterprise_name')}</div>
            <div className="font-arabic text-white/65 text-sm mb-6">{t('enterprise_sub')}</div>
            <div className="font-arabic text-[1.75rem] font-bold text-white mb-1">{t('enterprise_custom_pricing')}</div>
            <div className="font-arabic text-white/65 text-sm mb-6">{t('enterprise_contact_label')}</div>
            <ul className="space-y-2 mb-6 list-none p-0">
              {(t.raw('enterprise_features') as string[]).map((f) => (
                <li key={f} className="font-arabic text-sm text-white/80 flex items-center gap-2 pb-2 border-b border-white/10">
                  <span className="text-gold-400 font-bold flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
            <a
              href="https://wa.me/212619522487"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-2xl font-arabic font-bold text-sm border border-white/20 bg-transparent text-white hover:border-gold-400 hover:text-gold-400 transition-all cursor-pointer cta-wa-btn"
              style={{ display: 'block', textAlign: 'center', textDecoration: 'none' }}
            >
              {t('contact_us')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
