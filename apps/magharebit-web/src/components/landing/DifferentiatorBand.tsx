'use client';

import { useTranslations, useLocale } from 'next-intl';

export default function DifferentiatorBand() {
  const t = useTranslations('diff');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const cards = [
    {
      emoji: '🧠',
      iconTint: 'rgba(240,180,41,0.12)',
      iconBorder: '#F0B429',
      titleKey: 'ai_title',
      bodyKey: 'ai_body',
      badge: { textKey: 'badge_soon', bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' },
      anchor: 'ai',
    },
    {
      emoji: '💬',
      iconTint: 'rgba(37,211,102,0.12)',
      iconBorder: '#25D366',
      titleKey: 'wa_title',
      bodyKey: 'wa_body',
      badge: { textKey: 'badge_live', bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
      anchor: 'whatsapp',
    },
    {
      emoji: '📡',
      iconTint: 'rgba(240,180,41,0.12)',
      iconBorder: '#F0B429',
      titleKey: 'off_title',
      bodyKey: 'off_body',
      badge: { textKey: 'badge_live', bg: 'rgba(34,197,94,0.15)', color: '#22C55E' },
      anchor: 'offline',
    },
  ] as const;

  return (
    <section style={{ padding: '80px 24px', background: '#0A2318' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 className="font-arabic font-bold text-white" style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '12px' }}>
            {t('title')}
          </h2>
          <p style={{ fontFamily: fontBody, fontSize: '15px', color: 'rgba(255,255,255,0.55)', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
            {t('sub')}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: '24px' }}>
          {cards.map((c, i) => (
            <div
              key={i}
              data-aos="fade-up"
              data-aos-delay={String(i * 100)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '16px',
                padding: '32px',
                transition: 'all 0.25s ease',
                cursor: 'default',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(240,180,41,0.30)';
                e.currentTarget.style.transform = 'translateY(-6px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: c.iconTint,
                  border: `2px solid ${c.iconBorder}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '40px',
                  marginBottom: '20px',
                }}
              >
                {c.emoji}
              </div>
              <div style={{ fontFamily: fontBody, fontSize: '18px', fontWeight: 700, color: '#fff', marginBottom: '12px' }}>
                {t(c.titleKey)}
              </div>
              {c.anchor === 'ai' ? (
                /* AI card — structured bullets */
                <div style={{ marginBottom: '16px' }}>
                  <p style={{ fontFamily: fontBody, fontSize: '14px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.65, marginBottom: '10px' }}>
                    {t('ai_lead')}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '10px' }}>
                    {(t.raw('ai_bullets') as string[]).map((b, bi) => (
                      <div key={bi} style={{ fontFamily: fontBody, fontSize: '13px', color: 'rgba(255,255,255,0.80)', lineHeight: 1.45 }}>
                        {b}
                      </div>
                    ))}
                  </div>
                  <p style={{ fontFamily: fontBody, fontSize: '12px', color: 'rgba(255,255,255,0.40)', fontStyle: 'italic', margin: 0 }}>
                    {t('ai_note')}
                  </p>
                </div>
              ) : (
                <p
                  style={{
                    fontFamily: fontBody,
                    fontSize: '14px',
                    color: 'rgba(255,255,255,0.65)',
                    lineHeight: 1.65,
                    marginBottom: '16px',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {t(c.bodyKey)}
                </p>
              )}
              <span
                style={{
                  display: 'inline-block',
                  background: c.badge.bg,
                  color: c.badge.color,
                  fontFamily: 'Plus Jakarta Sans, sans-serif',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '999px',
                  padding: '3px 12px',
                  marginBottom: '14px',
                  letterSpacing: '0.04em',
                }}
              >
                {t(c.badge.textKey)}
              </span>
              <div>
                <a
                  href={`/${locale}/features#${c.anchor}`}
                  style={{
                    fontFamily: fontBody,
                    fontSize: '13px',
                    color: '#F0B429',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                >
                  {t('link_more')} →
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
