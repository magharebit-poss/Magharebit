'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';

// ── Mock screen sub-components ────────────────────────────────────────────────

interface MockupProduct { name: string; price: string; emoji: string }
interface MockupBasketItem { name: string; qty: string; price: string }

function PosMockScreen({ fontBody, isRTL }: { fontBody: string; isRTL: boolean }) {
  // Reuse the same localized data as the hero mockup
  const tMock = useTranslations('hero.mockup');
  const tPos = useTranslations('tour_pos');
  const products = (tMock.raw('products') as MockupProduct[]).slice(0, 6);
  const basket = tMock.raw('basket_items') as MockupBasketItem[];
  const currency = tMock('currency');
  const basketTotal = basket.reduce((s, i) => s + parseFloat(i.price), 0).toFixed(2);

  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        gridTemplateColumns: '60% 40%',
        gap: '10px',
        direction: isRTL ? 'rtl' : 'ltr',
      }}
    >
      {/* Products grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        {products.map((p, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: '8px',
              padding: '10px 4px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              justifyContent: 'center',
            }}
          >
            <span style={{ fontSize: '22px' }}>{p.emoji}</span>
            <span style={{ fontFamily: fontBody, fontSize: '10px', color: 'rgba(255,255,255,0.85)', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{p.name}</span>
            <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '10px', color: '#F0B429', fontWeight: 700 }}>{p.price} {currency}</span>
          </div>
        ))}
      </div>
      {/* Mini basket */}
      <div
        style={{
          background: 'rgba(0,0,0,0.20)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <div style={{ fontFamily: fontBody, fontSize: '11px', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>
          {tPos('basket_title')}
        </div>
        {basket.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontBody, fontSize: '9px', color: 'rgba(255,255,255,0.65)' }}>
            <span>{item.qty}</span>
            <span style={{ textAlign: isRTL ? 'right' : 'left', flex: 1, marginInline: '6px' }}>{item.name}</span>
            <span style={{ fontWeight: 700, color: '#F0B429' }}>{item.price}</span>
          </div>
        ))}
        <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.10)', paddingTop: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: fontBody, fontSize: '10px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
            <span>{tPos('total_label')}</span>
            <span style={{ color: '#F0B429' }}>{basketTotal} {currency}</span>
          </div>
          <button
            style={{
              background: '#F0B429',
              border: 'none',
              borderRadius: '6px',
              padding: '6px',
              fontFamily: fontBody,
              fontWeight: 700,
              fontSize: '10px',
              color: '#0A2318',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {tPos('checkout_btn')} →
          </button>
          {/* WhatsApp day-end report notification badge */}
          <div
            style={{
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(37,211,102,0.10)',
              border: '1px solid rgba(37,211,102,0.25)',
              borderRadius: '6px',
              padding: '4px 6px',
            }}
          >
            <span style={{ fontSize: '10px' }}>📱</span>
            <span style={{ fontFamily: fontBody, fontSize: '9px', color: '#25D366', fontWeight: 600, lineHeight: 1.2 }}>
              {isRTL ? 'تقرير واتساب أُرسل — 21:47' : 'Rapport WhatsApp envoyé — 21:47'}
            </span>
            <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '9px', color: '#25D366', marginInlineStart: 'auto' }}>✓✓</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function InventoryMockScreen({ fontBody, isRTL }: { fontBody: string; isRTL: boolean }) {
  const t = useTranslations('tour_inventory');

  // Before/after panel data — two products showing real deduction
  const panels = [
    {
      label: t('before_title'),
      side: 'before',
      items: [
        { name: 'Croissant', qty: '47', unit: isRTL ? 'وحدة' : 'unités', dot: '🟢', status: isRTL ? 'متوفر' : 'En stock', change: null },
        { name: isRTL ? 'عصير البرتقال' : "Jus d'orange", qty: isRTL ? '12 ل' : '12 L', unit: '', dot: '🟡', status: isRTL ? 'منخفض' : 'Bas', change: null },
      ],
    },
    {
      label: t('after_title'),
      side: 'after',
      items: [
        { name: 'Croissant', qty: '44', unit: isRTL ? 'وحدة' : 'unités', dot: '🟢', status: isRTL ? 'متوفر' : 'En stock', change: '-3' },
        { name: isRTL ? 'عصير البرتقال' : "Jus d'orange", qty: isRTL ? '10.5 ل' : '10.5 L', unit: '', dot: '🔴', status: t('critical_label'), change: '-1.5L' },
      ],
    },
  ] as const;

  const infos = [t('info_1'), t('info_2'), t('info_3')];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Before / After panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '8px', alignItems: 'stretch' }}>
        {panels.map((panel, pi) => (
          <div
            key={pi}
            style={{
              background: panel.side === 'after' ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${panel.side === 'after' ? 'rgba(34,197,94,0.20)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '8px',
              padding: '10px',
              animation: panel.side === 'after' ? 'inv-flash 0.5s ease forwards' : 'none',
            }}
          >
            {/* Panel label */}
            <div style={{ fontFamily: fontBody, fontSize: '9px', fontWeight: 700, color: panel.side === 'after' ? '#22C55E' : 'rgba(255,255,255,0.45)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '8px' }}>
              {panel.label}
            </div>
            {/* Items */}
            {panel.items.map((item, ii) => (
              <div key={ii} style={{ marginBottom: ii < panel.items.length - 1 ? '8px' : 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontFamily: fontBody, fontSize: '10px', fontWeight: 600, color: '#fff' }}>{item.name}</span>
                  {item.change && (
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '9px', fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.12)', padding: '1px 5px', borderRadius: '4px' }}>
                      {item.change} ({t('sale_badge')})
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', fontWeight: 800, color: item.dot === '🔴' ? '#EF4444' : item.dot === '🟡' ? '#F0B429' : 'rgba(255,255,255,0.85)' }}>
                    {item.qty} {item.unit}
                  </span>
                  <span style={{ fontSize: '10px' }}>{item.dot}</span>
                  <span style={{ fontFamily: fontBody, fontSize: '9px', color: item.dot === '🔴' ? '#EF4444' : item.dot === '🟡' ? '#F0B429' : '#22C55E', fontWeight: 600 }}>
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
        {/* Arrow connector */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>
          <div style={{ fontSize: '16px', color: '#F0B429', animation: 'inv-pulse 1.5s ease-in-out infinite' }}>
            {isRTL ? '←' : '→'}
          </div>
        </div>
      </div>

      {/* Info strips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '4px' }}>
        {infos.map((info, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '6px',
              fontFamily: fontBody,
              fontSize: '10px',
              color: 'rgba(255,255,255,0.65)',
              lineHeight: 1.35,
            }}
          >
            <span style={{ color: '#F0B429', flexShrink: 0, fontWeight: 700, marginTop: '1px' }}>✓</span>
            {info}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes inv-flash {
          0%   { opacity: 0.4; }
          100% { opacity: 1; }
        }
        @keyframes inv-pulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50%       { transform: scale(1.3); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function AnalyticsMockScreen({ fontBody, isRTL }: { fontBody: string; isRTL: boolean }) {
  const t = useTranslations('tour_analytics');
  const days = t.raw('days') as string[];
  // Bar heights for 7 days; today (index 3) is the gold/highlighted bar
  const BARS = [42, 58, 70, 95, 78, 88, 60];
  const TODAY_IDX = 3;
  const maxVal = Math.max(...BARS);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '10px', direction: isRTL ? 'rtl' : 'ltr' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontFamily: fontBody, fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {t('header')}
          </div>
          <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '20px', fontWeight: 800, color: '#F0B429', letterSpacing: '-0.02em' }}>
            {t('total_value')}
          </div>
        </div>
        <span
          style={{
            background: 'rgba(34,197,94,0.15)',
            border: '1px solid rgba(34,197,94,0.30)',
            color: '#22C55E',
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: '11px',
            fontWeight: 700,
            padding: '3px 10px',
            borderRadius: '999px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          ↑ {t('growth_value')}
        </span>
      </div>

      {/* Bar chart */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'flex-end',
          gap: '6px',
          paddingBottom: '4px',
          minHeight: '80px',
        }}
      >
        {BARS.map((val, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <div
              style={{
                width: '100%',
                height: `${(val / maxVal) * 80}px`,
                background: i === TODAY_IDX ? '#F0B429' : 'rgba(240,180,41,0.35)',
                borderRadius: '4px 4px 0 0',
                transition: 'height 0.3s ease',
              }}
            />
            <span style={{ fontFamily: fontBody, fontSize: '9px', color: i === TODAY_IDX ? '#F0B429' : 'rgba(255,255,255,0.40)', fontWeight: i === TODAY_IDX ? 700 : 400 }}>
              {days[i]}
            </span>
          </div>
        ))}
      </div>

      {/* Bottom info row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
        <div
          style={{
            background: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.20)',
            borderRadius: '8px',
            padding: '8px 10px',
          }}
        >
          <div style={{ fontFamily: fontBody, fontSize: '9px', color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
            🏆 {t('top_product_label')}
          </div>
          <div style={{ fontFamily: fontBody, fontSize: '11px', fontWeight: 700, color: '#fff' }}>
            {t('top_product_value')}
          </div>
        </div>
        <div
          style={{
            background: 'rgba(240,180,41,0.08)',
            border: '1px solid rgba(240,180,41,0.20)',
            borderRadius: '8px',
            padding: '8px 10px',
          }}
        >
          <div style={{ fontFamily: fontBody, fontSize: '9px', color: 'rgba(255,255,255,0.50)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
            ⏰ {t('peak_label')}
          </div>
          <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: '#F0B429' }}>
            {t('peak_value')}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ProductTourTabs() {
  const t = useTranslations('features');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    {
      label: t('tour_tab1'),
      points: [
        { title: t('tour_t1_p1_title'), desc: t('tour_t1_p1_desc') },
        { title: t('tour_t1_p2_title'), desc: t('tour_t1_p2_desc') },
        { title: t('tour_t1_p3_title'), desc: t('tour_t1_p3_desc') },
        { title: t('tour_t1_p4_title'), desc: t('tour_t1_p4_desc') },
        { title: t('tour_t1_p5_title'), desc: t('tour_t1_p5_desc') },
      ],
      screen: <PosMockScreen fontBody={fontBody} isRTL={isRTL} />,
    },
    {
      label: t('tour_tab2'),
      points: [
        { title: t('tour_t2_p1_title'), desc: t('tour_t2_p1_desc') },
        { title: t('tour_t2_p2_title'), desc: t('tour_t2_p2_desc') },
        { title: t('tour_t2_p3_title'), desc: t('tour_t2_p3_desc') },
        { title: t('tour_t2_p4_title'), desc: t('tour_t2_p4_desc') },
        { title: t('tour_t2_p5_title'), desc: t('tour_t2_p5_desc') },
      ],
      screen: <InventoryMockScreen fontBody={fontBody} isRTL={isRTL} />,
    },
    {
      label: t('tour_tab3'),
      points: [
        { title: t('tour_t3_p1_title'), desc: t('tour_t3_p1_desc') },
        { title: t('tour_t3_p2_title'), desc: t('tour_t3_p2_desc') },
        { title: t('tour_t3_p3_title'), desc: t('tour_t3_p3_desc') },
        { title: t('tour_t3_p4_title'), desc: t('tour_t3_p4_desc') },
        { title: t('tour_t3_p5_title'), desc: t('tour_t3_p5_desc') },
      ],
      screen: <AnalyticsMockScreen fontBody={fontBody} isRTL={isRTL} />,
    },
  ];

  return (
    <section style={{ padding: '0 24px 80px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: '40px', direction: isRTL ? 'rtl' : 'ltr' }}>
          <span className="badge-pill font-display">{t('tour_label')}</span>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: 'flex',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            marginBottom: '32px',
            direction: isRTL ? 'rtl' : 'ltr',
            overflowX: 'auto',
          }}
        >
          {tabs.map((tab, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              style={{
                padding: '12px 24px',
                cursor: 'pointer',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === i ? '2px solid #F0B429' : '2px solid transparent',
                color: activeTab === i ? '#F0B429' : 'rgba(255,255,255,0.50)',
                fontFamily: fontBody,
                fontWeight: 500,
                fontSize: '15px',
                transition: 'color 0.2s ease, border-color 0.2s ease',
                whiteSpace: 'nowrap',
                marginBottom: '-1px',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div
          key={activeTab}
          style={{
            display: 'grid',
            gridTemplateColumns: '3fr 2fr',
            gap: '40px',
            alignItems: 'stretch',
            direction: isRTL ? 'rtl' : 'ltr',
            animation: 'tour-fade 0.2s ease forwards',
          }}
        >
          {/* Left — bullet points */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {tabs[activeTab].points.map((point, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'rgba(240,180,41,0.15)',
                    border: '1px solid rgba(240,180,41,0.30)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#F0B429',
                    fontSize: '11px',
                    fontWeight: 700,
                    marginTop: '2px',
                  }}
                >
                  ✓
                </span>
                <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                  <span style={{ fontFamily: fontBody, fontWeight: 700, fontSize: '15px', color: '#FFFFFF', display: 'block', marginBottom: '2px' }}>
                    {point.title}
                  </span>
                  <span style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                    {point.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Right — mock screen */}
          <div
            style={{
              background: '#0F3D2A',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '20px',
              minHeight: '320px',
            }}
          >
            {tabs[activeTab].screen}
          </div>
        </div>

      </div>

      <style>{`
        @keyframes tour-fade {
          from { opacity: 0; transform: translateX(8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </section>
  );
}
