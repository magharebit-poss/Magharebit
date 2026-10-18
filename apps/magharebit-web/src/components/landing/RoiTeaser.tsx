'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { formatCurrency } from '@/lib/formatters';

export default function RoiTeaser() {
  const t = useTranslations('roi_teaser');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const [dailySales, setDailySales] = useState(5000);
  const monthlySavings = Math.round(dailySales * 0.04 * 30);

  const lossBullets = [t('loss1'), t('loss2'), t('loss3')];
  const resultBullets = [t('result1'), t('result2'), t('result3')];

  return (
    <section
      style={{
        padding: '80px 24px',
        // Darker dedicated panel — replaces the near-invisible 0.03 red tint
        // that made the section look washed out.
        background: '#081C13',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div
        style={{
          maxWidth: '1100px',
          margin: '0 auto',
          direction: isRTL ? 'rtl' : 'ltr',
          display: 'grid',
          gridTemplateColumns: '1fr',
          gap: '24px',
          alignItems: 'stretch',
        }}
        className="md:grid-cols-2"
      >
        {/* Left column — loss-framing, now in a card */}
        <div
          style={{
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.18)',
            borderRadius: '20px',
            padding: '32px',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.30)',
              color: '#F87171',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '12px',
              fontWeight: 700,
              borderRadius: '999px',
              padding: '4px 14px',
              marginBottom: '16px',
              letterSpacing: '0.05em',
            }}
          >
            {t('badge')}
          </span>
          <h2 className="font-arabic font-bold text-white" style={{ fontSize: 'clamp(1.5rem, 3vw, 1.9rem)', marginBottom: '12px', lineHeight: 1.25 }}>
            {t('title')}
          </h2>
          <p style={{ fontFamily: fontBody, fontSize: '15px', color: 'rgba(255,255,255,0.78)', lineHeight: 1.7, marginBottom: '20px' }}>
            {t('sub')}
          </p>

          {/* Red loss bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
            {lossBullets.map((bullet, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#EF4444', fontSize: '14px', flexShrink: 0, marginTop: '2px' }}>🔴</span>
                <span style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.80)', lineHeight: 1.55 }}>
                  {bullet}
                </span>
              </div>
            ))}
          </div>

          {/* Divider between losses and results */}
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.10)', margin: '4px 0 18px' }} />

          {/* Result intro */}
          <div
            style={{
              fontFamily: fontBody,
              fontSize: '13px',
              fontWeight: 700,
              color: '#22C55E',
              marginBottom: '12px',
              letterSpacing: '0.02em',
            }}
          >
            {t('result_intro')}
          </div>

          {/* Green result bullets */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {resultBullets.map((bullet, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ color: '#22C55E', fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>✅</span>
                <span style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.88)', lineHeight: 1.55, fontWeight: 500 }}>
                  {bullet}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Right card — ROI calculator */}
        <div
          style={{
            background: 'rgba(255,255,255,0.055)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '20px',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <label
            htmlFor="roi-slider"
            style={{ display: 'block', fontFamily: fontBody, fontSize: '14px', fontWeight: 600, color: 'rgba(255,255,255,0.80)', marginBottom: '12px' }}
          >
            {t('slider_label')}
          </label>
          <input
            id="roi-slider"
            type="range"
            min={1000}
            max={15000}
            step={500}
            value={dailySales}
            onChange={(e) => setDailySales(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#F0B429' }}
          />
          <div style={{ textAlign: 'center', marginTop: '8px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '20px', fontWeight: 800, color: '#F0B429' }}>
            {formatCurrency(dailySales, locale)}
          </div>
          <div style={{ height: '1px', background: 'rgba(255,255,255,0.10)', margin: '20px 0' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginBottom: '8px' }}>
              {t('result_label')}
            </div>
            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '42px', fontWeight: 800, color: '#F0B429', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {formatCurrency(monthlySavings, locale)}
            </div>
            <div style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.45)', marginTop: '4px' }}>
              / {t('per_month')}
            </div>
          </div>
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <a
              href={`/${locale}/pricing#calculator`}
              style={{
                fontFamily: fontBody,
                fontSize: '13px',
                color: '#F0B429',
                textDecoration: 'underline',
                textUnderlineOffset: 4,
                fontWeight: 600,
              }}
            >
              {t('detail_link')} →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
