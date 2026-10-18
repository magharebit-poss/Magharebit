'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import AOSInit from '@/components/AOSInit';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import FaqAccordion from '@/components/landing/FaqAccordion';
import Link from 'next/link';

export default function PricingPage() {
  const t = useTranslations('pricing');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const [isAnnual, setIsAnnual] = useState(false);
  const prices = {
    starter:  isAnnual ? 199 : 249,
    business: isAnnual ? 599 : 749,
  };

  const faqItems = [
    { q: t('faq_q1'),  a: t('faq_a1') },
    { q: t('faq_q2'),  a: t('faq_a2') },
    { q: t('faq_q3'),  a: t('faq_a3') },
    { q: t('faq_q4'),  a: t('faq_a4') },
    { q: t('faq_q5'),  a: t('faq_a5') },
    { q: t('faq_q6'),  a: t('faq_a6') },
    { q: t('faq_q7'),  a: t('faq_a7') },
    { q: t('faq_q8'),  a: t('faq_a8') },
    { q: t('faq_q9'),  a: t('faq_a9') },
    { q: t('faq_q10'), a: t('faq_a10') },
  ];

  // FAQPage JSON-LD — drives rich snippets in Google SERPs.
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };

  // Comparison table rows
  const compareRows: Array<{ label: string; s: string; b: string; e: string }> = [
    { label: t('compare_stores'),      s: '1',                     b: '5',                     e: t('compare_e_stores') },
    { label: t('compare_devices'),     s: '2',                     b: '10',                    e: t('compare_e_devices') },
    { label: t('compare_pos'),         s: '✅',                    b: '✅',                    e: '✅' },
    { label: t('compare_inventory'),   s: '✅',                    b: '✅',                    e: '✅' },
    { label: t('compare_ai'),          s: '❌',                    b: '✅',                    e: '✅' },
    { label: t('compare_multibranch'), s: '❌',                    b: '✅',                    e: '✅' },
    { label: t('compare_support'),     s: t('compare_email'),      b: t('compare_phone'),      e: t('compare_dedicated') },
    { label: t('compare_training'),    s: '❌',                    b: '❌',                    e: '✅' },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <AOSInit />
      <Navbar />
      <main style={{ background: '#0A2318', minHeight: '100vh' }}>

        {/* Hero + Toggle */}
        <section style={{ paddingTop: '120px', paddingBottom: '60px', paddingLeft: '24px', paddingRight: '24px', textAlign: 'center' }}>
          <div style={{ maxWidth: '720px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <span
              data-aos="fade-down"
              className="inline-block border border-gold-400/50 text-gold-400 bg-transparent text-sm font-semibold px-4 py-1.5 rounded-full mb-6 font-display"
            >
              {t('label')}
            </span>
            <h1
              data-aos="fade-up"
              className="font-arabic font-extrabold text-white"
              style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.15, marginBottom: '16px' }}
            >
              {t('page_hero_title')}
            </h1>
            <p
              data-aos="fade-up"
              data-aos-delay="80"
              style={{ fontFamily: fontBody, fontSize: '17px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.7, marginBottom: '40px' }}
            >
              {t('page_hero_sub')}
            </p>

            {/* Toggle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <div
                className="font-arabic font-semibold"
                style={{
                  background: 'rgba(240,180,41,0.15)',
                  border: '1px solid rgba(240,180,41,0.3)',
                  color: '#F0B429',
                  borderRadius: '999px',
                  padding: '3px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                {t('annual_badge')}
              </div>
              <div style={{ display: 'inline-flex', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '999px', padding: '4px', direction: 'ltr' }}>
                {[
                  { label: t('monthly'), annual: false },
                  { label: t('annual'),  annual: true },
                ].map((opt) => (
                  <button
                    key={String(opt.annual)}
                    onClick={() => setIsAnnual(opt.annual)}
                    className="font-arabic"
                    style={{
                      padding: '8px 24px',
                      borderRadius: '999px',
                      border: 'none',
                      fontWeight: 600,
                      fontSize: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: isAnnual === opt.annual ? '#F0B429' : 'transparent',
                      color: isAnnual === opt.annual ? '#0A2318' : 'rgba(255,255,255,0.65)',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing cards */}
        <section style={{ padding: '0 24px 80px' }}>
          <div
            className="grid grid-cols-1 md:grid-cols-3"
            style={{
              gap: '1.5rem',
              maxWidth: '1100px',
              margin: '0 auto',
              alignItems: 'start',
              direction: isRTL ? 'rtl' : 'ltr',
            }}
          >
            {/* Starter */}
            <div
              className={`bg-white/[0.06] rounded-3xl p-8 ${isRTL ? 'text-right' : 'text-left'}`}
              style={{ direction: isRTL ? 'rtl' : 'ltr', border: '1.5px solid rgba(255,255,255,0.12)' }}
            >
              <div className="font-display font-extrabold text-xl text-white">{t('starter_name')}</div>
              <div className="font-arabic text-white/65 text-sm mb-6">{t('starter_sub')}</div>
              <div className="flex items-baseline gap-1 justify-end mb-1">
                <span className="font-display font-extrabold text-white leading-none" style={{ fontSize: '2.6rem', letterSpacing: '-0.02em' }}>{prices.starter}</span>
                <span className="font-sans text-white/65 text-sm">MAD</span>
              </div>
              <div className="font-arabic text-white/65 text-xs mb-1">{t('per_month')}</div>
              {isAnnual ? <div className="font-arabic text-gold-400 text-xs mb-6">{t('annual_note')}</div> : <div className="mb-6" />}
              <ul className="space-y-2 mb-6 list-none p-0">
                {(t.raw('starter_features') as string[]).map((f) => (
                  <li key={f} className="font-arabic text-sm text-white/80 flex items-center gap-2 pb-2 border-b border-white/10">
                    <span className="text-gold-400 font-bold flex-shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded-2xl font-arabic font-bold text-sm border border-white/20 bg-transparent text-white hover:border-gold-400 hover:text-gold-400 transition-all cursor-pointer">
                {t('free_trial')}
              </button>
            </div>

            {/* Business — featured */}
            <div className="relative" style={{ direction: isRTL ? 'rtl' : 'ltr', marginTop: '-1rem', paddingTop: '14px' }}>
              <div
                className="bg-gold-400 text-brand-950 font-arabic font-bold text-sm px-4 py-1.5 rounded-full"
                style={{ position: 'absolute', top: '-16px', left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap', zIndex: 10 }}
              >
                {t('most_popular')}
              </div>
              <div
                className={`bg-brand-950 rounded-3xl p-8 shadow-[0_24px_48px_rgba(10,35,24,0.3)] ${isRTL ? 'text-right' : 'text-left'}`}
                style={{ transform: 'scale(1.03)', position: 'relative', zIndex: 10, border: '2px solid #F0B429' }}
              >
                <div className="font-display font-extrabold text-xl text-white">{t('business_name')}</div>
                <div className="font-arabic text-white/60 text-sm mb-6">{t('business_sub')}</div>
                <div className="flex items-baseline gap-1 justify-end mb-1">
                  <span className="font-display font-extrabold text-white leading-none" style={{ fontSize: '2.6rem', letterSpacing: '-0.02em' }}>{prices.business}</span>
                  <span className="font-sans text-white/50 text-sm">MAD</span>
                </div>
                <div className="font-arabic text-white/50 text-xs mb-1">{t('per_month')}</div>
                {isAnnual ? <div className="font-arabic text-gold-400 text-xs mb-6">{t('annual_note')}</div> : <div className="mb-6" />}
                <ul className="space-y-2 mb-6 list-none p-0">
                  {(t.raw('business_features') as string[]).map((f) => (
                    <li key={f} className="font-arabic text-sm text-white/80 flex items-center gap-2 pb-2 border-b border-white/10">
                      <span className="text-gold-400 font-bold flex-shrink-0">✓</span>{f}
                    </li>
                  ))}
                </ul>
                <button className="w-full py-3 rounded-2xl font-arabic font-bold text-sm bg-gold-400 text-brand-950 hover:bg-gold-500 transition-all shadow-[0_4px_16px_rgba(240,180,41,0.4)] cursor-pointer">
                  {t('free_trial')}
                </button>
              </div>
            </div>

            {/* Enterprise */}
            <div
              className={`bg-white/[0.06] rounded-3xl p-8 ${isRTL ? 'text-right' : 'text-left'}`}
              style={{ direction: isRTL ? 'rtl' : 'ltr', border: '1.5px solid rgba(255,255,255,0.12)' }}
            >
              <div className="font-display font-extrabold text-xl text-white">{t('enterprise_name')}</div>
              <div className="font-arabic text-white/65 text-sm mb-6">{t('enterprise_sub')}</div>
              <div className="font-arabic text-[1.75rem] font-bold text-white mb-1">{t('enterprise_custom_pricing')}</div>
              <div className="font-arabic text-white/65 text-sm mb-6">{t('enterprise_contact_label')}</div>
              <ul className="space-y-2 mb-6 list-none p-0">
                {(t.raw('enterprise_features') as string[]).map((f) => (
                  <li key={f} className="font-arabic text-sm text-white/80 flex items-center gap-2 pb-2 border-b border-white/10">
                    <span className="text-gold-400 font-bold flex-shrink-0">✓</span>{f}
                  </li>
                ))}
              </ul>
              <button className="w-full py-3 rounded-2xl font-arabic font-bold text-sm border border-white/20 bg-transparent text-white hover:border-gold-400 hover:text-gold-400 transition-all cursor-pointer">
                {t('contact_us')}
              </button>
            </div>
          </div>
        </section>

        {/* Feature comparison table */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="text-center mb-10" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
              <h2
                data-aos="fade-up"
                className="font-arabic font-bold text-white"
                style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}
              >
                {t('compare_title')}
              </h2>
            </div>
            <div
              data-aos="fade-up"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                    {[t('compare_feature'), t('starter_name'), t('business_name'), t('enterprise_name')].map((col, i) => (
                      <th
                        key={i}
                        style={{
                          padding: '16px 20px',
                          textAlign: i === 0 ? (isRTL ? 'right' : 'left') : 'center',
                          fontFamily: fontBody,
                          fontSize: '13px',
                          fontWeight: 700,
                          color: i === 2 ? '#F0B429' : 'rgba(255,255,255,0.50)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                        borderBottom: i < compareRows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.80)', textAlign: isRTL ? 'right' : 'left' }}>
                        {row.label}
                      </td>
                      <td style={{ padding: '14px 20px', fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>{row.s}</td>
                      <td style={{ padding: '14px 20px', fontFamily: fontBody, fontSize: '14px', color: '#F0B429', fontWeight: 600, textAlign: 'center' }}>{row.b}</td>
                      <td style={{ padding: '14px 20px', fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>{row.e}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '720px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <div className="text-center mb-10">
              <span
                data-aos="fade-down"
                className="inline-block border border-gold-400/50 text-gold-400 bg-transparent text-sm font-semibold px-4 py-1.5 rounded-full mb-4 font-display"
              >
                {t('faq_label')}
              </span>
              <h2
                data-aos="fade-up"
                className="font-arabic font-bold text-white"
                style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}
              >
                {t('faq_title')}
              </h2>
            </div>
            <FaqAccordion items={faqItems} isRTL={isRTL} />
          </div>
        </section>

        {/* Bottom CTA */}
        <section style={{ padding: '0 24px 100px', textAlign: 'center' }}>
          <div data-aos="fade-up" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
            <Link
              href={`/${locale}/demo`}
              style={{
                display: 'inline-flex',
                fontFamily: fontBody,
                fontWeight: 700,
                fontSize: '16px',
                color: '#0A2318',
                background: '#F0B429',
                borderRadius: '999px',
                padding: '14px 36px',
                textDecoration: 'none',
                boxShadow: '0 6px 24px rgba(240,180,41,0.4)',
              }}
            >
              {t('free_trial')}
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
