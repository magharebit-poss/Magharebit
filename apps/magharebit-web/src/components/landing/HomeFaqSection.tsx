'use client';

import { useTranslations, useLocale } from 'next-intl';
import FaqAccordion from './FaqAccordion';

export default function HomeFaqSection() {
  const t = useTranslations('pricing');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontFamily = isRTL
    ? 'Noto Naskh Arabic, Cairo, serif'
    : 'Plus Jakarta Sans, Inter, sans-serif';

  const items = [
    { q: t('faq_q1'), a: t('faq_a1') },
    { q: t('faq_q2'), a: t('faq_a2') },
    { q: t('faq_q3'), a: t('faq_a3') },
    { q: t('faq_q4'), a: t('faq_a4') },
    { q: t('faq_q5'), a: t('faq_a5') },
  ];

  return (
    <section
      style={{
        padding: '80px 24px',
        direction: isRTL ? 'rtl' : 'ltr',
        // Slightly darker panel than the page so the FAQ cards read as a
        // distinct, contained block instead of floating text.
        background: '#081C13',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ maxWidth: '760px', margin: '0 auto' }}>
        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <span
            style={{
              display: 'inline-block',
              background: 'rgba(240,180,41,0.15)',
              color: '#F0B429',
              fontWeight: 700,
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              borderRadius: '999px',
              padding: '6px 16px',
              marginBottom: '16px',
              fontFamily: 'Inter, sans-serif',
              border: '1px solid rgba(240,180,41,0.3)',
            }}
          >
            {t('faq_label')}
          </span>
          <h2
            style={{
              color: '#FFFFFF',
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              fontWeight: 800,
              margin: 0,
              fontFamily,
              lineHeight: 1.25,
            }}
          >
            {t('faq_title')}
          </h2>
        </div>

        <FaqAccordion items={items} isRTL={isRTL} />
      </div>
    </section>
  );
}
