'use client';

import { useTranslations, useLocale } from 'next-intl';

// WhatsApp message content by locale
const WA_MESSAGE = {
  ar: [
    { type: 'line', bold: true, text: '📊 تقرير نهاية اليوم' },
    { type: 'line', bold: true, text: 'Café Al Baraka — الثلاثاء' },
    { type: 'spacer' },
    { type: 'line', bold: true, text: '💰 المبيعات الإجمالية' },
    { type: 'line', bold: false, text: '3,847 DH (+12% مقارنة بالأمس)' },
    { type: 'spacer' },
    { type: 'line', bold: true, text: '🏆 أفضل المنتجات' },
    { type: 'line', bold: false, text: '1. أتاي بالنعناع — 89 كأس (712 DH)' },
    { type: 'line', bold: false, text: '2. كرواصان — 134 قطعة (1,072 DH)' },
    { type: 'line', bold: false, text: '3. قهوة نص نص — 76 كأس (532 DH)' },
    { type: 'spacer' },
    { type: 'line', bold: true, text: '⚠️ تنبيهات المخزون' },
    { type: 'line', bold: false, text: '• دقيق القمح: 8 كغ (منخفض)' },
    { type: 'line', bold: false, text: '• حليب: 6 لتر (منخفض)' },
    { type: 'spacer' },
    { type: 'line', bold: true, text: '👥 الكاشيرون' },
    { type: 'line', bold: false, text: '• يوسف: 1,923 DH (50%)' },
    { type: 'line', bold: false, text: '• فاطمة: 1,924 DH (50%)' },
    { type: 'spacer' },
    { type: 'line', bold: false, text: '✅ إغلاق ناجح — 21:47' },
  ],
  fr: [
    { type: 'line', bold: true, text: '📊 Rapport de fin de journée' },
    { type: 'line', bold: true, text: 'Café Al Baraka — Mardi' },
    { type: 'spacer' },
    { type: 'line', bold: true, text: '💰 Ventes totales' },
    { type: 'line', bold: false, text: '3 847 DH (+12% vs hier)' },
    { type: 'spacer' },
    { type: 'line', bold: true, text: '🏆 Top produits' },
    { type: 'line', bold: false, text: '1. Atay menthe — 89 verres (712 DH)' },
    { type: 'line', bold: false, text: '2. Croissant — 134 pièces (1 072 DH)' },
    { type: 'line', bold: false, text: '3. Café ness-ness — 76 verres (532 DH)' },
    { type: 'spacer' },
    { type: 'line', bold: true, text: '⚠️ Alertes stock' },
    { type: 'line', bold: false, text: '• Farine: 8 kg (bas)' },
    { type: 'line', bold: false, text: '• Lait: 6 L (bas)' },
    { type: 'spacer' },
    { type: 'line', bold: true, text: '👥 Caissiers' },
    { type: 'line', bold: false, text: '• Youssef: 1 923 DH (50%)' },
    { type: 'line', bold: false, text: '• Fatima: 1 924 DH (50%)' },
    { type: 'spacer' },
    { type: 'line', bold: false, text: '✅ Clôture réussie — 21:47' },
  ],
} as const;

export default function WhatsAppReportPreview() {
  const t = useTranslations('whatsapp_report');
  const locale = useLocale();
  const isRTL  = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const msgLines = locale === 'ar' ? WA_MESSAGE.ar : WA_MESSAGE.fr;

  const benefits = [
    t('benefit1'),
    t('benefit2'),
    t('benefit3'),
    t('benefit4'),
    t('benefit5'),
  ];

  return (
    <section
      style={{
        padding: '80px 24px',
        background: '#0A2318',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div style={{ maxWidth: '1100px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>

        {/* Heading */}
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <span
            style={{
              display: 'inline-block',
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
              color: '#25D366',
              background: 'rgba(37,211,102,0.08)',
              border: '1px solid rgba(37,211,102,0.20)',
              borderRadius: '999px',
              padding: '4px 14px',
              marginBottom: '16px',
            }}
          >
            💬 WhatsApp
          </span>
          <h2
            style={{
              fontFamily: 'Noto Naskh Arabic, Cairo, serif',
              fontWeight: 800,
              fontSize: 'clamp(1.4rem, 3vw, 1.9rem)',
              color: '#FFFFFF',
              lineHeight: 1.25,
              marginBottom: '12px',
            }}
          >
            {t('title')}
          </h2>
          <p
            style={{
              fontFamily: fontBody,
              fontSize: '15px',
              color: 'rgba(255,255,255,0.52)',
              maxWidth: '520px',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            {t('sub')}
          </p>
        </div>

        {/* Two-column layout */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '40px',
            alignItems: 'center',
          }}
          className="md:grid-cols-[2fr_3fr]"
        >
          {/* Left — benefit list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {benefits.map((b, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: 'rgba(37,211,102,0.12)',
                    border: '1px solid rgba(37,211,102,0.30)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#25D366',
                    fontSize: '11px',
                    fontWeight: 700,
                    marginTop: '2px',
                  }}
                >
                  ✓
                </span>
                <span style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.80)', lineHeight: 1.55 }}>
                  {b}
                </span>
              </div>
            ))}
          </div>

          {/* Right — Phone mockup */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div
              style={{
                width: '280px',
                background: '#1A1A2E',
                borderRadius: '32px',
                border: '3px solid rgba(255,255,255,0.12)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {/* Phone notch */}
              <div
                style={{
                  height: '28px',
                  background: '#0E0E1A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '60px',
                    height: '8px',
                    borderRadius: '999px',
                    background: '#2A2A3E',
                  }}
                />
              </div>

              {/* WhatsApp chat */}
              <div style={{ background: '#E5DDD5', backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3C/svg%3E")', direction: 'ltr' }}>

                {/* Chat header */}
                <div
                  style={{
                    background: '#075E54',
                    padding: '10px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      width: '34px',
                      height: '34px',
                      borderRadius: '50%',
                      background: '#128C7E',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '14px',
                      flexShrink: 0,
                    }}
                  >
                    🌿
                  </div>
                  <div>
                    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>
                      MAGHAREBIT 🌿
                    </div>
                    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: '11px', color: 'rgba(255,255,255,0.75)' }}>
                      en ligne
                    </div>
                  </div>
                </div>

                {/* Chat body */}
                <div style={{ padding: '12px 8px', minHeight: '320px', background: '#ECE5DD' }}>
                  {/* Message bubble */}
                  <div
                    style={{
                      background: '#DCF8C6',
                      borderRadius: '8px 8px 8px 0',
                      padding: '8px 10px',
                      maxWidth: '90%',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                    }}
                  >
                    {msgLines.map((line, li) => {
                      if (line.type === 'spacer') {
                        return <div key={li} style={{ height: '6px' }} />;
                      }
                      return (
                        <div
                          key={li}
                          style={{
                            fontFamily: 'system-ui, -apple-system, sans-serif',
                            fontSize: '11.5px',
                            color: '#1A1A1A',
                            lineHeight: 1.5,
                            fontWeight: line.bold ? 600 : 400,
                            direction: locale === 'ar' ? 'rtl' : 'ltr',
                            textAlign: locale === 'ar' ? 'right' : 'left',
                          }}
                        >
                          {line.text}
                        </div>
                      );
                    })}
                    {/* Read receipt */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '4px',
                      }}
                    >
                      <span style={{ fontFamily: 'system-ui, sans-serif', fontSize: '10px', color: 'rgba(0,0,0,0.45)' }}>
                        21:47
                      </span>
                      <span style={{ fontSize: '11px', color: '#34B7F1', fontWeight: 700 }}>✓✓</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Phone home bar */}
              <div
                style={{
                  height: '20px',
                  background: '#0E0E1A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <div
                  style={{
                    width: '50px',
                    height: '4px',
                    borderRadius: '999px',
                    background: '#2A2A3E',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Disclaimer note */}
        <p
          style={{
            fontFamily: fontBody,
            fontSize: '11px',
            color: 'rgba(255,255,255,0.28)',
            textAlign: 'center',
            marginTop: '20px',
            fontStyle: 'italic',
          }}
        >
          {t('note')}
        </p>

      </div>
    </section>
  );
}
