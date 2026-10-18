'use client';

import { useTranslations, useLocale } from 'next-intl';

export default function SalesFlowDiagram() {
  const t = useTranslations('flow');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const nodes = [
    { emoji: '💳', titleKey: 'node1_title', descKey: 'node1_desc' },
    { emoji: '📦', titleKey: 'node2_title', descKey: 'node2_desc' },
    { emoji: '☁️', titleKey: 'node3_title', descKey: 'node3_desc' },
    { emoji: '💬', titleKey: 'node4_title', descKey: 'node4_desc' },
    { emoji: '🧠', titleKey: 'node5_title', descKey: 'node5_desc' },
  ] as const;

  return (
    <section style={{ padding: '60px 24px', background: '#0A2318', position: 'relative' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', direction: isRTL ? 'rtl' : 'ltr' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2
            className="font-arabic font-bold text-white"
            style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: '12px' }}
          >
            {t('title')}
          </h2>
          <p style={{ fontFamily: fontBody, fontSize: '15px', color: 'rgba(255,255,255,0.55)', maxWidth: '640px', margin: '0 auto', lineHeight: 1.6 }}>
            {t('sub')}
          </p>
        </div>

        {/* Desktop: horizontal flow */}
        <div className="hidden md:flex" style={{ alignItems: 'flex-start', justifyContent: 'center', gap: 0, direction: isRTL ? 'rtl' : 'ltr' }}>
          {nodes.map((n, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start' }}>
              {/* Node */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '140px' }}>
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: 'rgba(240,180,41,0.15)',
                    border: '2px solid #F0B429',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    boxShadow: '0 0 24px rgba(240,180,41,0.20)',
                  }}
                >
                  {n.emoji}
                </div>
                <div style={{ marginTop: '14px', textAlign: 'center', padding: '0 4px' }}>
                  <div style={{ fontFamily: fontBody, fontSize: '14px', fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>
                    {t(n.titleKey)}
                  </div>
                  <div style={{ fontFamily: fontBody, fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '4px', lineHeight: 1.4 }}>
                    {t(n.descKey)}
                  </div>
                </div>
              </div>
              {/* Connector */}
              {i < nodes.length - 1 && (
                <div
                  style={{
                    position: 'relative',
                    width: '60px',
                    height: '72px',
                    display: 'flex',
                    alignItems: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      borderTop: '2px dashed rgba(240,180,41,0.35)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: 0,
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#F0B429',
                      transform: 'translateY(-50%)',
                      animation: `flow-dot 2.5s ${i * 0.5}s ease-in-out infinite`,
                      boxShadow: '0 0 8px rgba(240,180,41,0.6)',
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Mobile: vertical flow */}
        <div className="flex md:hidden" style={{ flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          {nodes.map((n, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(240,180,41,0.15)',
                    border: '2px solid #F0B429',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                  }}
                >
                  {n.emoji}
                </div>
                <div style={{ marginTop: '8px', textAlign: 'center', maxWidth: '180px' }}>
                  <div style={{ fontFamily: fontBody, fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                    {t(n.titleKey)}
                  </div>
                  <div style={{ fontFamily: fontBody, fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginTop: '2px' }}>
                    {t(n.descKey)}
                  </div>
                </div>
              </div>
              {i < nodes.length - 1 && (
                <div style={{ position: 'relative', width: '2px', height: '40px', margin: '12px 0', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', inset: 0, borderLeft: '2px dashed rgba(240,180,41,0.35)' }} />
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: '50%',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: '#F0B429',
                      transform: 'translateX(-50%)',
                      animation: `flow-dot-v 2.5s ${i * 0.5}s ease-in-out infinite`,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes flow-dot {
          0% { left: 0; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { left: calc(100% - 8px); opacity: 0; }
        }
        @keyframes flow-dot-v {
          0% { top: 0; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { top: calc(100% - 8px); opacity: 0; }
        }
      `}</style>
    </section>
  );
}
