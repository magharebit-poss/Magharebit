'use client';

import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';

export default function SectorsPreview() {
  const t = useTranslations('sectorsPreview');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const pills = t.raw('pills') as string[];

  return (
    <section style={{ padding: '80px 24px', background: '#0A2318' }}>
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          textAlign: 'center',
          direction: isRTL ? 'rtl' : 'ltr',
        }}
      >
        {/* Title */}
        <h2
          data-aos="fade-up"
          style={{
            fontFamily: 'Noto Naskh Arabic, Cairo, serif',
            fontWeight: 800,
            fontSize: 'clamp(1.5rem, 3vw, 2rem)',
            color: '#FFFFFF',
            marginBottom: '12px',
          }}
        >
          {t('title')}
        </h2>

        {/* Subtitle */}
        <p
          data-aos="fade-up"
          data-aos-delay="60"
          style={{
            fontFamily: fontBody,
            fontSize: '16px',
            color: 'rgba(255,255,255,0.60)',
            marginBottom: '36px',
          }}
        >
          {t('sub')}
        </p>

        {/* Pills */}
        <div
          data-aos="fade-up"
          data-aos-delay="120"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: '12px',
            marginBottom: '32px',
          }}
        >
          {pills.map((pill, i) => (
            <Link
              key={i}
              href={`/${locale}/sectors`}
              className="sector-pill"
              style={{ fontFamily: fontBody }}
            >
              {pill}
            </Link>
          ))}
        </div>

        {/* See all link */}
        <div data-aos="fade-up" data-aos-delay="180">
          <Link
            href={`/${locale}/sectors`}
            style={{
              fontFamily: fontBody,
              fontSize: '14px',
              color: '#F0B429',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            {t('see_all')}
          </Link>
        </div>
      </div>
    </section>
  );
}
