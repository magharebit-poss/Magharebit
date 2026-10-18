import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const titles: Record<string, string> = {
    ar: 'حالة النظام | MAGHAREBIT POS',
    fr: 'Statut du système | MAGHAREBIT POS',
    en: 'System Status | MAGHAREBIT POS',
  };
  const descs: Record<string, string> = {
    ar: 'تحقق من حالة خدمات MAGHAREBIT POS في الوقت الفعلي.',
    fr: 'Vérifiez l\'état en temps réel des services MAGHAREBIT POS.',
    en: 'Check the real-time status of MAGHAREBIT POS services.',
  };
  return {
    title: titles[locale] ?? titles['ar'],
    description: descs[locale] ?? descs['ar'],
  };
}

const SERVICES = [
  { name: { ar: 'نقطة البيع (POS)', fr: 'Point de vente (POS)', en: 'Point of Sale (POS)' }, status: 'operational' },
  { name: { ar: 'إدارة المخزون', fr: 'Gestion des stocks', en: 'Inventory Management' }, status: 'operational' },
  { name: { ar: 'التقارير والتحليلات', fr: 'Rapports & Analytique', en: 'Reports & Analytics' }, status: 'operational' },
  { name: { ar: 'بوابة المستخدم', fr: 'Portail utilisateur', en: 'User Portal' }, status: 'operational' },
];

const INCIDENTS = [
  {
    date: '2025-05-20',
    title: { ar: 'بطء في تحميل التقارير', fr: 'Lenteur de chargement des rapports', en: 'Slow report loading' },
    detail: { ar: 'تم حل المشكلة خلال 23 دقيقة. جميع الخدمات تعمل بشكل طبيعي.', fr: 'Problème résolu en 23 minutes. Tous les services fonctionnent normalement.', en: 'Issue resolved in 23 minutes. All services operating normally.' },
    resolved: true,
  },
  {
    date: '2025-04-11',
    title: { ar: 'انقطاع جزئي في المزامنة', fr: 'Interruption partielle de synchronisation', en: 'Partial sync interruption' },
    detail: { ar: 'أثّر على بعض المستخدمين لمدة 11 دقيقة. تم الإصلاح وتعزيز البنية التحتية.', fr: 'Impact limité pendant 11 minutes. Infrastructure renforcée.', en: 'Limited impact for 11 minutes. Infrastructure reinforced.' },
    resolved: true,
  },
  {
    date: '2025-02-28',
    title: { ar: 'صيانة مجدولة', fr: 'Maintenance planifiée', en: 'Scheduled maintenance' },
    detail: { ar: 'توقف مخطط لمدة 30 دقيقة لترقية قاعدة البيانات. جميع البيانات محفوظة.', fr: 'Arrêt planifié de 30 minutes pour mise à jour de la base de données.', en: 'Planned 30-minute downtime for database upgrade.' },
    resolved: true,
  },
];

export default async function StatusPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const l = locale as 'ar' | 'fr' | 'en';
  const isRTL = locale === 'ar';
  const fontFamily = isRTL
    ? 'Noto Naskh Arabic, Cairo, serif'
    : 'Plus Jakarta Sans, Inter, sans-serif';

  const labels = {
    ar: {
      badge: 'الحالة',
      heading: 'حالة النظام',
      all_operational: 'جميع الأنظمة تعمل بشكل طبيعي',
      operational: 'يعمل',
      degraded: 'أداء منخفض',
      down: 'متوقف',
      incidents: 'الحوادث السابقة',
      resolved: 'تم الحل',
    },
    fr: {
      badge: 'Statut',
      heading: 'Statut du système',
      all_operational: 'Tous les systèmes fonctionnent normalement',
      operational: 'Opérationnel',
      degraded: 'Dégradé',
      down: 'Interrompu',
      incidents: 'Incidents passés',
      resolved: 'Résolu',
    },
    en: {
      badge: 'Status',
      heading: 'System Status',
      all_operational: 'All systems operational',
      operational: 'Operational',
      degraded: 'Degraded',
      down: 'Down',
      incidents: 'Past incidents',
      resolved: 'Resolved',
    },
  }[l];

  const statusStyle = (s: string) => {
    if (s === 'operational') return { bg: '#DCFCE7', text: '#166534', dot: '#22C55E' };
    if (s === 'degraded')    return { bg: '#FEF9C3', text: '#854D0E', dot: '#F0B429' };
    return                          { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444' };
  };

  const statusLabel = (s: string) =>
    s === 'operational' ? labels.operational : s === 'degraded' ? labels.degraded : labels.down;

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
            style={{ display: 'inline-block', background: 'rgba(34,197,94,0.15)', color: '#22C55E', fontWeight: 700, fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', borderRadius: '999px', padding: '6px 16px', marginBottom: '20px', fontFamily: 'Inter, sans-serif', border: '1px solid rgba(34,197,94,0.3)' }}
          >
            🟢 {labels.badge}
          </span>
          <h1 style={{ color: '#FFFFFF', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', fontWeight: 800, margin: '0 0 16px', fontFamily, lineHeight: 1.2 }}>
            {labels.heading}
          </h1>
          <p style={{ color: '#22C55E', fontSize: '1.1rem', fontFamily, margin: 0, fontWeight: 600 }}>
            ✅ {labels.all_operational}
          </p>
        </section>

        {/* Content */}
        <div style={{ maxWidth: '760px', margin: '0 auto', padding: '60px 24px 80px', direction: isRTL ? 'rtl' : 'ltr' }}>

          {/* Services */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '60px' }}>
            {SERVICES.map((svc, i) => {
              const st = statusStyle(svc.status);
              return (
                <div
                  key={i}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <span style={{ color: '#FFFFFF', fontSize: '15px', fontWeight: 600, fontFamily }}>
                    {svc.name[l] ?? svc.name['ar']}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: st.bg, color: st.text, fontSize: '12px', fontWeight: 700, padding: '4px 12px', borderRadius: '999px', fontFamily: 'Inter, sans-serif' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: st.dot, display: 'inline-block', flexShrink: 0 }} />
                    {statusLabel(svc.status)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Incidents */}
          <h2 style={{ color: 'rgba(255,255,255,0.50)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '24px', fontFamily: 'Inter, sans-serif' }}>
            {labels.incidents}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {INCIDENTS.map((inc, i) => (
              <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '12px', padding: '20px 24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ color: '#FFFFFF', fontSize: '14px', fontWeight: 600, fontFamily }}>
                    {inc.title[l] ?? inc.title['ar']}
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', background: '#DCFCE7', color: '#166534', fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', fontFamily: 'Inter, sans-serif', flexShrink: 0 }}>
                    ✓ {labels.resolved}
                  </span>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '13px', margin: '0 0 8px', fontFamily, lineHeight: 1.6 }}>
                  {inc.detail[l] ?? inc.detail['ar']}
                </p>
                <span style={{ color: 'rgba(255,255,255,0.30)', fontSize: '12px', fontFamily: 'Inter, sans-serif' }}>
                  {new Date(inc.date).toLocaleDateString(locale === 'ar' ? 'ar-MA' : locale === 'fr' ? 'fr-FR' : 'en-GB', { dateStyle: 'long' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
