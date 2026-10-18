'use client';

import { useTranslations, useLocale } from 'next-intl';

export default function Testimonial() {
  const t = useTranslations('testimonial');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  const quote = t('quote');
  const parts = quote.split('MAGHAREBIT POS');

  const fontBody = isRTL
    ? 'Noto Naskh Arabic, Cairo, serif'
    : 'Inter, sans-serif';

  return (
    <section
      className="bg-brand-950 py-20 px-6 overflow-hidden"
      style={{ position: 'relative' }}
    >
      {/* Ambient glow behind the card */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '300px',
          background: 'radial-gradient(ellipse at center, rgba(240,180,41,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <div
        data-aos="fade-up"
        className="max-w-[720px] mx-auto"
        style={{ direction: isRTL ? 'rtl' : 'ltr', position: 'relative', zIndex: 1 }}
      >
        {/* Glassmorphism card */}
        <div
          style={{
            background: 'rgba(255,255,255,0.035)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: '24px',
            padding: 'clamp(32px, 5vw, 56px)',
            textAlign: 'center',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.06)',
          }}
        >
          {/* Proper typographic double-quote mark */}
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'center' }}>
            <svg
              width="48"
              height="36"
              viewBox="0 0 48 36"
              fill="none"
              aria-hidden="true"
              style={{ opacity: 0.35 }}
            >
              {/* Left double-quote " */}
              <path d="M0 20 C0 10 5 3 14 0 L16 4 C10 6 8 10 9 14 L14 14 L14 36 L0 36 Z" fill="#F0B429"/>
              <path d="M18 20 C18 10 23 3 32 0 L34 4 C28 6 26 10 27 14 L32 14 L32 36 L18 36 Z" fill="#F0B429"/>
            </svg>
          </div>

          {/* Star rating */}
          <div style={{ color: '#F0B429', fontSize: '18px', letterSpacing: '4px', marginBottom: '24px' }}>
            ★★★★★
          </div>

          {/* Quote text */}
          <p
            className="font-arabic font-medium"
            style={{
              fontSize: 'clamp(1.1rem, 2.8vw, 1.35rem)',
              lineHeight: 1.75,
              color: 'rgba(255,255,255,0.90)',
              maxWidth: '620px',
              margin: '0 auto 36px',
              fontStyle: 'italic',
            }}
          >
            {parts[0]}
            <strong style={{ color: '#F0B429', fontStyle: 'normal', fontWeight: 700 }}>
              MAGHAREBIT POS
            </strong>
            {parts[1]}
          </p>

          {/* Divider */}
          <div
            aria-hidden="true"
            style={{
              width: '48px',
              height: '2px',
              background: 'linear-gradient(90deg, transparent, rgba(240,180,41,0.5), transparent)',
              margin: '0 auto 28px',
            }}
          />

          {/* Avatar + attribution row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px' }}>

            {/* Avatar circle with initials */}
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #0F3D2A, #1a5c3a)',
                border: '2px solid rgba(240,180,41,0.45)',
                boxShadow: '0 0 0 4px rgba(240,180,41,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                fontWeight: 700,
                color: '#F0B429',
                flexShrink: 0,
                fontFamily: 'Plus Jakarta Sans, sans-serif',
              }}
            >
              {t('initials')}
            </div>

            {/* Attribution text */}
            <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#FFFFFF',
                  fontFamily: fontBody,
                }}
              >
                {t('name')}
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.55)',
                  fontFamily: fontBody,
                  marginTop: '3px',
                }}
              >
                {t('role')}
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
