import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import { setRequestLocale } from 'next-intl/server';
import { pageAlternates, ogBase } from '@/lib/seo';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  setRequestLocale((await params).locale);
  const { locale } = await params;
  const titles: Record<string, string> = {
    ar: 'سجل التحديثات | MAGHAREBIT POS',
    fr: 'Journal des mises à jour | MAGHAREBIT POS',
    en: 'Changelog | MAGHAREBIT POS',
  };
  const descs: Record<string, string> = {
    ar: 'اكتشف آخر تحديثات وميزات MAGHAREBIT POS.',
    fr: 'Découvrez les dernières mises à jour et fonctionnalités de MAGHAREBIT POS.',
    en: 'Discover the latest updates and features of MAGHAREBIT POS.',
  };
  return {
    title: titles[locale] ?? titles['ar'],
    description: descs[locale] ?? descs['ar'],
    alternates: pageAlternates(locale, '/changelog'),
    openGraph: { ...ogBase(locale), title: titles[locale] ?? titles['ar'], description: descs[locale] ?? descs['ar'] },
  };
}

const VERSIONS = [
  {
    version: 'v2.4.0',
    date: '2025-05-15',
    badge: { ar: 'جديد', fr: 'Nouveau', en: 'New' },
    badgeColor: '#22C55E',
    title: { ar: 'لوحة التحليلات المحسّنة + تصدير PDF', fr: 'Tableau analytique amélioré + export PDF', en: 'Enhanced analytics dashboard + PDF export' },
    changes: {
      ar: ['رسوم بيانية تفاعلية لتتبع المبيعات اليومية والأسبوعية', 'تصدير التقارير بصيغة PDF مباشرة من اللوحة', 'تنبيهات ذكية عند انخفاض المخزون عن الحد الأدنى', 'تحسين أداء تحميل الصفحات بنسبة 40%'],
      fr: ['Graphiques interactifs pour suivre les ventes journalières et hebdomadaires', 'Export des rapports en PDF directement depuis le tableau de bord', 'Alertes intelligentes en cas de stock faible', 'Performance des pages améliorée de 40%'],
      en: ['Interactive charts for daily and weekly sales tracking', 'Export reports to PDF directly from the dashboard', 'Smart low-stock alerts', 'Page load performance improved by 40%'],
    },
  },
  {
    version: 'v2.3.0',
    date: '2025-03-22',
    badge: { ar: 'تحسين', fr: 'Amélioration', en: 'Improvement' },
    badgeColor: '#3B82F6',
    title: { ar: 'إدارة متعددة الفروع', fr: 'Gestion multi-agences', en: 'Multi-branch management' },
    changes: {
      ar: ['تحويل المخزون بين الفروع بنقرة واحدة', 'لوحة موحدة لعرض مبيعات جميع الفروع', 'إدارة صلاحيات الموظفين لكل فرع على حدة', 'تقارير مقارنة بين الفروع'],
      fr: ['Transfert de stock entre agences en un clic', 'Tableau unifié affichant les ventes de toutes les agences', 'Gestion des permissions par agence', 'Rapports comparatifs entre agences'],
      en: ['One-click stock transfers between branches', 'Unified dashboard showing all branch sales', 'Per-branch staff permissions', 'Comparative reports across branches'],
    },
  },
  {
    version: 'v2.2.0',
    date: '2025-01-10',
    badge: { ar: 'إصلاح', fr: 'Correctif', en: 'Fix' },
    badgeColor: '#F0B429',
    title: { ar: 'إصلاحات وتحسينات عامة', fr: 'Correctifs et améliorations générales', en: 'Bug fixes and general improvements' },
    changes: {
      ar: ['إصلاح خطأ في حساب ضريبة القيمة المضافة على الفواتير', 'تحسين تجربة الطباعة على الطابعات الحرارية', 'دعم الباركود EAN-8 إضافة للـ EAN-13', 'تحسين واجهة الاستخدام على الأجهزة اللوحية'],
      fr: ['Correction d\'un bug de calcul TVA sur les factures', 'Amélioration de l\'expérience d\'impression sur imprimantes thermiques', 'Support code-barres EAN-8 en plus d\'EAN-13', 'Interface tablette améliorée'],
      en: ['Fixed VAT calculation bug on invoices', 'Improved printing experience on thermal printers', 'Added EAN-8 barcode support alongside EAN-13', 'Improved tablet UI'],
    },
  },
];

export default async function ChangelogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  setRequestLocale((await params).locale);
  const { locale } = await params;
  const l = locale as 'ar' | 'fr' | 'en';
  const isRTL = locale === 'ar';
  const fontFamily = isRTL
    ? 'Noto Naskh Arabic, Cairo, serif'
    : 'Plus Jakarta Sans, Inter, sans-serif';

  const labels = {
    ar: { badge: 'التحديثات', heading: 'سجل التحديثات', sub: 'كل ما هو جديد في MAGHAREBIT POS' },
    fr: { badge: 'Changelog', heading: 'Journal des mises à jour', sub: 'Tout ce qui est nouveau dans MAGHAREBIT POS' },
    en: { badge: 'Changelog', heading: 'Changelog', sub: 'Everything new in MAGHAREBIT POS' },
  }[l];

  return (
    <>
      <Navbar />
      <main style={{ background: '#0A2318', minHeight: '100vh' }}>

        {/* Hero */}
        <section
          style={{
            background: 'linear-gradient(135deg, #071A10 0%, #0F3D2A 100%)',
            padding: '100px 24px 80px',
            textAlign: 'center',
            direction: isRTL ? 'rtl' : 'ltr',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            position: 'relative',
          }}
        >
          <a
            href="https://x.com/teamMagharebit"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              position: 'absolute',
              top: 20,
              ...(isRTL ? { left: 20 } : { right: 20 }),
              fontSize: 13,
              color: 'rgba(255,255,255,0.55)',
              display: 'inline-flex',
              gap: 6,
              alignItems: 'center',
              textDecoration: 'none',
            }}
          >
            📱 {l === 'ar' ? 'تابع التحديثات' : l === 'fr' ? 'Suivez les mises à jour' : 'Follow updates'}
          </a>
          <span
            style={{ display: 'inline-block', background: 'rgba(240,180,41,0.15)', color: '#F0B429', fontWeight: 700, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: '999px', padding: '6px 16px', marginBottom: '20px', fontFamily: 'Inter, sans-serif', border: '1px solid rgba(240,180,41,0.3)' }}
          >
            {labels.badge}
          </span>
          <h1 style={{ color: '#FFFFFF', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, margin: '0 0 16px', fontFamily, lineHeight: 1.2 }}>
            {labels.heading}
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.60)', fontSize: '1.1rem', fontFamily, margin: 0 }}>
            {labels.sub}
          </p>
        </section>

        {/* Timeline */}
        <div
          style={{
            maxWidth: '760px',
            margin: '0 auto',
            padding: '60px 24px 80px',
            direction: isRTL ? 'rtl' : 'ltr',
          }}
        >
          {VERSIONS.map((ver, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: '24px',
                marginBottom: i < VERSIONS.length - 1 ? '48px' : '0',
                alignItems: 'flex-start',
              }}
            >
              {/* Timeline line */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: '4px' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: ver.badgeColor, flexShrink: 0 }} />
                {i < VERSIONS.length - 1 && (
                  <div style={{ width: '2px', flex: 1, background: 'rgba(255,255,255,0.08)', marginTop: '6px', minHeight: '60px' }} />
                )}
              </div>

              {/* Card */}
              <div style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', padding: '24px', marginBottom: '8px' }}>
                {/* Meta row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'Inter, monospace', fontWeight: 800, fontSize: '16px', color: '#FFFFFF' }}>
                    {ver.version}
                  </span>
                  <span style={{ display: 'inline-block', background: `${ver.badgeColor}22`, color: ver.badgeColor, fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '999px', fontFamily: 'Inter, sans-serif', border: `1px solid ${ver.badgeColor}44` }}>
                    {ver.badge[l] ?? ver.badge['ar']}
                  </span>
                  <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', fontFamily: 'Inter, sans-serif' }}>
                    {new Date(ver.date).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'long' })}
                  </span>
                </div>

                {/* Title */}
                <h3 style={{ color: '#FFFFFF', fontSize: '17px', fontWeight: 700, margin: '0 0 16px', fontFamily, lineHeight: 1.4 }}>
                  {ver.title[l] ?? ver.title['ar']}
                </h3>

                {/* Changes list */}
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(ver.changes[l] ?? ver.changes['ar']).map((change, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: ver.badgeColor, fontSize: '13px', flexShrink: 0, marginTop: '2px' }}>✦</span>
                      <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: '14px', fontFamily, lineHeight: 1.55 }}>
                        {change}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
