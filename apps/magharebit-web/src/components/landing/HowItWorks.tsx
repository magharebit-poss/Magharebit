'use client';

import { useTranslations, useLocale } from 'next-intl';

const CONNECTOR_H = 'repeating-linear-gradient(90deg, rgba(240,180,41,0.4) 0px, rgba(240,180,41,0.4) 6px, transparent 6px, transparent 14px)';
const CONNECTOR_V = 'repeating-linear-gradient(180deg, rgba(240,180,41,0.4) 0px, rgba(240,180,41,0.4) 6px, transparent 6px, transparent 14px)';

function HConnector() {
  return (
    <div
      style={{
        width: '80px',
        height: '2px',
        background: CONNECTOR_H,
        alignSelf: 'start',
        marginTop: '27px',
      }}
    />
  );
}

function VConnector() {
  return (
    <div
      style={{
        width: '2px',
        height: '40px',
        background: CONNECTOR_V,
        margin: '8px auto',
      }}
    />
  );
}

function StepCard({
  number,
  title,
  body,
  delay,
}: {
  number: string;
  title: string;
  body: string;
  delay: string;
}) {
  return (
    <div
      data-aos="zoom-in"
      data-aos-delay={delay}
      className="flex flex-col items-center text-center px-4"
    >
      {/* Number circle */}
      <div
        style={{
          width: '56px',
          height: '56px',
          minWidth: '56px',
          borderRadius: '50%',
          background: 'rgba(240,180,41,0.12)',
          border: '2px solid #F0B429',
          color: '#F0B429',
          fontSize: '22px',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
          fontFamily: 'Plus Jakarta Sans, sans-serif',
        }}
      >
        {number}
      </div>

      {/* Title */}
      <h3
        className="font-arabic"
        style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', marginBottom: '10px' }}
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className="font-arabic"
        style={{
          fontSize: '14px',
          color: 'rgba(255,255,255,0.60)',
          lineHeight: 1.6,
          maxWidth: '220px',
          margin: '0 auto',
        }}
      >
        {body}
      </p>
    </div>
  );
}

export default function HowItWorks() {
  const t = useTranslations('howItWorks');
  const locale = useLocale();
  const isRTL = locale === 'ar';

  return (
    <section
      className="bg-brand-950"
      style={{
        padding: '80px 24px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Faint radial glow to visually break from adjacent flat sections */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '700px',
          height: '300px',
          background: 'radial-gradient(ellipse 80% 100% at 50% 0%, rgba(46,139,87,0.10) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div className="max-w-[900px] mx-auto">

        {/* Section header */}
        <div className="text-center mb-4" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
          <span className="inline-block border border-gold-400/50 text-gold-400 bg-transparent text-sm font-semibold px-4 py-1.5 rounded-full mb-4 font-display">
            {t('label')}
          </span>
          <h2
            data-aos="fade-up"
            className="font-arabic font-extrabold text-white"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.25rem)', marginBottom: '16px' }}
          >
            {t('heading')}
          </h2>
          <p
            data-aos="fade-up"
            data-aos-delay="80"
            className="font-arabic"
            style={{ fontSize: '16px', color: 'rgba(255,255,255,0.60)' }}
          >
            {t('sub')}
          </p>
        </div>

        {/* ── MOBILE: stacked flex with vertical connectors ── */}
        <div
          className="flex flex-col items-center md:hidden"
          style={{ margin: '48px auto 0', maxWidth: '320px', direction: isRTL ? 'rtl' : 'ltr' }}
        >
          <div className="w-full">
            <StepCard number={t('step1_number')} title={t('step1_title')} body={t('step1_body')} delay="0" />
          </div>
          <VConnector />
          <div className="w-full">
            <StepCard number={t('step2_number')} title={t('step2_title')} body={t('step2_body')} delay="150" />
          </div>
          <VConnector />
          <div className="w-full">
            <StepCard number={t('step3_number')} title={t('step3_title')} body={t('step3_body')} delay="300" />
          </div>
        </div>

        {/* ── DESKTOP: flex row with horizontal connectors ── */}
        <div
          className="hidden md:flex"
          style={{
            flexDirection: 'row',
            alignItems: 'flex-start',
            justifyContent: 'center',
            maxWidth: '900px',
            margin: '40px auto 0',
            direction: isRTL ? 'rtl' : 'ltr',
          }}
        >
          <div style={{ flex: 1 }}>
            <StepCard number={t('step1_number')} title={t('step1_title')} body={t('step1_body')} delay="0" />
          </div>
          <HConnector />
          <div style={{ flex: 1 }}>
            <StepCard number={t('step2_number')} title={t('step2_title')} body={t('step2_body')} delay="150" />
          </div>
          <HConnector />
          <div style={{ flex: 1 }}>
            <StepCard number={t('step3_number')} title={t('step3_title')} body={t('step3_body')} delay="300" />
          </div>
        </div>

      </div>
    </section>
  );
}
