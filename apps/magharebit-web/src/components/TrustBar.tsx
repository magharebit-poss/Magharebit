'use client';

import { useTranslations, useLocale } from 'next-intl';

export default function TrustBar() {
  const locale = useLocale();
  const t = useTranslations('trust');
  const isRTL = locale === 'ar';
  const fontFamily = isRTL
    ? 'Noto Naskh Arabic, Cairo, serif'
    : 'Plus Jakarta Sans, Inter, sans-serif';

  const items = [
    { icon: '📝', text: t('no_contract') },
    { icon: '📶', text: t('offline') },
    { icon: '🇲🇦', text: t('made_in_morocco') },
    { icon: '⚡', text: t('setup_time') },
    { icon: '💬', text: t('support') },
  ];

  return (
    <div
      style={{
        background: '#0F3D2A',
        borderTop: '1px solid rgba(240,180,41,0.15)',
        borderBottom: '1px solid rgba(240,180,41,0.15)',
        padding: '10px 24px',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0',
          flexWrap: 'wrap',
        }}
      >
        {items.map((item, i) => (
          <span
            key={i}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 20px',
              color: 'rgba(255,255,255,0.80)',
              fontSize: '13px',
              fontFamily,
              fontWeight: 500,
              // inline-end, so the separators sit between items in Arabic (RTL) too
              borderInlineEnd:
                i < items.length - 1
                  ? '1px solid rgba(255,255,255,0.15)'
                  : 'none',
            }}
          >
            <span style={{ fontSize: '15px' }}>{item.icon}</span>
            {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}
