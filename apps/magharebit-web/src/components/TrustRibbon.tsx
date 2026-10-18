'use client';

import { usePathname } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';

export default function TrustRibbon() {
  const t = useTranslations('trust_ribbon');
  const locale = useLocale();
  const pathname = usePathname();
  const isRTL = locale === 'ar';

  // Skip on portal routes (same logic as TrustBarConditional)
  if (pathname?.includes('/portal')) return null;

  const items = [t('i1'), t('i2'), t('i3'), t('i4')];

  return (
    <div
      style={{
        background: 'rgba(240,180,41,0.06)',
        borderTop: '1px solid rgba(240,180,41,0.15)',
        borderBottom: '1px solid rgba(240,180,41,0.15)',
        padding: '14px 24px',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      <div
        className="max-w-[1100px] mx-auto"
        style={{
          fontFamily: isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif',
          fontSize: '13px',
          color: 'rgba(255,255,255,0.70)',
          textAlign: 'center',
        }}
      >
        {/* Desktop: inline row */}
        <div className="hidden sm:flex" style={{ justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
          {items.map((item, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
              <span style={{ color: '#F0B429', fontWeight: 700, marginInlineEnd: '6px' }}>✓</span>
              <span>{item}</span>
              {i < items.length - 1 && (
                <span style={{ color: 'rgba(255,255,255,0.20)', padding: '0 16px' }}>|</span>
              )}
            </span>
          ))}
        </div>
        {/* Mobile: 2-col grid */}
        <div className="grid sm:hidden" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', textAlign: 'start' }}>
          {items.map((item, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '12px' }}>
              <span style={{ color: '#F0B429', fontWeight: 700, marginInlineEnd: '6px' }}>✓</span>
              <span>{item}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
