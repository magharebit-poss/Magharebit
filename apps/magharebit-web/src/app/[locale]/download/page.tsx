import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import Link from 'next/link';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'download' });
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
  };
}

export default async function DownloadPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'download' });
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Plus Jakarta Sans, Inter, sans-serif';

  const windowsUrl = process.env.NEXT_PUBLIC_DOWNLOAD_WINDOWS_URL ?? '';
  const androidUrl = process.env.NEXT_PUBLIC_DOWNLOAD_ANDROID_URL ?? '';

  const platforms = [
    {
      key: 'windows',
      icon: '🖥️',
      label: t('windows_label'),
      desc: t('windows_desc'),
      req: t('req_windows'),
      url: windowsUrl,
    },
    {
      key: 'android',
      icon: '📱',
      label: t('android_label'),
      desc: t('android_desc'),
      req: t('req_android'),
      url: androidUrl,
    },
  ];

  const steps = [
    { icon: '⬇️', label: t('step1_label') },
    { icon: '🔑', label: t('step2_label') },
    { icon: '🔐', label: t('step3_label') },
    { icon: '🛒', label: t('step4_label') },
  ];

  return (
    <main style={{ minHeight: '100vh', background: '#0A2318' }}>

      {/* Hero */}
      <section
        style={{
          background: 'linear-gradient(135deg, #071A10 0%, #0F3D2A 100%)',
          padding: '100px 24px 80px',
          textAlign: 'center',
          direction: isRTL ? 'rtl' : 'ltr',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span
          style={{
            display: 'inline-block',
            background: 'rgba(240,180,41,0.15)',
            color: '#F0B429',
            fontWeight: 700,
            fontSize: '11px',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            borderRadius: '999px',
            padding: '6px 16px',
            marginBottom: '20px',
            border: '1px solid rgba(240,180,41,0.3)',
          }}
        >
          {t('badge')}
        </span>

        <h1
          style={{
            color: '#FFFFFF',
            fontSize: 'clamp(2rem, 5vw, 3.2rem)',
            fontWeight: 800,
            margin: '0 0 16px',
            fontFamily: fontBody,
            lineHeight: 1.2,
          }}
        >
          {t('heading')}
        </h1>

        <p
          style={{
            color: 'rgba(255,255,255,0.65)',
            fontSize: '1.1rem',
            maxWidth: '520px',
            margin: '0 auto',
            fontFamily: fontBody,
            lineHeight: 1.7,
          }}
        >
          {t('sub')}
        </p>
      </section>

      {/* Download cards */}
      <section
        style={{
          maxWidth: '860px',
          margin: '0 auto',
          padding: '60px 24px 0',
          direction: isRTL ? 'rtl' : 'ltr',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {platforms.map((p) => (
            <div
              key={p.key}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: '16px',
                padding: '36px 28px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isRTL ? 'flex-end' : 'flex-start',
                textAlign: isRTL ? 'right' : 'left',
              }}
            >
              <div style={{ fontSize: '48px', lineHeight: 1, marginBottom: '20px' }}>
                {p.icon}
              </div>

              <h2
                style={{
                  fontSize: '22px',
                  fontWeight: 800,
                  margin: '0 0 8px',
                  color: '#FFFFFF',
                  fontFamily: fontBody,
                }}
              >
                {p.label}
              </h2>

              <p
                style={{
                  fontSize: '14px',
                  color: 'rgba(255,255,255,0.60)',
                  margin: '0 0 8px',
                  fontFamily: fontBody,
                }}
              >
                {p.desc}
              </p>

              <p
                style={{
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.35)',
                  margin: '0 0 28px',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                {p.req}
              </p>

              {p.url ? (
                <a
                  href={p.url}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#F0B429',
                    color: '#0A2318',
                    fontWeight: 700,
                    fontSize: '15px',
                    borderRadius: '999px',
                    padding: '12px 28px',
                    textDecoration: 'none',
                    fontFamily: fontBody,
                    boxShadow: '0 4px 16px rgba(240,180,41,0.3)',
                  }}
                >
                  {t('download_btn')}
                </a>
              ) : (
                <span
                  style={{
                    display: 'inline-block',
                    background: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.40)',
                    fontWeight: 600,
                    fontSize: '14px',
                    borderRadius: '999px',
                    padding: '12px 28px',
                    fontFamily: fontBody,
                  }}
                >
                  {t('coming_soon')}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Activation flow ─────────────────────────────────────── */}
      <section
        style={{
          maxWidth: '860px',
          margin: '0 auto',
          padding: '72px 24px 0',
          direction: isRTL ? 'rtl' : 'ltr',
        }}
      >
        <h2
          style={{
            textAlign: 'center',
            color: '#FFFFFF',
            fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
            fontWeight: 800,
            margin: '0 0 48px',
            fontFamily: fontBody,
          }}
        >
          {t('steps_title')}
        </h2>

        {/* Steps row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            gap: '0',
            flexWrap: 'wrap',
          }}
        >
          {steps.map((step, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0',
              }}
            >
              {/* Step card */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  width: '140px',
                }}
              >
                {/* Gold-circled number */}
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #F0B429, #D4A017)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '14px',
                    boxShadow: '0 4px 16px rgba(240,180,41,0.35)',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: '22px', lineHeight: 1 }}>{step.icon}</span>
                </div>
                {/* Step number */}
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'rgba(240,180,41,0.70)',
                    letterSpacing: '0.08em',
                    fontFamily: 'Inter, sans-serif',
                    marginBottom: '6px',
                    textTransform: 'uppercase',
                  }}
                >
                  {i + 1}
                </span>
                {/* Label */}
                <span
                  style={{
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.80)',
                    fontFamily: fontBody,
                    lineHeight: 1.4,
                    maxWidth: '110px',
                  }}
                >
                  {step.label}
                </span>
              </div>

              {/* Dashed connector (not after last step) */}
              {i < steps.length - 1 && (
                <div
                  style={{
                    width: '48px',
                    height: '2px',
                    borderTop: '2px dashed rgba(240,180,41,0.30)',
                    marginBottom: '60px',
                    flexShrink: 0,
                  }}
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Detailed requirements ────────────────────────────────── */}
      <section
        style={{
          maxWidth: '860px',
          margin: '0 auto',
          padding: '64px 24px 80px',
          direction: isRTL ? 'rtl' : 'ltr',
        }}
      >
        <h2
          style={{
            textAlign: 'center',
            color: '#FFFFFF',
            fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
            fontWeight: 800,
            margin: '0 0 36px',
            fontFamily: fontBody,
          }}
        >
          {t('requirements_title')}
        </h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
          }}
        >
          {/* Windows requirements */}
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '28px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <span style={{ fontSize: '28px', lineHeight: 1 }}>🖥️</span>
              <span
                style={{
                  fontSize: '17px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  fontFamily: fontBody,
                }}
              >
                Windows
              </span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                t('req_windows'),
                t('req_win_ram'),
                t('req_win_storage'),
                t('req_win_printer'),
                t('req_win_screen'),
                t('req_win_net'),
              ].map((req) => (
                <li
                  key={req}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.70)',
                    fontFamily: fontBody,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: '#F0B429', fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>✓</span>
                  {req}
                </li>
              ))}
            </ul>
          </div>

          {/* Android requirements */}
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              padding: '28px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <span style={{ fontSize: '28px', lineHeight: 1 }}>📱</span>
              <span
                style={{
                  fontSize: '17px',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  fontFamily: fontBody,
                }}
              >
                Android
              </span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[
                t('req_android'),
                t('req_and_ram'),
                t('req_and_storage'),
                t('req_and_tablet'),
                t('req_and_screen'),
                t('req_and_net'),
              ].map((req) => (
                <li
                  key={req}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.70)',
                    fontFamily: fontBody,
                    lineHeight: 1.5,
                  }}
                >
                  <span style={{ color: '#F0B429', fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>✓</span>
                  {req}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Version history ─────────────────────────────── */}
        <div style={{ marginTop: '64px' }}>
          <h2
            style={{
              textAlign: 'center',
              color: '#FFFFFF',
              fontSize: 'clamp(1.3rem, 3vw, 1.8rem)',
              fontWeight: 800,
              margin: '0 0 32px',
              fontFamily: fontBody,
            }}
          >
            {t('versions_title')}
          </h2>

          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            {[
              {
                version: 'v2.1.0',
                date: locale === 'ar' ? '10 مايو 2025' : locale === 'fr' ? '10 mai 2025' : 'May 10, 2025',
                tag: locale === 'ar' ? 'مستقر' : locale === 'fr' ? 'Stable' : 'Stable',
                tagBg: 'rgba(34,197,94,0.15)',
                tagColor: '#22C55E',
                notes: locale === 'ar'
                  ? 'تحسينات الأداء، دعم الطابعة الحرارية الجديدة، إصلاح مشاكل المزامنة'
                  : locale === 'fr'
                  ? 'Améliorations des performances, nouvelle imprimante thermique, correctifs de synchronisation'
                  : 'Performance improvements, new thermal printer support, sync bug fixes',
              },
              {
                version: 'v2.0.0',
                date: locale === 'ar' ? '15 مارس 2025' : locale === 'fr' ? '15 mars 2025' : 'March 15, 2025',
                tag: locale === 'ar' ? 'رئيسي' : locale === 'fr' ? 'Majeur' : 'Major',
                tagBg: 'rgba(99,102,241,0.15)',
                tagColor: '#818CF8',
                notes: locale === 'ar'
                  ? 'واجهة مستخدم جديدة، لوحة تحليلات متقدمة، دعم فروع متعددة'
                  : locale === 'fr'
                  ? 'Nouvelle interface, tableau de bord analytique avancé, support multi-boutiques'
                  : 'New UI, advanced analytics dashboard, multi-branch support',
              },
              {
                version: 'v1.5.0',
                date: locale === 'ar' ? '20 يناير 2025' : locale === 'fr' ? '20 janvier 2025' : 'January 20, 2025',
                tag: locale === 'ar' ? 'قديم' : locale === 'fr' ? 'Ancien' : 'Legacy',
                tagBg: 'rgba(255,255,255,0.06)',
                tagColor: 'rgba(255,255,255,0.45)',
                notes: locale === 'ar'
                  ? 'إضافة إدارة العملاء، تصدير التقارير PDF، دعم الباركود المتعدد'
                  : locale === 'fr'
                  ? 'Gestion clients ajoutée, export PDF des rapports, support multi-codes-barres'
                  : 'Customer management added, PDF report export, multi-barcode support',
              },
            ].map((v, i, arr) => (
              <div
                key={v.version}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '20px',
                  padding: '20px 24px',
                  borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  direction: isRTL ? 'rtl' : 'ltr',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontFamily: 'Inter, monospace',
                    fontSize: '15px',
                    fontWeight: 700,
                    color: '#F0B429',
                    minWidth: '70px',
                    flexShrink: 0,
                    letterSpacing: '0.02em',
                  }}
                >
                  {v.version}
                </span>
                <span
                  style={{
                    display: 'inline-block',
                    background: v.tagBg,
                    color: v.tagColor,
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '999px',
                    padding: '3px 10px',
                    fontFamily: 'Inter, sans-serif',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  {v.tag}
                </span>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: '14px',
                      color: 'rgba(255,255,255,0.70)',
                      margin: '0 0 4px',
                      fontFamily: fontBody,
                      lineHeight: 1.5,
                    }}
                  >
                    {v.notes}
                  </p>
                  <p
                    style={{
                      fontSize: '12px',
                      color: 'rgba(255,255,255,0.30)',
                      margin: 0,
                      fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    {v.date}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <a
              href={`/${locale}/changelog`}
              style={{
                color: '#F0B429',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                fontFamily: fontBody,
              }}
            >
              {t('versions_link')}
            </a>
          </div>
        </div>

        {/* Back link */}
        <div style={{ marginTop: '48px', textAlign: 'center' }}>
          <Link
            href={`/${locale}`}
            style={{
              color: 'rgba(255,255,255,0.50)',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: fontBody,
            }}
          >
            {isRTL ? '← العودة للرئيسية' : locale === 'fr' ? "← Retour à l'accueil" : '← Back to home'}
          </Link>
        </div>
      </section>
    </main>
  );
}
