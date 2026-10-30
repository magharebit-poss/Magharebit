import type { Metadata } from 'next';
import { setRequestLocale, getTranslations, getLocale } from 'next-intl/server';
import AOSInit from '@/components/AOSInit';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import Link from 'next/link';
import ProductTourTabs from '@/components/landing/ProductTourTabs';
import ErrorBoundary from '@/components/ErrorBoundary';
import WasteTracker from '@/components/landing/WasteTracker';
import WhatsAppReportPreview from '@/components/landing/WhatsAppReportPreview';
import ProductShowcase from '@/components/landing/ProductShowcase';
import { pageAlternates, ogBase } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  setRequestLocale((await params).locale);
  const t = await getTranslations('features');
  const locale = await getLocale();
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: pageAlternates(locale, `/features`),
    openGraph: { ...ogBase(locale), title: t('meta_title'),
      description: t('meta_desc'),
    },
  };
}

const CARD_ICONS = ['🏪', '📦', '📊', '🏢', '👥', '🔗'];

export default async function FeaturesPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const t = await getTranslations('features');
  const locale = await getLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const cards: Array<{ icon: string; title: string; desc: string }> = [
    { icon: CARD_ICONS[0], title: t('card1_title'), desc: t('card1_desc') },
    { icon: CARD_ICONS[1], title: t('card2_title'), desc: t('card2_desc') },
    { icon: CARD_ICONS[2], title: t('card3_title'), desc: t('card3_desc') },
    { icon: CARD_ICONS[3], title: t('card4_title'), desc: t('card4_desc') },
    { icon: CARD_ICONS[4], title: t('card5_title'), desc: t('card5_desc') },
    { icon: CARD_ICONS[5], title: t('card6_title'), desc: t('card6_desc') },
  ];

  // Comparison table data
  const rows = [
    { label: t('compare_r1'), m: '✅', s: '❌', c: t('compare_partial') },
    { label: t('compare_r2'), m: '✅', s: '❌', c: '✅' },
    { label: t('compare_r3'), m: '✅', s: t('compare_paid'), c: '✅' },
    { label: t('compare_r4'), m: '✅', s: '❌', c: '❌' },
    { label: t('compare_r5'), m: t('compare_2min'), s: t('compare_2h'), c: t('compare_30min') },
    { label: t('compare_r6'), m: t('compare_price_m'), s: t('compare_price_s'), c: t('compare_price_c') },
  ];

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

        {/* Interactive product tour */}
        <ErrorBoundary>
          <ProductTourTabs />
        </ErrorBoundary>

        {/* Each device with its screenshot slot (src/content/media.ts) */}
        <ProductShowcase currentPath="/features" />

        {/* Feature grid */}
        <section style={{ padding: '0 24px 80px' }}>
          <div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
            style={{ maxWidth: '1100px', margin: '0 auto', gap: '24px' }}
          >
            {cards.map((card, i) => (
              <div
                key={i}
                data-aos="fade-up"
                data-aos-delay={String(i * 80)}
                className="card-feature-hover"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '16px',
                  padding: '32px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  direction: isRTL ? 'rtl' : 'ltr',
                  textAlign: isRTL ? 'right' : 'left',
                }}
              >
                <div style={{ fontSize: '40px', lineHeight: 1 }}>{card.icon}</div>
                <div style={{ fontFamily: fontBody, fontSize: '18px', fontWeight: 700, color: '#FFFFFF' }}>
                  {card.title}
                </div>
                <div style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.65, flex: 1 }}>
                  {card.desc}
                </div>
                <div style={{ paddingTop: '8px' }}>
                  <span className="card-learn-more" style={{ fontFamily: fontBody, fontSize: '13px', color: '#F0B429', fontWeight: 600 }}>
                    {t('card_learn_more')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison table */}
        <section style={{ padding: '0 24px 80px' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
            <div className="text-center mb-10" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
              <span
                className="badge-pill font-display"
                data-aos="fade-down"
              >
                {t('compare_label')}
              </span>
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
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                overflow: 'hidden',
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
                    {[t('compare_col_feature'), t('compare_col1'), t('compare_col2'), t('compare_col3')].map((col, i) => (
                      <th
                        key={i}
                        style={{
                          padding: '16px 20px',
                          textAlign: isRTL ? 'right' : 'left',
                          fontFamily: fontBody,
                          fontSize: '13px',
                          fontWeight: 700,
                          color: i === 1 ? '#F0B429' : 'rgba(255,255,255,0.50)',
                          letterSpacing: '0.03em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr
                      key={i}
                      style={{
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                        borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      }}
                    >
                      <td style={{ padding: '14px 20px', fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.80)', textAlign: isRTL ? 'right' : 'left' }}>
                        {row.label}
                      </td>
                      <td style={{ padding: '14px 20px', fontFamily: fontBody, fontSize: '14px', color: '#F0B429', fontWeight: 600, textAlign: 'center' }}>
                        {row.m}
                      </td>
                      <td style={{ padding: '14px 20px', fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>
                        {row.s}
                      </td>
                      <td style={{ padding: '14px 20px', fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.55)', textAlign: 'center' }}>
                        {row.c}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Inventory deep-dive ── */}
        <section id="inventory" style={{ padding: '60px 24px', scrollMarginTop: '80px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <span className="badge-pill font-display" style={{ marginBottom: '20px', display: 'inline-block' }}>
              {t('inventory_badge')}
            </span>
            <h2 className="font-arabic font-bold text-white" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '20px', lineHeight: 1.2 }}>
              {t('inventory_title')}
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px' }} className="md:grid-cols-2">
              {/* Paragraphs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {[t('inventory_p1'), t('inventory_p2'), t('inventory_p3')].map((p, i) => (
                  <p key={i} style={{ fontFamily: fontBody, fontSize: '15px', color: 'rgba(255,255,255,0.72)', lineHeight: 1.75, margin: 0 }}>
                    {p}
                  </p>
                ))}
              </div>
              {/* Mock dashboard */}
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '16px', overflow: 'hidden' }}>
                {/* Mock rows */}
                {[
                  { name: locale === 'ar' ? 'كرواصان' : 'Croissant', stock: '44', unit: locale === 'ar' ? 'وحدة' : 'unités', dot: '🟢', updated: locale === 'ar' ? 'منذ دقيقتين' : 'il y a 2 min' },
                  { name: locale === 'ar' ? 'قهوة' : 'Café au lait', stock: '23', unit: locale === 'ar' ? 'وحدة' : 'unités', dot: '🟢', updated: locale === 'ar' ? 'منذ 5 دق' : 'il y a 5 min' },
                  { name: locale === 'ar' ? 'عصير البرتقال' : "Jus d'orange", stock: '8', unit: locale === 'ar' ? 'ل' : 'L', dot: '🔴', updated: locale === 'ar' ? 'منذ 10 دق' : 'il y a 10 min' },
                ].map((row, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 0.8fr 0.8fr 1fr',
                      padding: '14px 20px',
                      borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                      background: row.dot === '🔴' ? 'rgba(239,68,68,0.06)' : 'transparent',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontFamily: fontBody, fontSize: '13px', color: '#fff', fontWeight: 600 }}>{row.name}</span>
                    <span style={{ fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '13px', fontWeight: 800, color: row.dot === '🔴' ? '#EF4444' : '#F0B429' }}>{row.stock} {row.unit}</span>
                    <span style={{ fontSize: '14px' }}>{row.dot}</span>
                    <span style={{ fontFamily: fontBody, fontSize: '11px', color: 'rgba(255,255,255,0.40)' }}>{row.updated}</span>
                  </div>
                ))}
                <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: isRTL ? 'right' : 'left' }}>
                  <span style={{ fontFamily: fontBody, fontSize: '13px', color: '#F0B429', fontWeight: 600 }}>
                    {t('inventory_history')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Waste tracker section ── */}
        <section id="waste" style={{ scrollMarginTop: '80px' }}>
          <WasteTracker />
        </section>

        {/* ── QR Code section ── */}
        <section id="qr" style={{ padding: '60px 24px', scrollMarginTop: '80px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <span className="badge-pill font-display" style={{ marginBottom: '16px', display: 'inline-block' }}>
                {t('qr_badge')}
              </span>
              <h2 className="font-arabic font-bold text-white" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', lineHeight: 1.2 }}>
                {t('qr_title')}
              </h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }} className="md:grid-cols-3">
              {[
                { icon: '🔍', title: t('qr_c1_title'), body: t('qr_c1_body'), status: t('qr_c1_status'), statusColor: '#22C55E', statusBg: 'rgba(34,197,94,0.12)' },
                { icon: '🧾', title: t('qr_c2_title'), body: t('qr_c2_body'), status: t('qr_c2_status'), statusColor: '#22C55E', statusBg: 'rgba(34,197,94,0.12)' },
                { icon: '🔮', title: t('qr_c3_title'), body: t('qr_c3_body'), status: t('qr_c3_status'), statusColor: '#F59E0B', statusBg: 'rgba(245,158,11,0.12)' },
              ].map((card, i) => (
                <div
                  key={i}
                  data-aos="fade-up"
                  data-aos-delay={String(i * 80)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '28px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(240,180,41,0.12)', border: '1px solid rgba(240,180,41,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                    {card.icon}
                  </div>
                  <div style={{ fontFamily: fontBody, fontWeight: 700, fontSize: '16px', color: '#FFFFFF' }}>{card.title}</div>
                  <p style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.65, margin: 0 }}>{card.body}</p>
                  <span style={{ display: 'inline-block', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: card.statusColor, background: card.statusBg, borderRadius: '999px', padding: '3px 10px', width: 'fit-content' }}>
                    {card.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── AI section ── */}
        <section id="ai" style={{ padding: '60px 24px', scrollMarginTop: '80px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <span className="badge-pill font-display" style={{ marginBottom: '16px', display: 'inline-block' }}>
                {t('ai_badge')}
              </span>
              <h2 className="font-arabic font-bold text-white" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', lineHeight: 1.2, marginBottom: '12px' }}>
                {t('ai_title')}
              </h2>
              <p style={{ fontFamily: fontBody, fontSize: '15px', color: 'rgba(255,255,255,0.52)', maxWidth: '520px', margin: '0 auto' }}>
                {t('ai_sub')}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px', marginBottom: '32px' }} className="md:grid-cols-3">
              {[
                { icon: '📈', title: t('ai_c1_title'), body: t('ai_c1_body'), note: t('ai_c1_note') },
                { icon: '⚠️', title: t('ai_c2_title'), body: t('ai_c2_body'), note: t('ai_c2_note') },
                { icon: '🔄', title: t('ai_c3_title'), body: t('ai_c3_body'), note: t('ai_c3_note') },
              ].map((card, i) => (
                <div
                  key={i}
                  data-aos="fade-up"
                  data-aos-delay={String(i * 80)}
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '16px',
                    padding: '28px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  <div style={{ fontSize: '32px', lineHeight: 1 }}>{card.icon}</div>
                  <div style={{ fontFamily: fontBody, fontWeight: 700, fontSize: '16px', color: '#FFFFFF' }}>{card.title}</div>
                  <p style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.62)', lineHeight: 1.65, margin: 0, flex: 1 }}>{card.body}</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
                    <span style={{ display: 'inline-block', fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', fontWeight: 700, color: '#F59E0B', background: 'rgba(245,158,11,0.12)', borderRadius: '999px', padding: '3px 10px', width: 'fit-content' }}>
                      {t('ai_badge_soon')}
                    </span>
                    <span style={{ fontFamily: fontBody, fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
                      {card.note}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {/* Honest disclaimer */}
            <p style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.40)', textAlign: 'center', fontStyle: 'italic' }}>
              {t('ai_disclaimer')}
            </p>
          </div>
        </section>

        {/* ── WhatsApp / Offline anchor sections ── */}
        {([
          { id: 'whatsapp', emoji: '💬', tint: 'rgba(37,211,102,0.12)', border: '#25D366', titleKey: 'anchor_wa_title',  bulletsKey: 'anchor_wa_bullets',  badge: { text: t('anchor_live'), bg: 'rgba(34,197,94,0.15)', color: '#22C55E' } },
          { id: 'offline',  emoji: '📡', tint: 'rgba(240,180,41,0.12)', border: '#F0B429', titleKey: 'anchor_off_title', bulletsKey: 'anchor_off_bullets', badge: { text: t('anchor_live'), bg: 'rgba(34,197,94,0.15)', color: '#22C55E' } },
        ] as const).map((sec) => (
          <section key={sec.id} id={sec.id} style={{ padding: '60px 24px', scrollMarginTop: '80px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ maxWidth: '900px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr', gap: '32px', direction: isRTL ? 'rtl' : 'ltr' }} className="md:grid-cols-[1fr_1.4fr]">
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: sec.tint, border: `2px solid ${sec.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '44px' }}>
                  {sec.emoji}
                </div>
              </div>
              <div>
                <span style={{ display: 'inline-block', background: sec.badge.bg, color: sec.badge.color, fontFamily: 'Plus Jakarta Sans, sans-serif', fontSize: '11px', fontWeight: 700, borderRadius: '999px', padding: '3px 12px', marginBottom: '12px', letterSpacing: '0.04em' }}>
                  {sec.badge.text}
                </span>
                <h2 className="font-arabic font-bold text-white" style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', marginBottom: '16px' }}>
                  {t(sec.titleKey)}
                </h2>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(t.raw(sec.bulletsKey) as string[]).map((b, i) => (
                    <li key={i} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.80)', lineHeight: 1.6 }}>
                      <span style={{ color: '#F0B429', flexShrink: 0, fontWeight: 700 }}>✓</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                {sec.id === 'whatsapp' && (
                  <div style={{ marginTop: '24px' }}>
                    <WhatsAppReportPreview />
                  </div>
                )}
              </div>
            </div>
          </section>
        ))}

        {/* Bottom CTA */}
        <section style={{ padding: '0 24px 100px', textAlign: 'center' }}>
          <div data-aos="fade-up" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
            <h2
              className="font-arabic font-bold text-white"
              style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '24px' }}
            >
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
