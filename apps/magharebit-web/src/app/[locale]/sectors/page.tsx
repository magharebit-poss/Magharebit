import type { Metadata } from 'next';
import { getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import AOSInit from '@/components/AOSInit';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import { BRAND } from '@/lib/brand';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('sectors');
  const locale = await getLocale();
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: { canonical: `/${locale}/sectors` },
    openGraph: {
      title: t('meta_title'),
      description: t('meta_desc'),
    },
  };
}

const SECTOR_EMOJIS = ['🥖', '🛒', '☕', '💄', '👗', '💊', '🥩', '🌯', '🍽️'];
const SECTOR_SLUGS = [
  'boulangerie',
  'epicerie',
  'cafe-restaurant',
  'salon-beaute',
  'boutique-vetements',
  'pharmacie',
  'boucherie',
  'snack-shawarma',
  'traiteur',
];

export default async function SectorsPage() {
  const t = await getTranslations('sectors');
  const locale = await getLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const sectors = SECTOR_SLUGS.map((slug, i) => ({
    emoji: SECTOR_EMOJIS[i],
    name: t(`s${i + 1}_name`),
    desc: t(`s${i + 1}_desc`),
    slug,
  }));

  return (
    <>
      <AOSInit />
      <Navbar />
      <main style={{ background: '#0A2318', minHeight: '100vh' }}>

        {/* Hero */}
        <section
          style={{
            paddingTop: '120px',
            paddingBottom: '80px',
            paddingLeft: '24px',
            paddingRight: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '720px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <span
              className="badge-pill font-display"
              data-aos="fade-down"
            >
              {t('badge')}
            </span>
            <h1
              data-aos="fade-up"
              className="font-arabic font-extrabold text-white"
              style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.15, marginBottom: '20px' }}
            >
              {t('hero_title')}
            </h1>
            <p
              data-aos="fade-up"
              data-aos-delay="100"
              style={{ fontFamily: fontBody, fontSize: '17px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.7 }}
            >
              {t('hero_sub')}
            </p>
          </div>
        </section>

        {/* Sectors grid */}
        <section style={{ padding: '0 24px 80px' }}>
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            style={{ maxWidth: '1100px', margin: '0 auto', gap: '24px' }}
          >
            {sectors.map((sector, i) => (
              <Link
                key={i}
                href={`/${locale}/sectors/${sector.slug}`}
                style={{ textDecoration: 'none', color: 'inherit' }}
              >
                <div
                  data-aos="fade-up"
                  data-aos-delay={String(i * 80)}
                  className="card-feature-hover"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '32px',
                    direction: isRTL ? 'rtl' : 'ltr',
                    textAlign: isRTL ? 'right' : 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    height: '100%',
                  }}
                >
                  <div style={{ fontSize: '48px', lineHeight: 1 }}>{sector.emoji}</div>
                  <div style={{ fontFamily: fontBody, fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>
                    {sector.name}
                  </div>
                  <div style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.65, flex: 1 }}>
                    {sector.desc}
                  </div>
                  <div style={{ paddingTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span className="card-learn-more" style={{ fontFamily: fontBody, fontSize: '13px', color: '#F0B429', fontWeight: 600 }}>
                      {t('card_discover')}
                    </span>
                    <span
                      className="sector-demo-cta"
                      style={{ fontFamily: fontBody }}
                    >
                      {t('card_demo_cta')}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Feature matrix */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

            <div style={{ textAlign: 'center', marginBottom: '40px', direction: isRTL ? 'rtl' : 'ltr' }}>
              <h2
                data-aos="fade-up"
                className="font-arabic font-bold text-white"
                style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)' }}
              >
                {t('matrix_title')}
              </h2>
            </div>

            {/* Horizontally scrollable on mobile */}
            <div data-aos="fade-up" style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  minWidth: '640px',
                  borderCollapse: 'collapse',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <thead>
                  <tr style={{ background: '#0F3D2A' }}>
                    <th
                      style={{
                        padding: '14px 20px',
                        textAlign: isRTL ? 'right' : 'left',
                        fontFamily: fontBody,
                        fontSize: '12px',
                        fontWeight: 700,
                        color: 'rgba(255,255,255,0.60)',
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {isRTL ? 'الميزة' : locale === 'fr' ? 'Fonctionnalité' : 'Feature'}
                    </th>
                    {sectors.map((sector) => (
                      <th
                        key={sector.slug}
                        style={{
                          padding: '14px 12px',
                          textAlign: 'center',
                          fontFamily: fontBody,
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'rgba(255,255,255,0.70)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <span style={{ fontSize: '18px', display: 'block', marginBottom: '2px' }}>{sector.emoji}</span>
                        {sector.name.split(' ')[0]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {([
                    // [feature label key, [sector indices with ✅ (0-based)]]
                    ['feat1', [0, 1, 2, 3, 4, 5]],
                    ['feat2', [0, 1, 2, 3, 4, 5]],
                    ['feat3', [0, 2]],
                    ['feat4', [0, 1, 5]],
                    ['feat5', [2]],
                    ['feat6', [0, 1, 2]],
                  ] as [string, number[]][]).map(([featKey, activeIdx], rowIdx) => (
                    <tr
                      key={featKey}
                      style={{
                        background: rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                        borderBottom: rowIdx < 5 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      }}
                    >
                      <td
                        style={{
                          padding: '13px 20px',
                          fontFamily: fontBody,
                          fontSize: '14px',
                          color: 'rgba(255,255,255,0.80)',
                          textAlign: isRTL ? 'right' : 'left',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t(featKey)}
                      </td>
                      {sectors.map((_, colIdx) => (
                        <td
                          key={colIdx}
                          style={{
                            padding: '13px 12px',
                            textAlign: 'center',
                            fontSize: '16px',
                          }}
                        >
                          {activeIdx.includes(colIdx) ? (
                            <span style={{ color: '#F0B429' }}>✅</span>
                          ) : (
                            <span style={{ color: 'rgba(255,255,255,0.20)', fontSize: '18px' }}>—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          </div>
        </section>

        {/* Bottom CTA */}
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
              style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '12px' }}
            >
              {t('cta_title')}
            </h2>
            <p style={{ fontFamily: fontBody, color: 'rgba(255,255,255,0.60)', marginBottom: '28px', lineHeight: 1.7 }}>
              {t('cta_sub')}
            </p>
            <a
              href={BRAND.contact.waLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                fontFamily: fontBody,
                fontWeight: 700,
                fontSize: '16px',
                color: '#FFFFFF',
                background: '#25D366',
                borderRadius: '999px',
                padding: '14px 36px',
                textDecoration: 'none',
                boxShadow: '0 6px 24px rgba(37,211,102,0.35)',
              }}
            >
              {t('cta_btn')}
            </a>
          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
