import { getTranslations } from 'next-intl/server';
import Link from 'next/link';
import AOSInit from '@/components/AOSInit';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import { CITIES } from '@/data/cities';
import { SECTORS } from '@/data/sectors';
import { MERCHANTS } from '@/data/merchants';

interface Props {
  locale: string;
  citySlug: string;
}

export default async function CityPageContent({ locale, citySlug }: Props) {
  const data = CITIES.find((c) => c.slug === citySlug);
  if (!data) {
    // Should not happen since each city has its own explicit route
    return null;
  }

  const lang = (['ar', 'fr', 'en'] as const).includes(locale as never) ? (locale as 'ar' | 'fr' | 'en') : 'ar';
  const isRTL = lang === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';
  const t = await getTranslations('city');

  const topSectors = SECTORS.filter((s) => data.topSectors.includes(s.slug));
  const localMerchants = MERCHANTS.filter((m) => m.city === data.name).slice(0, 3);

  const heroTitle =
    lang === 'ar'
      ? `الكاشير الذكي لتجار ${data.name}`
      : lang === 'en'
      ? `The smart POS for ${data.name} merchants`
      : `La caisse intelligente pour les commerçants de ${data.name}`;

  // LocalBusiness JSON-LD — helps Google show city-specific business info
  const localBusinessSchema = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: `MAGHAREBIT — ${data.name}`,
    description: data.positioning[lang],
    address: {
      '@type': 'PostalAddress',
      addressLocality: data.name,
      addressRegion: data.region,
      addressCountry: 'MA',
    },
    telephone: '+212619522487',
    url: `https://magharebit.ma/${locale}/caisse-enregistreuse-${citySlug}`,
    areaServed: {
      '@type': 'City',
      name: data.name,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <AOSInit />
      <Navbar />
      <main style={{ background: '#0A2318', minHeight: '100vh' }}>

        {/* Hero */}
        <section style={{ paddingTop: '120px', paddingBottom: '60px', padding: '120px 24px 60px' }}>
          <div style={{ maxWidth: '740px', margin: '0 auto', textAlign: 'center', direction: isRTL ? 'rtl' : 'ltr' }}>
            <span className="badge-pill font-display" data-aos="fade-down">
              📍 {data.region}
            </span>
            <h1
              data-aos="fade-up"
              className="font-arabic font-extrabold text-white"
              style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.15, marginBottom: '16px' }}
            >
              {heroTitle}
            </h1>
            <p data-aos="fade-up" data-aos-delay="100" style={{ fontFamily: fontBody, fontSize: '17px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>
              {data.positioning[lang]}
            </p>
          </div>
        </section>

        {/* Stats */}
        <section style={{ padding: '0 24px 60px' }}>
          <div
            data-aos="fade-up"
            style={{
              maxWidth: '720px',
              margin: '0 auto',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '28px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontWeight: 800, fontSize: 'clamp(2.5rem, 5vw, 3.5rem)', color: '#F0B429', lineHeight: 1, letterSpacing: '-0.02em' }}>
              {data.merchantCount}+
            </div>
            <div style={{ fontFamily: fontBody, fontSize: '15px', color: 'rgba(255,255,255,0.65)', marginTop: '8px' }}>
              {lang === 'ar' ? `تجار في ${data.name} يثقون بـ MAGHAREBIT` : lang === 'en' ? `${data.name} merchants trust MAGHAREBIT` : `Commerces à ${data.name} font confiance à MAGHAREBIT`}
            </div>
          </div>
        </section>

        {/* Top sectors */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2
              data-aos="fade-up"
              className="font-arabic font-bold text-white text-center"
              style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', marginBottom: '8px' }}
            >
              {lang === 'ar' ? `القطاعات الأكثر نشاطاً في ${data.name}` : lang === 'en' ? `Top sectors in ${data.name}` : `Secteurs les plus actifs à ${data.name}`}
            </h2>
            <p style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginBottom: '32px' }}>
              {t('top_sectors_sub')}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '20px' }}>
              {topSectors.map((s, i) => (
                <Link
                  key={s.slug}
                  href={`/${locale}/sectors/${s.slug}`}
                  data-aos="fade-up"
                  data-aos-delay={String(i * 100)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '24px',
                    direction: isRTL ? 'rtl' : 'ltr',
                    textAlign: isRTL ? 'right' : 'left',
                    textDecoration: 'none',
                    display: 'block',
                    transition: 'all 0.2s ease',
                  }}
                  className="card-feature-hover"
                >
                  <div style={{ fontSize: '40px', marginBottom: '10px' }}>{s.emoji}</div>
                  <div style={{ fontFamily: fontBody, fontWeight: 700, fontSize: '16px', color: '#fff', marginBottom: '6px' }}>
                    {s.name[lang]}
                  </div>
                  <div style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.55 }}>
                    {s.tagline[lang]}
                  </div>
                  <div style={{ fontFamily: fontBody, fontSize: '12px', color: '#F0B429', fontWeight: 600, marginTop: '12px' }}>
                    {t('discover')} →
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Local merchants or placeholder */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2
              data-aos="fade-up"
              className="font-arabic font-bold text-white text-center"
              style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', marginBottom: '32px' }}
            >
              {lang === 'ar' ? `تجار يثقون بنا في ${data.name}` : lang === 'en' ? `Merchants trusting us in ${data.name}` : `Ils nous font confiance à ${data.name}`}
            </h2>
            {localMerchants.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '20px' }}>
                {localMerchants.map((m, i) => (
                  <div
                    key={m.slug}
                    data-aos="fade-up"
                    data-aos-delay={String(i * 100)}
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '16px',
                      padding: '22px',
                      direction: isRTL ? 'rtl' : 'ltr',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <span style={{ fontSize: '28px' }}>{m.sectorEmoji}</span>
                      <div style={{ fontFamily: fontBody, fontWeight: 700, fontSize: '14px', color: '#fff' }}>
                        {m.name}
                      </div>
                    </div>
                    {m.testimonial && (
                      <p style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.70)', lineHeight: 1.6, fontStyle: 'italic', margin: 0 }}>
                        &ldquo;{m.testimonial.quote[lang]}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                data-aos="fade-up"
                style={{
                  background: 'rgba(240,180,41,0.06)',
                  border: '1px dashed rgba(240,180,41,0.30)',
                  borderRadius: '16px',
                  padding: '40px 24px',
                  textAlign: 'center',
                  fontFamily: fontBody,
                  fontSize: '15px',
                  color: 'rgba(255,255,255,0.75)',
                }}
              >
                🌟 {lang === 'ar' ? `قريباً بينكم في ${data.name}` : lang === 'en' ? `Coming to you in ${data.name}` : `Bientôt parmi vous à ${data.name}`}
              </div>
            )}
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '20px 24px 100px', textAlign: 'center' }}>
          <div data-aos="fade-up" style={{ direction: isRTL ? 'rtl' : 'ltr', maxWidth: '560px', margin: '0 auto' }}>
            <h2 className="font-arabic font-bold text-white" style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', marginBottom: '12px' }}>
              {lang === 'ar' ? `جاهز لتنطلق في ${data.name}؟` : lang === 'en' ? `Ready to launch in ${data.name}?` : `Prêt à démarrer à ${data.name} ?`}
            </h2>
            <p style={{ fontFamily: fontBody, fontSize: '15px', color: 'rgba(255,255,255,0.60)', marginBottom: '24px', lineHeight: 1.6 }}>
              {t('cta_sub')}
            </p>
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

// Shared metadata generator
export async function generateCityMetadata(locale: string, citySlug: string) {
  const data = CITIES.find((c) => c.slug === citySlug);
  if (!data) return { title: 'Not found' };
  const lang = (['ar', 'fr', 'en'] as const).includes(locale as never) ? (locale as 'ar' | 'fr' | 'en') : 'ar';
  const title =
    lang === 'ar'
      ? `كاشير ذكي لتجار ${data.name} | MAGHAREBIT POS`
      : lang === 'en'
      ? `Smart POS for ${data.name} merchants | MAGHAREBIT POS`
      : `Caisse intelligente pour les commerçants de ${data.name} | MAGHAREBIT POS`;
  return {
    title,
    description: data.positioning[lang],
    alternates: { canonical: `/${locale}/caisse-enregistreuse-${citySlug}` },
    openGraph: { title, description: data.positioning[lang] },
  };
}
