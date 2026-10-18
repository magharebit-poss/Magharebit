'use client';

import { useTranslations, useLocale } from 'next-intl';
import RevealSection from '@/components/RevealSection';
import AvailabilityIndicator from '@/components/AvailabilityIndicator';
import Link from 'next/link';

export default function CTASection() {
  const t = useTranslations('cta');
  const locale = useLocale();

  return (
    <section id="contact" className="relative py-24 px-6 text-center overflow-hidden" style={{ background: '#0F3D2A' }}>

      <div className="absolute inset-0" style={{
        background: 'linear-gradient(135deg, #2E8B57 0%, #0A2318 100%)'
      }} />
      <div className="absolute inset-0 opacity-[0.035]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)',
        backgroundSize: '48px 48px'
      }} />
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(240,180,41,0.10) 0%, transparent 70%)'
      }} />
      {/* Vignette edges for depth */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse 100% 100% at 50% 50%, transparent 35%, rgba(0,0,0,0.22) 100%)',
        pointerEvents: 'none',
      }} />

      <RevealSection className="relative z-10 max-w-[700px] mx-auto" style={{ direction: locale === 'ar' ? 'rtl' : 'ltr' }}>
        <h2
          className="font-arabic font-bold text-white mb-4"
          style={{ fontSize: 'clamp(2rem, 5vw, 3.25rem)' }}
        >
          {t('heading')}
        </h2>
        <p style={{ fontFamily: locale === 'ar' ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif', color: 'rgba(255,255,255,0.60)', fontSize: '18px', marginBottom: '40px', lineHeight: 1.6 }}>{t('sub')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'center' }}>
          <Link
            href={`/${locale}/demo`}
            className="font-arabic font-bold text-brand-950 bg-gold-400 transition-all hover:bg-gold-500 hover:-translate-y-0.5 shadow-[0_8px_32px_rgba(240,180,41,0.4)] cta-primary-btn"
            style={{ display: 'inline-flex', width: 'auto', borderRadius: '999px', padding: '.9rem 2.25rem', whiteSpace: 'nowrap', textDecoration: 'none' }}
          >
            {t('primary')}
          </Link>
          <a
            href="https://wa.me/212619522487"
            target="_blank"
            rel="noopener noreferrer"
            className="font-arabic font-medium text-white border border-white/30 cta-wa-btn"
            style={{ display: 'inline-flex', width: 'auto', borderRadius: '999px', padding: '.9rem 2.25rem', whiteSpace: 'nowrap' }}
          >
            {t('secondary')}
          </a>
        </div>
        {/* Live availability indicator below CTA buttons */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center' }}>
          <AvailabilityIndicator />
        </div>
      </RevealSection>
    </section>
  );
}
