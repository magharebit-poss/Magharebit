'use client';

import { useLocale, useTranslations } from 'next-intl';

export default function TrustTicker() {
  const t = useTranslations('ticker');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const items = t.raw('items') as string[];
  // Duplicate so the loop is seamless
  const doubled = [...items, ...items];

  return (
    <section
      className="trust-ticker"
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '16px 0',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', overflow: 'hidden' }}>
        <div
          className="ticker-track"
          style={{
            display: 'flex',
            gap: '48px',
            animation: isRTL
              ? 'ticker-rtl 30s linear infinite'
              : 'ticker-ltr 30s linear infinite',
            whiteSpace: 'nowrap',
            willChange: 'transform',
          }}
        >
          {doubled.map((item, i) => (
            <span
              key={i}
              style={{
                fontFamily: isRTL
                  ? 'Noto Naskh Arabic, Cairo, serif'
                  : 'Inter, sans-serif',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.70)',
                flexShrink: 0,
                userSelect: 'none',
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
