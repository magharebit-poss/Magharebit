'use client';

import { useTranslations, useLocale } from 'next-intl';

export default function LoyverseCounter() {
  const t = useTranslations('loyverse_counter');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL
    ? 'Noto Naskh Arabic, Cairo, serif'
    : 'Inter, sans-serif';

  const cols = [
    { icon: '🌍', title: t('col1_title'), body: t('col1_body') },
    { icon: '🇲🇦', title: t('col2_title'), body: t('col2_body') },
    { icon: '💬', title: t('col3_title'), body: t('col3_body') },
    { icon: '🧾', title: t('col4_title'), body: t('col4_body') },
  ];

  return (
    <section
      style={{
        padding: '72px 24px',
        background: 'linear-gradient(180deg, #0A2318 0%, #071a12 100%)',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <span
            style={{
              display: 'inline-block',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#F0B429',
              background: 'rgba(240,180,41,0.08)',
              border: '1px solid rgba(240,180,41,0.2)',
              borderRadius: '999px',
              padding: '4px 14px',
              marginBottom: '16px',
            }}
          >
            vs Loyverse · Caisse Windows
          </span>
          <h2
            style={{
              fontFamily: 'Noto Naskh Arabic, Cairo, serif',
              fontWeight: 800,
              fontSize: 'clamp(1.4rem, 3vw, 1.9rem)',
              color: '#FFFFFF',
              lineHeight: 1.25,
              marginBottom: '12px',
            }}
          >
            {t('heading')}
          </h2>
          <p
            style={{
              fontFamily: fontBody,
              fontSize: '15px',
              color: 'rgba(255,255,255,0.52)',
              maxWidth: '520px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            {t('sub')}
          </p>
        </div>

        {/* 4-column grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
          }}
        >
          {cols.map((col, i) => (
            <div
              key={i}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: '16px',
                padding: '28px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(240,180,41,0.3)';
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(240,180,41,0.04)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.07)';
                (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
              }}
            >
              {/* Icon */}
              <span
                style={{
                  fontSize: '28px',
                  lineHeight: 1,
                  display: 'block',
                }}
              >
                {col.icon}
              </span>

              {/* Check badge */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(34,197,94,0.1)',
                  border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: '999px',
                  padding: '3px 10px',
                  width: 'fit-content',
                }}
              >
                <span style={{ color: '#22C55E', fontSize: '11px', fontWeight: 700 }}>✓</span>
                <span
                  style={{
                    fontFamily: 'Plus Jakarta Sans, sans-serif',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: '#22C55E',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  MAGHAREBIT
                </span>
              </div>

              {/* Title */}
              <h3
                style={{
                  fontFamily: fontBody,
                  fontWeight: 700,
                  fontSize: '15px',
                  color: '#FFFFFF',
                  margin: 0,
                  lineHeight: 1.35,
                }}
              >
                {col.title}
              </h3>

              {/* Body */}
              <p
                style={{
                  fontFamily: fontBody,
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.55)',
                  margin: 0,
                  lineHeight: 1.6,
                }}
              >
                {col.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
