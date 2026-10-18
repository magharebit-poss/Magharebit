'use client';

import { useTranslations, useLocale } from 'next-intl';

export default function WhyNotCompetitors() {
  const t = useTranslations('why_not');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const redItems = t.raw('red_items') as string[];
  const greenItems = t.raw('green_items') as string[];

  return (
    <section
      style={{
        padding: '40px 24px 60px',
        background: '#0A2318',
      }}
    >
      <div
        style={{
          maxWidth: '900px',
          margin: '0 auto',
          direction: isRTL ? 'rtl' : 'ltr',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
        }}
      >
        {/* RED — Why competitors fail */}
        <div
          data-aos="fade-up"
          style={{
            background: 'rgba(239,68,68,0.04)',
            border: '1px solid rgba(239,68,68,0.12)',
            borderRadius: '16px',
            padding: '32px',
          }}
        >
          <h3
            style={{
              fontFamily: fontBody,
              fontSize: '20px',
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: '20px',
              lineHeight: 1.3,
            }}
          >
            {t('red_title')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {redItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    color: '#EF4444',
                    fontSize: '16px',
                    fontWeight: 700,
                    flexShrink: 0,
                    lineHeight: 1.4,
                  }}
                >
                  ❌
                </span>
                <span
                  style={{
                    fontFamily: fontBody,
                    fontSize: '15px',
                    color: 'rgba(255,255,255,0.80)',
                    lineHeight: 1.6,
                  }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* GREEN — MAGHAREBIT response */}
        <div
          data-aos="fade-up"
          data-aos-delay="100"
          style={{
            background: 'rgba(34,197,94,0.04)',
            border: '1px solid rgba(34,197,94,0.12)',
            borderRadius: '16px',
            padding: '32px',
          }}
        >
          <h3
            style={{
              fontFamily: fontBody,
              fontSize: '20px',
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: '20px',
              lineHeight: 1.3,
            }}
          >
            {t('green_title')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {greenItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    color: '#22C55E',
                    fontSize: '16px',
                    fontWeight: 700,
                    flexShrink: 0,
                    lineHeight: 1.4,
                  }}
                >
                  ✅
                </span>
                <span
                  style={{
                    fontFamily: fontBody,
                    fontSize: '15px',
                    color: 'rgba(255,255,255,0.88)',
                    lineHeight: 1.6,
                    fontWeight: 500,
                  }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
