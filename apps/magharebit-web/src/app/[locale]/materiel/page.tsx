import type { Metadata } from 'next';
import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import AOSInit from '@/components/AOSInit';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import MaterielSelfTest from '@/components/MaterielSelfTest';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('materiel');
  const locale = await getLocale();
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: { canonical: `/${locale}/materiel` },
    openGraph: { title: t('meta_title'), description: t('meta_desc') },
  };
}

export default async function MaterielPage() {
  const t = await getTranslations('materiel');
  const locale = await getLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const cards = [
    {
      emoji: '🖨️',
      titleKey: 'card1_title',
      descKey: 'card1_desc',
      brands: ['Epson', 'Star', 'Xprinter', 'Bixolon'],
    },
    {
      emoji: '📷',
      titleKey: 'card2_title',
      descKey: 'card2_desc',
      brands: ['Honeywell', 'Zebra', 'Datalogic', t('brand_generic')],
    },
    {
      emoji: '💰',
      titleKey: 'card3_title',
      descKey: 'card3_desc',
      brands: ['APG', 'Star', t('brand_generic')],
    },
    {
      emoji: '⚖️',
      titleKey: 'card4_title',
      descKey: 'card4_desc',
      brands: ['Cas', 'Mettler', 'RS232'],
    },
  ] as const;

  return (
    <>
      <AOSInit />
      <Navbar />
      <main style={{ background: '#0A2318', minHeight: '100vh' }}>

        {/* Hero */}
        <section style={{ paddingTop: '120px', paddingBottom: '60px', padding: '120px 24px 60px' }}>
          <div style={{ maxWidth: '740px', margin: '0 auto', textAlign: 'center', direction: isRTL ? 'rtl' : 'ltr' }}>
            <span className="badge-pill font-display" data-aos="fade-down">{t('badge')}</span>
            <h1
              data-aos="fade-up"
              className="font-arabic font-extrabold text-white"
              style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.15, marginBottom: '16px' }}
            >
              {t('hero_title')}
            </h1>
            <p data-aos="fade-up" data-aos-delay="100" style={{ fontFamily: fontBody, fontSize: '17px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              {t('hero_sub')}
            </p>
          </div>
        </section>

        {/* 4 cards */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '20px' }}>
              {cards.map((c, i) => (
                <div
                  key={i}
                  data-aos="fade-up"
                  data-aos-delay={String(i * 80)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '28px',
                    direction: isRTL ? 'rtl' : 'ltr',
                    textAlign: isRTL ? 'right' : 'left',
                    transition: 'all 0.2s ease',
                  }}
                  className="card-feature-hover"
                >
                  <div
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      background: 'rgba(240,180,41,0.12)',
                      border: '1px solid rgba(240,180,41,0.30)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '36px',
                      marginBottom: '16px',
                    }}
                  >
                    {c.emoji}
                  </div>
                  <div style={{ fontFamily: fontBody, fontSize: '17px', fontWeight: 700, color: '#fff', marginBottom: '8px' }}>
                    {t(c.titleKey)}
                  </div>
                  <p style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: '16px' }}>
                    {t(c.descKey)}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                    {c.brands.map((b, bi) => (
                      <span key={bi} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '999px', padding: '4px 12px', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', color: 'rgba(255,255,255,0.80)' }}>
                        {b}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontFamily: fontBody, fontSize: '12px', color: '#22C55E', fontWeight: 600 }}>
                    ✓ {t('tested_validated')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pack section */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div
              data-aos="fade-up"
              style={{
                background: 'linear-gradient(135deg, rgba(15,61,42,0.6), rgba(15,61,42,0.3))',
                border: '1px solid rgba(34,197,94,0.20)',
                borderRadius: '20px',
                padding: '32px',
                direction: isRTL ? 'rtl' : 'ltr',
              }}
            >
              <h2 className="font-arabic font-bold text-white text-center" style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', marginBottom: '8px' }}>
                {t('pack_title')}
              </h2>
              <p style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.65)', textAlign: 'center', marginBottom: '28px' }}>
                {t('pack_sub')}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '20px' }}>
                {[
                  { name: t('pack_starter_name'), price: '1,990 MAD', itemsKey: 'pack_starter_items', accent: 'rgba(240,180,41,0.20)' },
                  { name: t('pack_business_name'), price: '3,990 MAD', itemsKey: 'pack_business_items', accent: 'rgba(240,180,41,0.40)' },
                ].map((p, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: `1px solid ${p.accent}`,
                      borderRadius: '14px',
                      padding: '24px',
                    }}
                  >
                    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: '20px', color: '#fff', marginBottom: '4px' }}>
                      {p.name}
                    </div>
                    <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: '28px', color: '#F0B429', marginBottom: '16px', letterSpacing: '-0.01em' }}>
                      {p.price}
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(t.raw(p.itemsKey) as string[]).map((item, ii) => (
                        <li key={ii} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.80)' }}>
                          <span style={{ color: '#F0B429', flexShrink: 0 }}>✓</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: '28px' }}>
                <Link
                  href={`/${locale}/demo`}
                  style={{
                    display: 'inline-flex',
                    fontFamily: fontBody,
                    fontWeight: 700,
                    fontSize: '15px',
                    color: '#0A2318',
                    background: '#F0B429',
                    borderRadius: '999px',
                    padding: '12px 28px',
                    textDecoration: 'none',
                  }}
                >
                  {t('pack_cta')} →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Self-test */}
        <section style={{ padding: '0 24px 100px' }}>
          <div style={{ maxWidth: '760px', margin: '0 auto' }}>
            <MaterielSelfTest />
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
