import type { Metadata } from 'next';
import { getTranslations, getLocale } from 'next-intl/server';
import AOSInit from '@/components/AOSInit';
import Navbar from '@/components/Navbar';
import Footer from '@/components/landing/Footer';
import DemoForm from '@/components/landing/DemoForm';
import AvailabilityIndicator from '@/components/AvailabilityIndicator';
import { BRAND } from '@/lib/brand';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('demo');
  const locale = await getLocale();
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: { canonical: `/${locale}/demo` },
    openGraph: {
      title: t('meta_title'),
      description: t('meta_desc'),
    },
  };
}

export default async function DemoPage() {
  const t = await getTranslations('demo');
  const tTest = await getTranslations('testimonial');
  const locale = await getLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const trustBullets = [t('trust_b1'), t('trust_b2'), t('trust_b3'), t('trust_b4')];

  return (
    <>
      <AOSInit />
      <Navbar />
      <main style={{ background: '#0A2318', minHeight: '100vh' }}>

        {/* Hero */}
        <section
          style={{
            paddingTop: '120px',
            paddingBottom: '60px',
            paddingLeft: '24px',
            paddingRight: '24px',
            textAlign: 'center',
          }}
        >
          <div style={{ maxWidth: '600px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
            <span
              data-aos="fade-down"
              className="badge-pill font-display"
            >
              {t('label')}
            </span>
            <h1
              data-aos="fade-up"
              className="font-arabic font-extrabold text-white"
              style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.15, marginBottom: '16px' }}
            >
              {t('page_title')}
            </h1>
            <p
              data-aos="fade-up"
              data-aos-delay="80"
              style={{ fontFamily: fontBody, fontSize: '17px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.7 }}
            >
              {t('page_sub')}
            </p>
          </div>
        </section>

        {/* Two-column layout */}
        <section style={{ padding: '0 24px 100px' }}>
          <div
            className="grid grid-cols-1 lg:grid-cols-2"
            style={{ maxWidth: '1100px', margin: '0 auto', gap: '48px', alignItems: 'start', direction: isRTL ? 'rtl' : 'ltr' }}
          >

            {/* Left — trust builders */}
            <div data-aos="fade-up" style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
              <h2
                className="font-arabic font-bold text-white"
                style={{ fontSize: 'clamp(1.4rem, 3vw, 1.85rem)', marginBottom: '28px', lineHeight: 1.3 }}
              >
                {t('why_title')}
              </h2>

              {/* Bullet points */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '36px' }}>
                {trustBullets.map((bullet, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                    }}
                  >
                    <span
                      style={{
                        flexShrink: 0,
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: 'rgba(240,180,41,0.15)',
                        border: '1px solid rgba(240,180,41,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#F0B429',
                        fontSize: '12px',
                        fontWeight: 700,
                        marginTop: '2px',
                      }}
                    >
                      ✓
                    </span>
                    <span style={{ fontFamily: fontBody, fontSize: '15px', color: 'rgba(255,255,255,0.80)', lineHeight: 1.5 }}>
                      {bullet}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mini stats row */}
              <div
                style={{
                  display: 'flex',
                  gap: '0',
                  marginBottom: '28px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                {[
                  { num: t('stat1_num'), lbl: t('stat1_lbl') },
                  { num: t('stat2_num'), lbl: t('stat2_lbl') },
                  { num: t('stat3_num'), lbl: t('stat3_lbl') },
                ].map((stat, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      padding: '14px 12px',
                      textAlign: 'center',
                      borderInlineEnd: i < 2 ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'Plus Jakarta Sans, sans-serif',
                        fontWeight: 800,
                        fontSize: '1.35rem',
                        color: '#F0B429',
                        lineHeight: 1,
                        marginBottom: '4px',
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {stat.num}
                    </div>
                    <div style={{ fontFamily: fontBody, fontSize: '11px', color: 'rgba(255,255,255,0.50)', lineHeight: 1.3 }}>
                      {stat.lbl}
                    </div>
                  </div>
                ))}
              </div>

              {/* Mini testimonial card */}
              <div
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '14px',
                  padding: '20px 24px',
                  marginBottom: '28px',
                  direction: isRTL ? 'rtl' : 'ltr',
                }}
              >
                <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                  {[1,2,3,4,5].map(s => (
                    <span key={s} style={{ color: '#F0B429', fontSize: '14px' }}>★</span>
                  ))}
                </div>
                <p
                  style={{
                    fontFamily: fontBody,
                    fontSize: '13px',
                    color: 'rgba(255,255,255,0.70)',
                    lineHeight: 1.65,
                    marginBottom: '12px',
                    fontStyle: 'italic',
                  }}
                >
                  &ldquo;{tTest('quote').split('MAGHAREBIT POS')[0]}
                  <strong style={{ color: '#F0B429', fontStyle: 'normal' }}>MAGHAREBIT POS</strong>
                  {tTest('quote').split('MAGHAREBIT POS')[1]}&rdquo;
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #0F3D2A, #1a5c3a)',
                      border: '2px solid rgba(240,180,41,0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      color: '#F0B429',
                      flexShrink: 0,
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                    }}
                  >
                    {tTest('initials')}
                  </div>
                  <div style={{ textAlign: isRTL ? 'right' : 'left' }}>
                    <div style={{ fontFamily: fontBody, fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>{tTest('name')}</div>
                    <div style={{ fontFamily: fontBody, fontSize: '11px', color: 'rgba(255,255,255,0.50)' }}>{tTest('role')}</div>
                  </div>
                </div>
              </div>

              {/* WhatsApp CTA */}
              <p style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.50)', marginBottom: '10px', textAlign: isRTL ? 'right' : 'left' }}>
                {t('wa_or_label')}
              </p>
              <a
                href={BRAND.contact.waLink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  fontFamily: fontBody,
                  fontWeight: 700,
                  fontSize: '15px',
                  color: '#FFFFFF',
                  background: '#25D366',
                  borderRadius: '12px',
                  padding: '14px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 20px rgba(37,211,102,0.35)',
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  width: '100%',
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                {t('wa_phone_btn')}
              </a>
              {/* Live availability indicator */}
              <div style={{ marginTop: '12px', textAlign: isRTL ? 'right' : 'left' }}>
                <AvailabilityIndicator />
              </div>
              {/* Response time badge */}
              <p
                style={{
                  fontFamily: fontBody,
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.38)',
                  textAlign: 'center',
                  marginTop: '8px',
                }}
              >
                {t('response_badge')}
              </p>

              {/* ── What happens next — 4-step timeline ── */}
              <div style={{ marginTop: '40px' }}>
                <h3
                  style={{
                    fontFamily: fontBody,
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.55)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    marginBottom: '20px',
                    textAlign: isRTL ? 'right' : 'left',
                  }}
                >
                  {t('next_title')}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {[
                    { icon: t('next_1_icon'), title: t('next_1_title'), body: t('next_1_body') },
                    { icon: t('next_2_icon'), title: t('next_2_title'), body: t('next_2_body') },
                    { icon: t('next_3_icon'), title: t('next_3_title'), body: t('next_3_body') },
                    { icon: t('next_4_icon'), title: t('next_4_title'), body: t('next_4_body') },
                  ].map((step, idx, arr) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        gap: '14px',
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                      }}
                    >
                      {/* Connector column */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          flexShrink: 0,
                          width: '36px',
                        }}
                      >
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'rgba(240,180,41,0.12)',
                            border: '1.5px solid rgba(240,180,41,0.3)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            flexShrink: 0,
                          }}
                        >
                          {step.icon}
                        </div>
                        {idx < arr.length - 1 && (
                          <div
                            style={{
                              width: '1.5px',
                              flex: 1,
                              minHeight: '20px',
                              background: 'rgba(240,180,41,0.15)',
                              margin: '4px 0',
                            }}
                          />
                        )}
                      </div>

                      {/* Content */}
                      <div
                        style={{
                          paddingBottom: idx < arr.length - 1 ? '16px' : '0',
                          flex: 1,
                          textAlign: isRTL ? 'right' : 'left',
                        }}
                      >
                        <div
                          style={{
                            fontFamily: fontBody,
                            fontSize: '14px',
                            fontWeight: 700,
                            color: '#FFFFFF',
                            marginBottom: '4px',
                            lineHeight: 1.35,
                            paddingTop: '6px',
                          }}
                        >
                          {step.title}
                        </div>
                        <div
                          style={{
                            fontFamily: fontBody,
                            fontSize: '12px',
                            color: 'rgba(255,255,255,0.48)',
                            lineHeight: 1.55,
                          }}
                        >
                          {step.body}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — DemoForm */}
            <div data-aos="fade-up" data-aos-delay="100">
              {/* Trust bar */}
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '20px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                paddingBottom: '16px',
                marginBottom: '24px',
              }}>
                {t('trust_bar').split('·').map(s => s.trim()).filter(Boolean).map((item) => (
                  <span key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.55)' }}>
                    <span style={{ color: '#F0B429', fontWeight: 700 }}>✓</span>
                    {item}
                  </span>
                ))}
              </div>
              <DemoForm />
            </div>

          </div>
        </section>

      </main>
      <Footer />
    </>
  );
}
