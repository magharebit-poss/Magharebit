'use client';

import { useTranslations, useLocale } from 'next-intl';

export default function WasteTracker() {
  const t  = useTranslations('waste');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const categories = [
    { color: '#F97316', label: t('cat1'), example: t('cat1_ex') },
    { color: '#EF4444', label: t('cat2'), example: t('cat2_ex') },
    { color: '#EAB308', label: t('cat3'), example: t('cat3_ex') },
    { color: '#6B7280', label: t('cat4'), example: t('cat4_ex') },
    { color: '#22C55E', label: t('cat5'), example: t('cat5_ex') },
  ];

  // Log entries — decorative mock, locale-aware names
  const logRows = isRTL
    ? [
        { time: '09:15', product: 'كرواصان',      cat: t('cat1'), qty: '-12 وحدة',  amount: '-96 DH',  pin: 'يوسف' },
        { time: '11:30', product: 'عصير البرتقال', cat: t('cat5'), qty: '-0.8 ل',    amount: '-24 DH',  pin: 'فاطمة' },
        { time: '14:00', product: 'فراولة',        cat: t('cat2'), qty: '-1.5 كغ',   amount: '-63 DH',  pin: 'يوسف' },
      ]
    : [
        { time: '09:15', product: 'Croissant',      cat: t('cat1'), qty: '-12 unités', amount: '-96 DH',  pin: 'Youssef' },
        { time: '11:30', product: "Jus d'orange",   cat: t('cat5'), qty: '-0.8L',      amount: '-24 DH',  pin: 'Fatima' },
        { time: '14:00', product: 'Fraise',         cat: t('cat2'), qty: '-1.5 kg',    amount: '-63 DH',  pin: 'Youssef' },
      ];

  return (
    <section
      style={{
        padding: '80px 24px',
        background: '#081C13',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
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
              color: '#EF4444',
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.20)',
              borderRadius: '999px',
              padding: '4px 14px',
              marginBottom: '16px',
            }}
          >
            🗑️ {isRTL ? 'تتبع الهدر' : 'Suivi des pertes'}
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
            {t('title')}
          </h2>
          <p
            style={{
              fontFamily: fontBody,
              fontSize: '15px',
              color: 'rgba(255,255,255,0.52)',
              maxWidth: '560px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            {t('sub')}
          </p>
        </div>

        {/* 2-column layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '24px',
          }}
          className="md:grid-cols-2"
        >
          {/* Left — 5 waste reason categories */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {categories.map((cat, i) => (
              <div
                key={i}
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '12px',
                  padding: '14px 20px',
                  borderLeft: isRTL ? 'none' : `3px solid ${cat.color}`,
                  borderRight: isRTL ? `3px solid ${cat.color}` : 'none',
                  border: `1px solid rgba(255,255,255,0.06)`,
                  borderInlineStart: `3px solid ${cat.color}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <span style={{ fontFamily: fontBody, fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                  {cat.label}
                </span>
                <span style={{ fontFamily: fontBody, fontSize: '12px', color: 'rgba(255,255,255,0.50)' }}>
                  {cat.example}
                </span>
              </div>
            ))}
          </div>

          {/* Right — Live waste log mockup */}
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '16px',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Log header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                fontFamily: fontBody,
                fontSize: '13px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.70)',
              }}
            >
              {t('log_title')}
            </div>

            {/* Log rows */}
            <div style={{ flex: 1 }}>
              {logRows.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: isRTL ? '0.6fr 1fr 0.8fr 0.6fr 0.5fr' : '0.5fr 1fr 0.8fr 0.6fr 0.6fr',
                    padding: '12px 20px',
                    borderBottom: i < logRows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.40)' }}>{row.time}</span>
                  <span style={{ fontFamily: fontBody, fontSize: '12px', color: '#FFFFFF', fontWeight: 600 }}>{row.product}</span>
                  <span style={{ fontFamily: fontBody, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>{row.cat}</span>
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', color: '#EF4444', fontWeight: 700 }}>{row.qty}</span>
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', color: '#EF4444', fontWeight: 700, textAlign: 'end' }}>{row.amount}</span>
                </div>
              ))}
            </div>

            {/* Summary footer */}
            <div
              style={{
                background: 'rgba(240,180,41,0.10)',
                borderTop: '1px solid rgba(240,180,41,0.18)',
                padding: '14px 20px',
                direction: isRTL ? 'rtl' : 'ltr',
              }}
            >
              <div
                style={{
                  fontFamily: fontBody,
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#F0B429',
                  marginBottom: '3px',
                }}
              >
                {t('total_today')}
              </div>
              <div
                style={{
                  fontFamily: fontBody,
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.55)',
                }}
              >
                {t('total_month')}
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
