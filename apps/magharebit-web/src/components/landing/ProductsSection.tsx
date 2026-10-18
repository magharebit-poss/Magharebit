'use client';

import { useTranslations, useLocale } from 'next-intl';
import RevealSection from '@/components/RevealSection';

const CARD_ICONS = ['🌿', '📦', '📊'] as const;
const CARD_DELAY = ['0', '100', '200'] as const;
const CARD_ANCHORS = ['pos', 'inventory', 'analytics'] as const;

export default function ProductsSection() {
  const t = useTranslations('products');
  const locale = useLocale();

  const cards = [0, 1, 2].map(i => ({
    title:    t(`cards.${i}.title`),
    sub:      t(`cards.${i}.sub`),
    badge:    t(`cards.${i}.badge`),
    cta:      t(`cards.${i}.cta`),
    features: [0, 1, 2, 3, 4, 5].map(j => t(`cards.${i}.features.${j}`)),
    icon:     CARD_ICONS[i],
    delay:    CARD_DELAY[i],
  }));

  return (
    <section id="products" className="bg-brand-950 py-24 px-6">
      <RevealSection className="max-w-[1100px] mx-auto" style={{ direction: locale === 'ar' ? 'rtl' : 'ltr' }}>

        <div className="text-center mb-16">
          <span className="inline-block border border-gold-400/50 text-gold-400 bg-transparent text-sm font-semibold px-4 py-1.5 rounded-full mb-4 font-display">
            {t('label')}
          </span>
          <h2
            data-aos="fade-up"
            className="font-arabic font-bold text-white mb-3"
            style={{ fontSize: 'clamp(1.5rem, 4vw, 2.25rem)' }}
          >
            {t('heading')}
          </h2>
          <p
            data-aos="fade-up"
            data-aos-delay="100"
            className="font-arabic text-white/65 text-lg max-w-[560px] mx-auto leading-[1.9]"
          >
            {t('sub')}
          </p>
        </div>

        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{ gap: '1.5rem', maxWidth: '1100px', margin: '0 auto', alignItems: 'stretch' }}
        >
          {cards.map((card, index) => (
            <div
              key={index}
              data-aos="fade-up"
              data-aos-delay={card.delay}
              className="card-hover"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '24px',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                direction: locale === 'ar' ? 'rtl' : 'ltr',
              }}
            >
              {/* Icon + badge row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '15px',
                    background: 'rgba(240,180,41,0.1)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: '26px',
                    flexShrink: 0,
                  }}
                >
                  {card.icon}
                </div>
                <span
                  className="font-arabic"
                  style={{
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    background: 'rgba(94,196,133,0.15)',
                    color: '#5EC485',
                    border: '1px solid rgba(94,196,133,0.3)',
                  }}
                >
                  {card.badge}
                </span>
              </div>

              <h3
                className="font-display"
                style={{ fontWeight: 800, fontSize: '1.3rem', color: '#fff', marginTop: '1rem' }}
              >
                {card.title}
              </h3>
              <p
                className="font-arabic"
                style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)', margin: '0.4rem 0 1.1rem' }}
              >
                {card.sub}
              </p>

              <ul style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem', listStyle: 'none', padding: 0, margin: 0, flex: 1 }}>
                {card.features.map((f) => (
                  <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
                    <span style={{ color: '#F0B429', fontWeight: 700, flexShrink: 0 }}>✓</span>
                    <span className="font-arabic" style={{ fontSize: '0.93rem', color: 'rgba(255,255,255,0.75)' }}>{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={`/${locale}/features#${CARD_ANCHORS[index]}`}
                className="font-arabic"
                style={{ marginTop: 'auto', paddingTop: '1.4rem', color: '#F0B429', fontWeight: 700, fontSize: '0.93rem' }}
              >
                {card.cta}
              </a>
            </div>
          ))}
        </div>
      </RevealSection>
    </section>
  );
}
