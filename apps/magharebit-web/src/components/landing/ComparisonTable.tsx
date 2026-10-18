'use client';

import { useTranslations, useLocale } from 'next-intl';
import { useEffect, useRef } from 'react';

export default function ComparisonTable() {
  const t = useTranslations('comparison');
  const locale = useLocale();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const rows = t.raw('rows') as Array<[string, string, string, string, string]>;
  const tbodyRef = useRef<HTMLTableSectionElement>(null);

  useEffect(() => {
    const tableRows = tbodyRef.current?.querySelectorAll<HTMLTableRowElement>('.comparison-row');
    if (!tableRows) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const delay = Number(el.dataset.delay ?? 0);
            setTimeout(() => {
              el.classList.add('visible');
            }, delay);
            observer.unobserve(el);
          }
        });
      },
      { threshold: 0.15 }
    );

    tableRows.forEach((row) => observer.observe(row));
    return () => observer.disconnect();
  }, []);

  // col 0 = feature (left-aligned), col 1 = MAGHAREBIT (gold), cols 2-4 = muted
  const headers = [
    t('col_feature'),
    t('col_m'),
    t('col_o'),
    t('col_c'),
    t('col_local'),
  ];

  return (
    <section style={{ padding: '80px 24px', background: '#0A2318' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '40px', direction: isRTL ? 'rtl' : 'ltr' }}>
          <h2
            style={{
              fontFamily: 'Noto Naskh Arabic, Cairo, serif',
              fontWeight: 800,
              fontSize: 'clamp(1.5rem, 3vw, 2rem)',
              color: '#FFFFFF',
            }}
          >
            {t('title')}
          </h2>
        </div>

        {/* Scrollable wrapper for small screens */}
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <div
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              overflow: 'hidden',
              minWidth: '600px',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#0F3D2A' }}>
                  {headers.map((col, i) => (
                    <th
                      key={i}
                      style={{
                        padding: '14px 16px',
                        textAlign: i === 0 ? (isRTL ? 'right' : 'left') : 'center',
                        fontFamily: fontBody,
                        fontSize: '12px',
                        fontWeight: 700,
                        color: i === 1 ? '#F0B429' : 'rgba(255,255,255,0.50)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        boxShadow: i === 1 ? 'inset 0 0 20px rgba(240,180,41,0.12)' : undefined,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody ref={tbodyRef}>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="comparison-row"
                    data-delay={String(i * 50)}
                    style={{
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      borderBottom:
                        i < rows.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                    }}
                  >
                    {/* Feature name */}
                    <td
                      style={{
                        padding: '13px 16px',
                        fontFamily: fontBody,
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.80)',
                        textAlign: isRTL ? 'right' : 'left',
                      }}
                    >
                      {row[0]}
                    </td>
                    {/* MAGHAREBIT — gold */}
                    <td
                      style={{
                        padding: '13px 16px',
                        fontFamily: fontBody,
                        fontSize: '14px',
                        color: '#F0B429',
                        fontWeight: 700,
                        textAlign: 'center',
                      }}
                    >
                      {row[1]}
                    </td>
                    {/* Classic POS */}
                    <td
                      style={{
                        padding: '13px 16px',
                        fontFamily: fontBody,
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.30)',
                        textAlign: 'center',
                      }}
                    >
                      {row[2]}
                    </td>
                    {/* Free Intl. Solution */}
                    <td
                      style={{
                        padding: '13px 16px',
                        fontFamily: fontBody,
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.30)',
                        textAlign: 'center',
                      }}
                    >
                      {row[3]}
                    </td>
                    {/* Local Competitor */}
                    <td
                      style={{
                        padding: '13px 16px',
                        fontFamily: fontBody,
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.30)',
                        textAlign: 'center',
                      }}
                    >
                      {row[4]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footnote */}
        <p
          style={{
            fontFamily: fontBody,
            fontSize: '11px',
            color: 'rgba(255,255,255,0.28)',
            marginTop: '12px',
            textAlign: isRTL ? 'right' : 'left',
            lineHeight: 1.5,
          }}
        >
          {t('footnote')}
        </p>
      </div>
    </section>
  );
}
