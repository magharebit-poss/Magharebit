import type { Metadata } from 'next';
import { setRequestLocale, getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import AOSInit from '@/components/AOSInit';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import MoroccoMap from '@/components/MoroccoMap';
import { MERCHANTS } from '@/data/merchants';
import { pageAlternates, ogBase } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  setRequestLocale((await params).locale);
  const t = await getTranslations('clients');
  const locale = await getLocale();
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: pageAlternates(locale, `/clients`),
    openGraph: { ...ogBase(locale), title: t('meta_title'), description: t('meta_desc') },
  };
}

export default async function ClientsPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('clients');
  const locale = (await getLocale()) as 'ar' | 'fr' | 'en';
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const featured = MERCHANTS.filter((m) => m.testimonial);
  const stats = [
    { value: t('stat1_value'), label: t('stat1_label') },
    { value: t('stat2_value'), label: t('stat2_label') },
    { value: t('stat3_value'), label: t('stat3_label') },
    { value: t('stat4_value'), label: t('stat4_label') },
  ];

  return (
    <>
      <AOSInit />
      <Navbar />
      <main style={{ background: '#0A2318', minHeight: '100vh' }}>

        {/* Hero */}
        <section style={{ paddingTop: '120px', paddingBottom: '60px', padding: '120px 24px 60px' }}>
          <div style={{ maxWidth: '740px', margin: '0 auto', textAlign: 'center', direction: isRTL ? 'rtl' : 'ltr' }}>
            <span
              className="badge-pill font-display"
              data-aos="fade-down"
            >
              {t('badge')}
            </span>
            <h1
              data-aos="fade-up"
              className="font-arabic font-extrabold text-white"
              style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.15, marginBottom: '16px' }}
            >
              {t('hero_title')}
            </h1>
            <p
              data-aos="fade-up"
              data-aos-delay="100"
              style={{ fontFamily: fontBody, fontSize: '17px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}
            >
              {t('hero_sub')}
            </p>
          </div>
        </section>

        {/* Stats bar */}
        <section style={{ padding: '0 24px 80px' }}>
          <div
            style={{
              maxWidth: '1100px',
              margin: '0 auto',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '32px 24px',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '24px',
            }}
            className="md:grid-cols-4"
            data-aos="fade-up"
          >
            {stats.map((s, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 'clamp(1.8rem, 3vw, 2.4rem)', color: '#F0B429', lineHeight: 1, letterSpacing: '-0.02em' }}>
                  {s.value}
                </div>
                <div style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginTop: '6px' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Logo grid placeholders */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <h2 className="font-arabic font-bold text-white" style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)' }}>
                {t('logos_title')}
              </h2>
            </div>
            <div
              className="grid grid-cols-3 md:grid-cols-6"
              style={{ gap: '12px' }}
              data-aos="fade-up"
            >
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '100%',
                    height: '80px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: fontBody,
                    fontSize: '11px',
                    color: 'rgba(255,255,255,0.30)',
                    filter: 'grayscale(1)',
                  }}
                >
                  [{t('logo_soon')}]
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Featured case studies */}
        {featured.length > 0 && (
          <section style={{ padding: '0 24px 80px' }}>
            <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
              <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                <h2 className="font-arabic font-bold text-white" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)' }}>
                  {t('cases_title')}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: '20px' }}>
                {featured.map((m, i) => (
                  <div
                    key={m.slug}
                    data-aos="fade-up"
                    data-aos-delay={String(i * 100)}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '16px',
                      padding: '24px',
                      direction: isRTL ? 'rtl' : 'ltr',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '32px', lineHeight: 1 }}>{m.sectorEmoji}</span>
                      <div>
                        <div style={{ fontFamily: fontBody, fontWeight: 700, color: '#fff', fontSize: '15px' }}>
                          {m.name}
                        </div>
                        <div style={{ fontFamily: fontBody, fontSize: '12px', color: 'rgba(255,255,255,0.50)' }}>
                          {m.city} · {t('since')} {m.since} · {m.branches} {m.branches > 1 ? t('branches') : t('branch')}
                        </div>
                      </div>
                    </div>
                    {m.testimonial && (
                      <p
                        style={{
                          fontFamily: fontBody,
                          fontSize: '13px',
                          color: 'rgba(255,255,255,0.75)',
                          lineHeight: 1.6,
                          fontStyle: 'italic',
                          margin: 0,
                        }}
                      >
                        &ldquo;{m.testimonial.quote[locale]}&rdquo;
                      </p>
                    )}
                    {m.metrics && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {m.metrics.wasteReduction && (
                          <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px' }}>
                            🗑️ {m.metrics.wasteReduction}
                          </span>
                        )}
                        {m.metrics.timesSaved && (
                          <span style={{ background: 'rgba(240,180,41,0.15)', color: '#F0B429', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px' }}>
                            ⏱️ {m.metrics.timesSaved}
                          </span>
                        )}
                        {m.metrics.salesIncrease && (
                          <span style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px' }}>
                            📈 {m.metrics.salesIncrease}
                          </span>
                        )}
                      </div>
                    )}
                    <div style={{ marginTop: 'auto', paddingTop: '8px' }}>
                      <Link
                        href={`/${locale}/clients/${m.slug}`}
                        style={{ fontFamily: fontBody, fontSize: '13px', color: '#F0B429', fontWeight: 600, textDecoration: 'none' }}
                      >
                        {t('read_case')} →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Map section */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '36px', direction: isRTL ? 'rtl' : 'ltr' }} data-aos="fade-up">
              {/* Section badge */}
              <div style={{ marginBottom: '12px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  background: 'rgba(240,180,41,0.10)', border: '1px solid rgba(240,180,41,0.22)',
                  borderRadius: '999px', padding: '5px 14px',
                  fontFamily: fontBody, fontSize: '12px', color: '#F0B429', fontWeight: 600,
                }}>
                  🇲🇦 {t('map_badge')}
                </span>
              </div>
              <h2 className="font-arabic font-bold text-white" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '10px' }}>
                {t('map_title')}
              </h2>
              <p style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.55)', maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
                {t('map_sub')}
              </p>
            </div>
            <MoroccoMap />
          </div>
        </section>

        {/* Migration proof */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }} data-aos="fade-up">
              <h2
                className="font-arabic font-bold text-white"
                style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', marginBottom: '10px' }}
              >
                {t('mig_title')}
              </h2>
              <p style={{ fontFamily: fontBody, fontSize: '15px', color: 'rgba(255,255,255,0.55)', maxWidth: '560px', margin: '0 auto', lineHeight: 1.6 }}>
                {t('mig_sub')}
              </p>
            </div>
            <div
              className="grid grid-cols-1 md:grid-cols-3"
              style={{ gap: '20px' }}
            >
              {[
                { icon: t('mig_1_icon'), title: t('mig_1_title'), body: t('mig_1_body') },
                { icon: t('mig_2_icon'), title: t('mig_2_title'), body: t('mig_2_body') },
                { icon: t('mig_3_icon'), title: t('mig_3_title'), body: t('mig_3_body') },
              ].map((card, i) => (
                <div
                  key={i}
                  data-aos="fade-up"
                  data-aos-delay={String(i * 100)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '28px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  <span style={{ fontSize: '32px', lineHeight: 1 }}>{card.icon}</span>
                  <div>
                    <div
                      style={{
                        fontFamily: fontBody,
                        fontWeight: 700,
                        fontSize: '16px',
                        color: '#FFFFFF',
                        marginBottom: '8px',
                      }}
                    >
                      {card.title}
                    </div>
                    <p
                      style={{
                        fontFamily: fontBody,
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.60)',
                        lineHeight: 1.65,
                        margin: 0,
                      }}
                    >
                      {card.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '0 24px 100px', textAlign: 'center' }}>
          <div data-aos="fade-up" style={{ direction: isRTL ? 'rtl' : 'ltr', maxWidth: '560px', margin: '0 auto' }}>
            <h2 className="font-arabic font-bold text-white" style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', marginBottom: '20px' }}>
              {t('cta_title')}
            </h2>
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
              {t('cta_btn')}
            </Link>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
