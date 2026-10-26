import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import AOSInit from '@/components/AOSInit';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import { SECTORS } from '@/data/sectors';
import { setRequestLocale } from 'next-intl/server';
import { pageAlternates, ogBase } from '@/lib/seo';
import { breadcrumbSchema } from '@/lib/schemas';

export async function generateStaticParams() {
  const locales = ['ar', 'fr', 'en'];
  const slugs = SECTORS.map((s) => s.slug);
  return locales.flatMap((locale) =>
    slugs.map((sector) => ({ locale, sector }))
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; sector: string }>;
}): Promise<Metadata> {
  setRequestLocale((await params).locale);
  const { locale, sector: slug } = await params;
  const data = SECTORS.find((s) => s.slug === slug);
  if (!data) return { title: 'Not found' };
  const lang = (locale as 'ar' | 'fr' | 'en') in data.meta.title ? locale as 'ar' | 'fr' | 'en' : 'ar';
  return {
    title: data.meta.title[lang],
    description: data.meta.desc[lang],
    alternates: pageAlternates(locale, `/sectors/${slug}`),
    openGraph: { ...ogBase(locale), title: data.meta.title[lang], description: data.meta.desc[lang] },
  };
}

export default async function SectorPage({
  params,
}: {
  params: Promise<{ locale: string; sector: string }>;
}) {
  setRequestLocale((await params).locale);
  const { locale, sector: slug } = await params;
  const data = SECTORS.find((s) => s.slug === slug);
  if (!data) notFound();

  const lang = (['ar', 'fr', 'en'].includes(locale) ? locale : 'ar') as 'ar' | 'fr' | 'en';
  const isRTL = lang === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const painPoints = data.painPoints[lang] ?? data.painPoints['ar'];
  const features   = data.features[lang]   ?? data.features['ar'];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema(lang, [
              [{ ar: 'الرئيسية', fr: 'Accueil', en: 'Home' }[lang], ''],
              [{ ar: 'القطاعات', fr: 'Secteurs', en: 'Sectors' }[lang], '/sectors'],
              [data.meta.title[lang], `/sectors/${slug}`],
            ]),
          ),
        }}
      />
      <AOSInit />
      <Navbar />
      <main style={{ background: '#0A2318', minHeight: '100vh' }}>

        {/* ── Hero ── */}
        <section
          style={{
            paddingTop: '100px',
            paddingBottom: '80px',
            paddingLeft: '24px',
            paddingRight: '24px',
            background: data.gradient,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Dark overlay */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(10,35,24,0.55)',
            }}
          />
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              maxWidth: '720px',
              margin: '0 auto',
              textAlign: 'center',
              direction: isRTL ? 'rtl' : 'ltr',
            }}
          >
            <Link
              href={`/${locale}/sectors`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontFamily: fontBody,
                fontSize: '13px',
                color: 'rgba(255,255,255,0.65)',
                textDecoration: 'none',
                marginBottom: '24px',
              }}
            >
              {isRTL ? '→' : '←'}{' '}
              {lang === 'ar' ? 'كل القطاعات' : lang === 'fr' ? 'Tous les secteurs' : 'All sectors'}
            </Link>
            <div style={{ fontSize: '72px', lineHeight: 1, marginBottom: '16px' }}>
              {data.emoji}
            </div>
            <h1
              data-aos="fade-up"
              className="font-arabic font-extrabold text-white"
              style={{ fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', lineHeight: 1.15, marginBottom: '16px' }}
            >
              {data.name[lang]}
            </h1>
            <p
              data-aos="fade-up"
              data-aos-delay="80"
              style={{ fontFamily: fontBody, fontSize: '17px', color: 'rgba(255,255,255,0.80)', lineHeight: 1.75 }}
            >
              {data.tagline[lang]}
            </p>
          </div>
        </section>

        {/* ── Pain points ── */}
        <section style={{ padding: '80px 24px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <h2
              data-aos="fade-up"
              className="font-arabic font-bold text-white"
              style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', marginBottom: '32px', textAlign: isRTL ? 'right' : 'left' }}
            >
              {lang === 'ar' ? 'التحديات التي تواجهها يومياً' : lang === 'fr' ? 'Les défis que vous affrontez chaque jour' : 'Challenges you face every day'}
            </h2>
            <div
              className="grid grid-cols-1 md:grid-cols-3"
              style={{ gap: '20px' }}
            >
              {painPoints.map((pt, i) => (
                <div
                  key={i}
                  data-aos="fade-up"
                  data-aos-delay={String(i * 80)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '14px',
                    padding: '24px',
                    fontFamily: fontBody,
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.70)',
                    lineHeight: 1.65,
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  <span style={{ color: 'rgba(255,100,100,0.80)', marginInlineEnd: '8px', fontWeight: 700 }}>✗</span>
                  {pt}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <h2
              data-aos="fade-up"
              className="font-arabic font-bold text-white"
              style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', marginBottom: '32px', textAlign: isRTL ? 'right' : 'left' }}
            >
              {lang === 'ar' ? 'كيف تحل MAGHAREBIT هذه المشاكل' : lang === 'fr' ? 'Comment MAGHAREBIT résout ces problèmes' : 'How MAGHAREBIT solves these problems'}
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {features.map((feat, i) => (
                <div
                  key={i}
                  data-aos="fade-up"
                  data-aos-delay={String(i * 60)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    fontFamily: fontBody,
                    fontSize: '15px',
                    color: 'rgba(255,255,255,0.80)',
                    lineHeight: 1.6,
                    textAlign: isRTL ? 'right' : 'left',
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                  }}
                >
                  <span style={{ color: '#F0B429', fontSize: '18px', flexShrink: 0, marginTop: '1px' }}>✓</span>
                  {feat}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Comparison table ── */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2
              data-aos="fade-up"
              className="font-arabic font-bold text-white text-center"
              style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', marginBottom: '32px', direction: isRTL ? 'rtl' : 'ltr' }}
            >
              {lang === 'ar' ? 'MAGHAREBIT مقابل الحلول التقليدية' : lang === 'fr' ? 'MAGHAREBIT vs solutions traditionnelles' : 'MAGHAREBIT vs traditional solutions'}
            </h2>
            <div data-aos="fade-up" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', overflow: 'hidden' }}>
                <thead>
                  <tr style={{ background: '#0F3D2A' }}>
                    {[
                      lang === 'ar' ? 'الجانب' : lang === 'fr' ? 'Aspect' : 'Aspect',
                      lang === 'ar' ? 'الحلول التقليدية' : lang === 'fr' ? 'Solutions traditionnelles' : 'Traditional solutions',
                      'MAGHAREBIT',
                    ].map((col, i) => (
                      <th
                        key={i}
                        style={{
                          padding: '14px 20px',
                          textAlign: i === 0 ? (isRTL ? 'right' : 'left') : 'center',
                          fontFamily: fontBody,
                          fontSize: '12px',
                          fontWeight: 700,
                          color: i === 2 ? '#F0B429' : 'rgba(255,255,255,0.60)',
                          letterSpacing: '0.04em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.comparison.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                        borderBottom: i < data.comparison.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                        direction: isRTL ? 'rtl' : 'ltr',
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.80)', textAlign: isRTL ? 'right' : 'left', fontWeight: 600 }}>
                        {row.aspect[lang]}
                      </td>
                      <td style={{ padding: '14px 20px', fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
                        {row.competitor[lang]}
                      </td>
                      <td style={{ padding: '14px 20px', fontFamily: fontBody, fontSize: '13px', color: '#F0B429', textAlign: 'center', fontWeight: 600 }}>
                        {row.magharebit[lang]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Moroccan context (sector-specific insight) ── */}
        {data.moroccanContext && (
          <section style={{ padding: '0 24px 60px' }}>
            <div
              data-aos="fade-up"
              style={{
                maxWidth: '800px',
                margin: '0 auto',
                background: 'rgba(240,180,41,0.05)',
                border: '1px solid rgba(240,180,41,0.15)',
                borderRadius: '16px',
                padding: '28px 32px',
                direction: isRTL ? 'rtl' : 'ltr',
              }}
            >
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <span style={{ fontSize: '28px', lineHeight: 1, flexShrink: 0 }}>🇲🇦</span>
                <div>
                  <p
                    style={{
                      fontFamily: fontBody,
                      fontSize: '14px',
                      color: 'rgba(255,255,255,0.75)',
                      lineHeight: 1.75,
                      margin: '0 0 12px',
                    }}
                  >
                    {data.moroccanContext[lang]}
                  </p>
                  <a
                    href={`/${locale}/features#waste`}
                    style={{
                      fontFamily: fontBody,
                      fontSize: '13px',
                      color: '#F0B429',
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >
                    {lang === 'ar'
                      ? 'انظر كيف يتتبع MAGHAREBIT الهدر ←'
                      : lang === 'fr'
                      ? 'Voir comment MAGHAREBIT trace le hedr →'
                      : 'See how MAGHAREBIT tracks waste →'}
                  </a>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Testimonial ── */}
        <section style={{ padding: '0 24px 80px' }}>
          <div
            data-aos="fade-up"
            style={{
              maxWidth: '640px',
              margin: '0 auto',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: '20px',
              padding: '36px 40px',
              direction: isRTL ? 'rtl' : 'ltr',
              textAlign: isRTL ? 'right' : 'left',
            }}
          >
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', justifyContent: isRTL ? 'flex-end' : 'flex-start' }}>
              {[1,2,3,4,5].map((s) => (
                <span key={s} style={{ color: '#F0B429', fontSize: '18px' }}>★</span>
              ))}
            </div>
            <p
              style={{
                fontFamily: fontBody,
                fontSize: '16px',
                color: 'rgba(255,255,255,0.80)',
                lineHeight: 1.75,
                marginBottom: '24px',
                fontStyle: 'italic',
              }}
            >
              &ldquo;{data.testimonial.quote[lang]}&rdquo;
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: data.gradient,
                  border: '2px solid rgba(240,180,41,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontWeight: 700,
                  fontSize: '14px',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                {data.testimonial.initials}
              </div>
              <div>
                <div style={{ fontFamily: fontBody, fontWeight: 700, fontSize: '15px', color: '#FFFFFF' }}>
                  {data.testimonial.name}
                </div>
                <div style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.50)' }}>
                  {data.testimonial.role[lang]}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Bottom CTA ── */}
        <section
          style={{
            padding: '60px 24px 100px',
            textAlign: 'center',
            background: 'rgba(255,255,255,0.02)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div data-aos="fade-up" style={{ direction: isRTL ? 'rtl' : 'ltr', maxWidth: '560px', margin: '0 auto' }}>
            <h2
              className="font-arabic font-bold text-white"
              style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', marginBottom: '12px' }}
            >
              {lang === 'ar'
                ? `جاهز لتحويل ${data.name['ar']}؟`
                : lang === 'fr'
                ? `Prêt à transformer votre ${data.name['fr']} ?`
                : `Ready to transform your ${data.name['en']}?`}
            </h2>
            <p
              style={{ fontFamily: fontBody, color: 'rgba(255,255,255,0.60)', marginBottom: '28px', lineHeight: 1.7, fontSize: '15px' }}
            >
              {lang === 'ar'
                ? 'احجز عرضاً تجريبياً مجانياً وشاهد الفرق بنفسك خلال 14 يوماً.'
                : lang === 'fr'
                ? 'Réservez une démo gratuite et constatez la différence par vous-même en 14 jours.'
                : 'Book a free demo and see the difference yourself within 14 days.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
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
                {lang === 'ar' ? 'احجز عرضاً تجريبياً' : lang === 'fr' ? 'Réserver une démo' : 'Book a demo'}
              </Link>
              {(() => {
                // Sector-specific pre-filled WhatsApp message — drops the salesperson
                // into a context-rich conversation instead of a cold opener.
                const sectorWaMessage =
                  data.whatsappMessage[lang] ?? data.whatsappMessage.fr;
                const sectorWaLink = `https://wa.me/212619522487?text=${encodeURIComponent(sectorWaMessage)}`;
                const ctaLabel =
                  lang === 'ar'
                    ? `💬 تواصل معنا على واتساب بخصوص ${data.name.ar}`
                    : lang === 'fr'
                    ? `💬 Discuter sur WhatsApp de votre ${data.name.fr}`
                    : `💬 Chat on WhatsApp about your ${data.name.en}`;
                return (
                  <a
                    href={sectorWaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex',
                      fontFamily: fontBody,
                      fontWeight: 700,
                      fontSize: '15px',
                      color: '#FFFFFF',
                      background: '#25D366',
                      borderRadius: '999px',
                      padding: '14px 28px',
                      textDecoration: 'none',
                      boxShadow: '0 4px 16px rgba(37,211,102,0.35)',
                    }}
                  >
                    {ctaLabel}
                  </a>
                );
              })()}
            </div>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
