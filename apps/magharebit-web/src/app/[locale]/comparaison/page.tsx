import type { Metadata } from 'next';
import { setRequestLocale, getTranslations, getLocale } from 'next-intl/server';
import Link from 'next/link';
import AOSInit from '@/components/AOSInit';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import { pageAlternates, ogBase } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  setRequestLocale((await params).locale);
  const t = await getTranslations('compare');
  const locale = await getLocale();
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: pageAlternates(locale, `/comparaison`),
    openGraph: { ...ogBase(locale), title: t('meta_title'), description: t('meta_desc') },
  };
}

// Format: [criterion, MAGHAREBIT, Generic Intl POS (free), Generic Intl POS + add-ons, Caisse Classique]
type Cell = string;
type Row = [Cell, Cell, Cell, Cell, Cell];

const SECTIONS: { title: string; rows: Row[] }[] = [
  {
    title: 'LANGUE & MARCHÉ LOCAL — اللغة والسوق المحلي',
    rows: [
      ['Interface en Darija / دارجة',      '✓', '✗', '✗', '✗'],
      ['Interface arabe RTL native',        '✓', 'partiel', 'partiel', '✗'],
      ['Devise MAD native (درهم)',          '✓', 'manuel', 'manuel', '✗'],
      ['Support client en Darija',          '✓', '✗', '✗', 'N/A'],
      ['Multilingue (ar/fr/en)',            '✓', 'partiel', 'partiel', '✗'],
    ],
  },
  {
    title: 'FONCTIONNALITÉS POS — وظائف الكاشير',
    rows: [
      ['Mode hors-ligne complet',                  '✓', '✓', '✓', '✓'],
      ['Synchronisation cloud automatique',         '✓', '✓', '✓', '✗'],
      ['Multi-caisses simultanées',                 '✓', 'option payante', '✓', '✗'],
      ['Multi-branches',                            '✓', '✗', 'option payante', '✗'],
      ['Gestion des shifts cashiers',               '✓', '✗', 'option payante', '✗'],
      ['Impression reçu thermique',                 '✓', '✓', '✓', '✓'],
    ],
  },
  {
    title: 'WHATSAPP & RAPPORTS — واتساب والتقارير',
    rows: [
      ['Rapports WhatsApp automatiques',       '✓', '✗', '✗', '✗'],
      ['Alertes stock faible via WhatsApp',     '✓', '✗', '✗', '✗'],
      ['Rapport journalier automatique',        '✓', '✗', '✗', '✗'],
      ['Tableau de bord mobile patron',         '✓', 'partiel', 'partiel', '✗'],
      ['Export Excel/CSV',                      '✓', '✓', '✓', '✗'],
    ],
  },
  {
    title: 'STOCK & INTELLIGENCE — المخزون والذكاء',
    rows: [
      ['Gestion stock en temps réel',          '✓', '✗', 'option payante', '✗'],
      ['Alertes rupture de stock',              '✓', '✗', 'option payante', '✗'],
      ['Suggestions IA pour stock',             '✓', '✗', '✗', '✗'],
      ['Scan facture fournisseur (OCR)',         '✓', '✗', '✗', '✗'],
      ['Gestion recettes/ingrédients',          '✓', '✗', 'option payante', '✗'],
    ],
  },
  {
    title: 'PRIX & ENGAGEMENT — السعر والالتزام',
    rows: [
      ['Prix de départ',          '249 MAD/mois', 'Gratuit', '25 $/mois+', '0 MAD'],
      ['Gestion stock incluse',   '✓', '✗', '+25 $/mois', '✗'],
      ['Employés illimités',      '✓', '✗', '+25 $/mois', '✗'],
      ['Support humain inclus',   '✓', '✗', 'e-mail seulement', 'N/A'],
      ['Sans engagement annuel',  '✓', 'N/A', '✗', 'N/A'],
      ['Migration gratuite',      '✓', 'N/A', 'payante', 'N/A'],
    ],
  },
];

function renderCell(value: string, isMagharebit: boolean) {
  if (value === '✓') {
    return <span style={{ color: isMagharebit ? '#F0B429' : '#22C55E', fontWeight: 700, fontSize: isMagharebit ? '18px' : '16px' }}>✓</span>;
  }
  if (value === '✗') {
    return <span style={{ color: 'rgba(255,255,255,0.30)', fontSize: '16px' }}>✗</span>;
  }
  if (value === 'partiel' || value === 'option payante' || value === 'payante') {
    return <span style={{ color: '#F59E0B', fontSize: '13px', fontWeight: 600 }}>{value}</span>;
  }
  if (value === 'N/A') {
    return <span style={{ color: 'rgba(255,255,255,0.30)', fontSize: '12px' }}>N/A</span>;
  }
  return <span style={{ color: isMagharebit ? '#F0B429' : 'rgba(255,255,255,0.80)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 600 }}>{value}</span>;
}

export default async function ComparisonPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('compare');
  const locale = await getLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

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

        {/* Migration callout (from a generic international POS) */}
        <section style={{ padding: '0 24px 32px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div
              data-aos="fade-up"
              style={{
                background: 'rgba(240,180,41,0.07)',
                border: '1px solid rgba(240,180,41,0.20)',
                borderRadius: '12px',
                padding: '20px 28px',
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                flexWrap: 'wrap',
                direction: isRTL ? 'rtl' : 'ltr',
              }}
            >
              <span style={{ fontSize: '28px', flexShrink: 0 }}>🔄</span>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <p style={{ fontFamily: fontBody, fontSize: '16px', fontWeight: 700, color: '#F0B429', margin: '0 0 4px' }}>
                  {isRTL ? 'هل تستخدم أحد الأنظمة الأجنبية غير المعربة؟ الانتقال مجاني وسريع.' : 'Vous utilisez un POS international générique ? Migration gratuite en 1 heure.'}
                </p>
                <p style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.65)', margin: 0, lineHeight: 1.6 }}>
                  {isRTL
                    ? 'نستورد كتالوج منتجاتك من أحد الأنظمة الأجنبية غير المعربة مجاناً، مع الحفاظ على بياناتك.'
                    : 'On importe votre catalogue depuis votre POS international générique gratuitement — aucune donnée perdue.'}
                </p>
              </div>
              <Link
                href={`/${locale}/demo`}
                style={{
                  flexShrink: 0,
                  background: '#F0B429', color: '#0A2318', fontWeight: 700, fontFamily: fontBody,
                  fontSize: '14px', borderRadius: '8px', padding: '10px 20px', textDecoration: 'none', whiteSpace: 'nowrap',
                }}
              >
                {isRTL ? 'انتقل الآن ←' : 'Migrer maintenant →'}
              </Link>
            </div>
          </div>
        </section>

        {/* Comparison table */}
        <section style={{ padding: '0 24px 60px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div
              data-aos="fade-up"
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderRadius: '16px',
                overflow: 'hidden',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '720px' }}>
                  <thead>
                    <tr style={{ background: '#0F3D2A' }}>
                      <th style={{ padding: '14px 20px', textAlign: 'left', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.65)', textTransform: 'uppercase', letterSpacing: '0.04em', minWidth: '240px', position: 'sticky', left: 0, background: '#0F3D2A', zIndex: 1 }}>
                        Critère
                      </th>
                      <th style={{ padding: '14px 20px', textAlign: 'center', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', fontWeight: 700, color: '#F0B429', textTransform: 'uppercase', letterSpacing: '0.04em', boxShadow: 'inset 0 0 30px rgba(240,180,41,0.08)' }}>
                        MAGHAREBIT 🇲🇦
                      </th>
                      <th style={{ padding: '14px 20px', textAlign: 'center', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        POS international générique (gratuit)
                      </th>
                      <th style={{ padding: '14px 20px', textAlign: 'center', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        POS international générique + options
                      </th>
                      <th style={{ padding: '14px 20px', textAlign: 'center', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', fontWeight: 700, color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Caisse Classique
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {SECTIONS.map((section) => (
                      <>
                        <tr key={section.title}>
                          <td colSpan={5} style={{ padding: '16px 24px', background: 'rgba(240,180,41,0.06)', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '12px', fontWeight: 700, color: '#F0B429', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                            {section.title}
                          </td>
                        </tr>
                        {section.rows.map((row, ri) => (
                          <tr key={`${section.title}-${ri}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <td style={{ padding: '13px 20px', fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.85)', position: 'sticky', left: 0, background: '#0A2318' }}>
                              {row[0]}
                            </td>
                            <td style={{ padding: '13px 20px', textAlign: 'center', boxShadow: 'inset 0 0 30px rgba(240,180,41,0.06)' }}>
                              {renderCell(row[1], true)}
                            </td>
                            <td style={{ padding: '13px 20px', textAlign: 'center' }}>{renderCell(row[2], false)}</td>
                            <td style={{ padding: '13px 20px', textAlign: 'center' }}>{renderCell(row[3], false)}</td>
                            <td style={{ padding: '13px 20px', textAlign: 'center' }}>{renderCell(row[4], false)}</td>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Why us cards */}
        <section style={{ padding: '40px 24px 60px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <h2
              data-aos="fade-up"
              className="font-arabic font-bold text-white text-center"
              style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '32px' }}
            >
              {t('why_title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '24px' }}>
              {([
                { emoji: '🇲🇦', titleKey: 'why1_title', bodyKey: 'why1_body' },
                { emoji: '🧠', titleKey: 'why2_title', bodyKey: 'why2_body' },
                { emoji: '🤝', titleKey: 'why3_title', bodyKey: 'why3_body' },
              ] as const).map((c, i) => (
                <div
                  key={i}
                  data-aos="fade-up"
                  data-aos-delay={String(i * 100)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '28px',
                    direction: isRTL ? 'rtl' : 'ltr',
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  <div style={{ fontSize: '40px', marginBottom: '14px' }}>{c.emoji}</div>
                  <div style={{ fontFamily: fontBody, fontSize: '17px', fontWeight: 700, color: '#fff', marginBottom: '10px' }}>
                    {t(c.titleKey)}
                  </div>
                  <p style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, margin: 0 }}>
                    {t(c.bodyKey)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '20px 24px 100px', textAlign: 'center' }}>
          <div data-aos="fade-up" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
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
