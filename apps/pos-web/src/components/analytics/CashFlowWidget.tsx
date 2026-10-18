'use client';
import { useEffect, useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';

interface Obligation {
  supplier_name_ar: string;
  amount_mad:       number;
  days_until_due:   number;
}

interface CashFlowDay {
  date:                  string;
  projected_inflow_mad:  number;
  projected_outflow_mad: number;
  running_balance_mad:   number;
  is_forecast:           boolean;
  risk_level:            string;
  obligations:           Obligation[];
}

interface Summary {
  total_projected_inflow:   number;
  total_projected_outflow:  number;
  total_obligations_due:    number;
  worst_balance:            number;
  worst_balance_date:       string;
  total_credit_outstanding: number;
  risk_level:               string;
  risk_code:                'none' | 'low' | 'medium' | 'high' | 'critical';
}

interface CashFlowReport {
  opening_balance: number;
  days:            CashFlowDay[];
  summary:         Summary;
}

const RISK_BG: Record<string,string> = {
  none:     'rgba(16,185,129,0.15)',
  low:      'rgba(245,158,11,0.15)',
  medium:   'rgba(249,115,22,0.15)',
  high:     'rgba(239,68,68,0.15)',
  critical: 'rgba(220,38,38,0.2)',
};
const RISK_BORDER: Record<string,string> = {
  none:     'rgba(16,185,129,0.3)',
  low:      'rgba(245,158,11,0.3)',
  medium:   'rgba(249,115,22,0.3)',
  high:     'rgba(239,68,68,0.4)',
  critical: '#EF4444',
};

interface Props { token: string; }

export function CashFlowWidget({ token }: Props) {
  const { t, lang } = useLanguage();
  const cf  = t.cashflow;
  const cur = t.analytics.currency;
  const locale = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-GB';
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });

  const [report, setReport] =
    useState<CashFlowReport|null>(null);
  const [loading, setLoading] = useState(true);
  const [failed,  setFailed]  = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch('/api/analytics/cashflow?days=30', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then(r => r.ok
        ? r.json()
        : Promise.reject(r.status)
      )
      .then((data: CashFlowReport) => setReport(data))
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{
      background: '#0F3D2A',
      borderRadius: '16px',
      padding: '1.25rem',
      border: '1px solid rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.3)',
      fontSize: '0.85rem',
      textAlign: 'center',
    }}>{cf.loading}</div>
  );

  if (failed || !report) return (
    <div style={{
      background: '#0F3D2A',
      borderRadius: '16px',
      padding: '1rem',
      border: '1px solid rgba(239,68,68,0.2)',
      color: '#FCA5A5',
      fontSize: '0.82rem',
      textAlign: 'center',
    }}>{failed ? cf.loadError : cf.noData}</div>
  );

  const s = report.summary;
  const risk = s.risk_level;
  const criticalDays = report.days.filter(d => d.risk_level === 'critical').length;

  const maxBalance = Math.max(
    ...report.days.map(d =>
      Math.abs(d.running_balance_mad)
    ),
    1
  );

  const upcoming14: Array<
    Obligation & { date: string }
  > = [];
  for (const day of report.days.slice(0,14)) {
    for (const o of day.obligations) {
      upcoming14.push({ ...o, date: day.date });
    }
  }

  return (
    <div style={{
      background: '#0F3D2A',
      borderRadius: '16px',
      padding: '1.25rem',
      border: `1px solid ${RISK_BORDER[risk] ?? RISK_BORDER['none']}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '1rem',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <h3 style={{
          color: '#F0B429', fontWeight: 700,
          fontSize: '0.95rem', margin: 0,
        }}>💰 {cf.title}</h3>
        <span style={{
          fontSize: '0.72rem',
          color: 'rgba(255,255,255,0.35)',
        }}>
          {cf.openingBalance}{' '}
          {report.opening_balance.toFixed(2)} {cur}
        </span>
      </div>

      {/* Risk banner */}
      <div style={{
        background:  RISK_BG[risk] ?? RISK_BG['none'],
        border:      `1px solid ${RISK_BORDER[risk] ?? RISK_BORDER['none']}`,
        borderRadius: '10px',
        padding:     '0.75rem 1rem',
        fontSize:    '0.85rem',
        color:       '#fff',
        animation:   risk === 'critical'
          ? 'pulse-border 1.5s ease infinite'
          : 'none',
      }}>
        {cf.risk[s.risk_code].replace('{days}', String(criticalDays))}
        {s.worst_balance < 0 && (
          <div style={{
            marginTop: '0.35rem',
            fontSize:  '0.75rem',
            color:     'rgba(255,255,255,0.55)',
          }}>
            {cf.worstBalance}{' '}
            {s.worst_balance.toFixed(2)} {cur}
            {s.worst_balance_date
              ? ` (${fmtDate(s.worst_balance_date)})`
              : ''}
          </div>
        )}
      </div>

      {/* Bar chart */}
      <div>
        <p style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '0.72rem',
          marginBottom: '0.4rem',
        }}>{cf.dailyBalance}</p>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '2px',
          height: '80px',
          position: 'relative',
        }}>
          {report.days.map((day, i) => {
            const h = Math.round(
              (Math.abs(day.running_balance_mad)
               / maxBalance) * 72
            );
            const positive =
              day.running_balance_mad >= 0;
            const hasOblig =
              day.obligations.length > 0;
            return (
              <div key={i}
                title={
                  `${fmtDate(day.date)}\n` +
                  `${day.running_balance_mad
                    .toFixed(0)} ${cur}` +
                  (hasOblig
                    ? `\n${cf.obligationsLabel} ${
                        day.obligations
                          .map(o => o.supplier_name_ar)
                          .join(', ')
                      }`
                    : '')
                }
                style={{
                  flex: 1,
                  height: `${Math.max(h, 2)}px`,
                  background: positive
                    ? 'rgba(16,185,129,0.6)'
                    : 'rgba(239,68,68,0.7)',
                  borderRadius: '2px 2px 0 0',
                  position: 'relative',
                  cursor: 'default',
                }}>
                {hasOblig && (
                  <div style={{
                    position: 'absolute',
                    bottom:  '-6px',
                    left:    '50%',
                    transform: 'translateX(-50%)',
                    width:   '4px',
                    height:  '4px',
                    borderRadius: '50%',
                    background: '#F0B429',
                  }} />
                )}
              </div>
            );
          })}
        </div>
        {/* X-axis labels every 7 days */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '0.4rem',
        }}>
          {[0,7,14,21,29].map(i => (
            <span key={i} style={{
              color: 'rgba(255,255,255,0.3)',
              fontSize: '0.62rem',
            }}>
              {report.days[i] && fmtDate(report.days[i].date)}
            </span>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3,1fr)',
        gap: '0.5rem',
      }}>
        {[
          {
            label: cf.totalInflow,
            value: s.total_projected_inflow
              .toFixed(0),
            color: '#10B981',
          },
          {
            label: cf.supplierObligations,
            value: s.total_obligations_due
              .toFixed(0),
            color: '#EF4444',
          },
          {
            label: cf.customerCredit,
            value: s.total_credit_outstanding
              .toFixed(0),
            color: '#F0B429',
          },
        ].map((stat, i) => (
          <div key={i} style={{
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '10px',
            padding: '0.6rem',
            textAlign: 'center',
          }}>
            <p style={{
              color: stat.color,
              fontWeight: 800,
              fontSize: '1rem',
              margin: 0,
            }}>{stat.value}</p>
            <p style={{
              color: 'rgba(255,255,255,0.4)',
              fontSize: '0.65rem',
              margin: '0.2rem 0 0',
            }}>{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Upcoming obligations */}
      {upcoming14.length > 0 && (
        <div>
          <p style={{
            color: 'rgba(255,255,255,0.5)',
            fontSize: '0.75rem',
            marginBottom: '0.4rem',
          }}>{cf.upcomingTitle}</p>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.3rem',
            maxHeight: '120px',
            overflowY: 'auto',
          }}>
            {upcoming14.map((o, i) => {
              const urgentColor =
                o.days_until_due <= 0
                  ? '#7F1D1D'
                : o.days_until_due <= 2
                  ? '#EF4444'
                : o.days_until_due <= 7
                  ? '#F0B429'
                : '#10B981';
              return (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.78rem',
                  padding:
                    '0.35rem 0.6rem',
                  background:
                    'rgba(255,255,255,0.04)',
                  borderRadius: '6px',
                }}>
                  <span style={{color:'#fff'}}>
                    {o.supplier_name_ar}
                  </span>
                  <span style={{
                    color: urgentColor,
                    fontWeight: 700,
                  }}>
                    {o.amount_mad.toFixed(0)} {cur}
                    {' '}
                    {o.days_until_due <= 0
                      ? cf.overdue
                      : cf.daysShort.replace('{n}', String(o.days_until_due))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-border {
          0%,100% { opacity: 1 }
          50%      { opacity: 0.6 }
        }
      `}</style>
    </div>
  );
}
