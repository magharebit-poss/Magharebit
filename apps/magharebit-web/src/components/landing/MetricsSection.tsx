'use client';

import { useState, useEffect, useRef } from 'react';
import { useLocale } from 'next-intl';

// ─── data ─────────────────────────────────────────────────────────────────────
interface Metric {
  target: number;
  decimals: number;
  suffix: string;
  label: Record<string, string>;
  icon: string;
}

const METRICS: Metric[] = [
  {
    target: 500,
    decimals: 0,
    suffix: '+',
    icon: '🏪',
    label: { ar: 'متجر نشط', fr: 'boutiques actives', en: 'active stores' },
  },
  {
    target: 98,
    decimals: 0,
    suffix: '%',
    icon: '⭐',
    label: { ar: 'رضا العملاء', fr: 'satisfaction client', en: 'customer satisfaction' },
  },
  {
    target: 2,
    decimals: 0,
    suffix: ' min',
    icon: '⚡',
    label: { ar: 'وقت الإعداد', fr: 'pour démarrer', en: 'setup time' },
  },
  {
    target: 4.9,
    decimals: 1,
    suffix: '/5',
    icon: '💬',
    label: { ar: 'تقييم التطبيق', fr: 'note application', en: 'app rating' },
  },
];

const COUNT_DURATION = 1800; // ms

// ─── single counter ───────────────────────────────────────────────────────────
function Counter({
  target,
  decimals,
  suffix,
  started,
}: {
  target: number;
  decimals: number;
  suffix: string;
  started: boolean;
}) {
  const [display, setDisplay] = useState('0');
  const rafRef = useRef<number>(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!started) return;

    startRef.current = null;

    function step(ts: number) {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / COUNT_DURATION, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = eased * target;
      setDisplay(current.toFixed(decimals));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(target.toFixed(decimals));
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [started, target, decimals]);

  return (
    <span style={{ fontFamily: 'Inter, monospace' }}>
      {display}
      {suffix}
    </span>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function MetricsSection() {
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Plus Jakarta Sans, Inter, sans-serif';
  const [started, setStarted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setStarted(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{
        background: 'linear-gradient(135deg, #071A10 0%, #0D2E1D 100%)',
        padding: '80px 24px',
        direction: isRTL ? 'rtl' : 'ltr',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* Section label */}
        <div style={{ textAlign: 'center', marginBottom: '12px' }}>
          <span
            style={{
              display: 'inline-block',
              background: 'rgba(240,180,41,0.15)',
              color: '#F0B429',
              fontWeight: 700,
              fontSize: '11px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              borderRadius: '999px',
              padding: '6px 16px',
              fontFamily: 'Inter, sans-serif',
              border: '1px solid rgba(240,180,41,0.3)',
            }}
          >
            {locale === 'ar' ? 'بالأرقام' : locale === 'fr' ? 'En chiffres' : 'By the numbers'}
          </span>
        </div>

        <h2
          style={{
            textAlign: 'center',
            color: '#FFFFFF',
            fontSize: 'clamp(1.6rem, 4vw, 2.4rem)',
            fontWeight: 800,
            margin: '0 0 56px',
            fontFamily: fontBody,
            lineHeight: 1.2,
          }}
        >
          {locale === 'ar'
            ? 'ثقة التجار المغاربة منذ 2023'
            : locale === 'fr'
            ? 'La confiance des commerçants marocains depuis 2023'
            : 'Trusted by Moroccan merchants since 2023'}
        </h2>

        {/* Counter grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '24px',
            marginBottom: '64px',
          }}
        >
          {METRICS.map((m, i) => (
            <div
              key={m.suffix}
              className="card-feature-hover"
              data-aos="fade-up"
              data-aos-delay={String(i * 80)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '32px 24px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '36px', lineHeight: 1, marginBottom: '16px' }}>
                {m.icon}
              </div>
              <div
                style={{
                  fontSize: 'clamp(2rem, 4vw, 2.8rem)',
                  fontWeight: 800,
                  color: '#F0B429',
                  lineHeight: 1,
                  marginBottom: '8px',
                }}
              >
                <Counter
                  target={m.target}
                  decimals={m.decimals}
                  suffix={m.suffix}
                  started={started}
                />
              </div>
              <p
                style={{
                  fontSize: '15px',
                  color: 'rgba(255,255,255,0.65)',
                  margin: 0,
                  fontFamily: fontBody,
                }}
              >
                {m.label[locale] ?? m.label['ar']}
              </p>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
