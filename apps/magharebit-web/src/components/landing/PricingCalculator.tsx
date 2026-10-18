'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';

export default function PricingCalculator() {
  const t = useTranslations('calculator');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontFamily = isRTL
    ? 'Noto Naskh Arabic, Cairo, serif'
    : 'Plus Jakarta Sans, Inter, sans-serif';

  const [dailyRevenue, setDailyRevenue] = useState(5000);

  // Computation logic:
  // Hours saved: roughly 2h/day saved on manual tasks → 60 h/month
  // scaled proportionally with revenue (bigger store = more time saved)
  const hoursSaved = Math.round((dailyRevenue / 5000) * 60);
  // Invoices faster: 70% faster on avg
  const invoicesFaster = 70;
  // MAD saved: ~3% of monthly revenue in reduced waste/errors
  const madSaved = Math.round(dailyRevenue * 30 * 0.03);
  // Errors reduced: fixed 90%
  const errorsReduced = 90;

  const formatMAD = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

  const cards = [
    {
      value: `${hoursSaved}h`,
      label: t('hours_label'),
      icon: '⏱',
      color: '#3B82F6',
      bg: 'rgba(59,130,246,0.08)',
      border: 'rgba(59,130,246,0.20)',
    },
    {
      value: `${invoicesFaster}%`,
      label: t('invoices_label'),
      icon: '⚡',
      color: '#F0B429',
      bg: 'rgba(240,180,41,0.08)',
      border: 'rgba(240,180,41,0.20)',
    },
    {
      value: `${formatMAD(madSaved)} MAD`,
      label: t('savings_label'),
      icon: '💰',
      color: '#22C55E',
      bg: 'rgba(34,197,94,0.08)',
      border: 'rgba(34,197,94,0.20)',
    },
    {
      value: `${errorsReduced}%`,
      label: t('errors_label'),
      icon: '✅',
      color: '#A855F7',
      bg: 'rgba(168,85,247,0.08)',
      border: 'rgba(168,85,247,0.20)',
    },
  ];

  return (
    <section
      style={{
        background: 'rgba(255,255,255,0.02)',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '72px 24px',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2
            style={{
              color: '#FFFFFF',
              fontSize: 'clamp(1.6rem, 3.5vw, 2.2rem)',
              fontWeight: 800,
              margin: '0 0 12px',
              fontFamily,
              lineHeight: 1.25,
            }}
          >
            {t('title')}
          </h2>
          <p
            style={{
              color: 'rgba(255,255,255,0.55)',
              fontSize: '15px',
              fontFamily,
              margin: 0,
            }}
          >
            {t('sub')}
          </p>
        </div>

        {/* Slider */}
        <div style={{ marginBottom: '40px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                color: 'rgba(255,255,255,0.60)',
                fontSize: '14px',
                fontFamily,
              }}
            >
              500 MAD
            </span>
            <span
              style={{
                color: '#F0B429',
                fontSize: '22px',
                fontWeight: 800,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {dailyRevenue.toLocaleString()} MAD
            </span>
            <span
              style={{
                color: 'rgba(255,255,255,0.60)',
                fontSize: '14px',
                fontFamily,
              }}
            >
              20 000 MAD
            </span>
          </div>
          <input
            type="range"
            min={500}
            max={20000}
            step={500}
            value={dailyRevenue}
            onChange={(e) => setDailyRevenue(Number(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#F0B429',
              height: '6px',
              cursor: 'pointer',
              appearance: 'auto',
            }}
          />
        </div>

        {/* Result cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px',
            marginBottom: '36px',
          }}
        >
          {cards.map((card, i) => (
            <div
              key={i}
              style={{
                background: card.bg,
                border: `1px solid ${card.border}`,
                borderRadius: '16px',
                padding: '24px 20px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '28px', marginBottom: '8px', lineHeight: 1 }}>
                {card.icon}
              </div>
              <div
                style={{
                  color: card.color,
                  fontSize: '28px',
                  fontWeight: 800,
                  fontFamily: 'Inter, sans-serif',
                  lineHeight: 1.1,
                  marginBottom: '6px',
                }}
              >
                {card.value}
              </div>
              <div
                style={{
                  color: 'rgba(255,255,255,0.60)',
                  fontSize: '13px',
                  fontFamily,
                  lineHeight: 1.4,
                }}
              >
                {card.label}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center' }}>
          <Link
            href={`/${locale}/demo`}
            style={{
              display: 'inline-block',
              background: '#F0B429',
              color: '#0A2318',
              fontWeight: 700,
              fontSize: '15px',
              padding: '14px 32px',
              borderRadius: '12px',
              textDecoration: 'none',
              fontFamily,
              marginBottom: '16px',
            }}
          >
            {t('cta')}
          </Link>
          <p
            style={{
              color: 'rgba(255,255,255,0.30)',
              fontSize: '12px',
              fontFamily,
              margin: 0,
            }}
          >
            {t('disclaimer')}
          </p>
        </div>
      </div>
    </section>
  );
}
