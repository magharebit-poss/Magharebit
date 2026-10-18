'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';

// ─── Types ─────────────────────────────────────────────────────────────────────
// Matches ReportSummary from src/lib/repositories/transactions.ts
interface DayData  { date: string; totalRevenue: number; totalTransactions: number; avgBasket: number }
interface TopProduct { productId: string; name: string; plu: string; totalQty: number; totalRevenue: number }
interface EmployeeStat { employeeId: string; employeeName: string; txCount: number; total: number }

interface ReportData {
  period: { from: string; to: string }
  totalRevenue: number
  totalTransactions: number
  avgBasket: number
  byPayment: Record<string, number>   // method → revenue
  byDay: DayData[]
  topProducts: TopProduct[]
  byEmployee: EmployeeStat[]
  today: { totalRevenue: number; totalTransactions: number; avgBasket: number }
  yesterday: { totalRevenue: number; totalTransactions: number }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return `MAD ${n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('ar-MA', { year: 'numeric', month: 'short', day: 'numeric' });
}
function pct(a: number, b: number) {
  if (!b) return '—';
  const d = ((a - b) / b) * 100;
  const sign = d > 0 ? '↑' : '↓';
  return `${sign} ${Math.abs(d).toFixed(1)}%`;
}
function pctColor(a: number, b: number) {
  if (!b) return '#6B7280';
  return a >= b ? '#22C55E' : '#EF4444';
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقدي', card: 'بطاقة', mobile_money: 'موبايل', mixed: 'مختلط',
};

// ─── Mini bar chart ────────────────────────────────────────────────────────────
function BarChart({ data }: { data: DayData[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.totalRevenue), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '120px', marginTop: '16px' }}>
      {data.map((d, i) => {
        const h = Math.max(4, Math.round((d.totalRevenue / max) * 100));
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: 0 }} title={`${fmtDate(d.date)}: ${fmt(d.totalRevenue)}`}>
            <div style={{ width: '100%', height: `${h}%`, background: '#0F3D2A', borderRadius: '4px 4px 0 0', transition: 'height 0.4s ease', minHeight: '4px' }} />
            <span style={{ fontSize: '9px', color: '#9CA3AF', transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap', overflow: 'hidden', maxWidth: '32px' }}>
              {new Date(d.date).toLocaleDateString('ar-MA', { day: 'numeric', month: 'numeric' })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px',
  padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
};
const TH: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600,
  color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: '12px 14px', fontSize: '14px', textAlign: 'right' };
const sectionLabel: React.CSSProperties = { fontSize: '16px', fontWeight: 700, margin: '0 0 16px', color: '#111827' };

// ─── Page ─────────────────────────────────────────────────────────────────────
// Compute default dates outside component to avoid impure Date.now() in render body
function getDefaultDates(): { from: string; to: string } {
  const to  = new Date();
  const from = new Date(to.getTime() - 30 * 86_400_000);
  return {
    to:   to.toISOString().slice(0, 10),
    from: from.toISOString().slice(0, 10),
  };
}

export default function ReportsPage() {
  const router = useRouter();

  const [dateFrom,  setDateFrom]  = useState(() => getDefaultDates().from);
  const [dateTo,    setDateTo]    = useState(() => getDefaultDates().to);
  const [data,      setData]      = useState<ReportData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  const fetchReport = useCallback(async () => {
    setLoading(true); setError('');
    const params = new URLSearchParams({ dateFrom, dateTo });
    try {
      const res = await fetch(`/api/portal/reports/summary?${params}`, { credentials: 'include' });
      if (res.status === 401) { router.push('/portal/login'); return; }
      if (!res.ok) { setError('فشل تحميل التقرير'); return; }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, router]);

  useEffect(() => {
    void (async () => { await fetchReport(); })();
  }, [fetchReport]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1000px', color: '#111827' }}>
      <PortalBreadcrumb current="التقارير" />

      {/* Header + date range */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>التقارير</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px', marginBottom: 0 }}>
            تحليل أداء متجرك
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
            <label>من:</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo}
              style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#FFFFFF' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#374151' }}>
            <label>إلى:</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom}
              style={{ padding: '8px 12px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', fontFamily: 'inherit', outline: 'none', background: '#FFFFFF' }} />
          </div>
          <button onClick={fetchReport}
            style={{ background: '#0F3D2A', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            تحديث
          </button>
        </div>
      </div>

      {loading && <div style={{ ...card, textAlign: 'center', color: '#9CA3AF', padding: '60px' }}>⏳ جارٍ تحميل التقرير...</div>}
      {error && !loading && <div style={{ ...card, color: '#DC2626', textAlign: 'center', padding: '40px' }}>{error}</div>}

      {data && !loading && (
        <>
          {/* ── Today vs Yesterday ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
            {[
              { label: 'اليوم',    d: data.today,     ref: data.yesterday },
              { label: 'الأمس',   d: data.yesterday, ref: null           },
            ].map(({ label, d, ref }) => (
              <div key={label} style={card}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 8px' }}>{label}</p>
                <p style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 4px' }}>{fmt(d.totalRevenue)}</p>
                <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 4px' }}>{d.totalTransactions} فاتورة{(d as { avgBasket?: number }).avgBasket ? ` · متوسط ${fmt((d as { avgBasket?: number }).avgBasket!)}` : ''}</p>
                {ref && (
                  <p style={{ fontSize: '13px', color: pctColor(d.totalRevenue, ref.totalRevenue), margin: 0 }}>
                    {pct(d.totalRevenue, ref.totalRevenue)} مقارنة بالأمس
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* ── Period summary ── */}
          <div style={{ ...card, marginBottom: '24px' }}>
            <p style={sectionLabel}>ملخص الفترة — {fmtDate(data.period.from)} إلى {fmtDate(data.period.to)}</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
              {[
                { label: 'إجمالي المبيعات',  value: fmt(data.totalRevenue)          },
                { label: 'عدد الفواتير',      value: String(data.totalTransactions)  },
                { label: 'متوسط السلة',       value: fmt(data.avgBasket)             },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
                  <p style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Revenue by day chart ── */}
          {data.byDay.length > 0 && (
            <div style={{ ...card, marginBottom: '24px' }}>
              <p style={sectionLabel}>المبيعات اليومية</p>
              <BarChart data={data.byDay} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
            {/* ── Top products ── */}
            <div style={card}>
              <p style={sectionLabel}>أكثر المنتجات مبيعاً</p>
              {data.topProducts.length === 0 ? (
                <p style={{ color: '#9CA3AF', fontSize: '13px' }}>لا توجد بيانات بعد</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #F3F4F6' }}>
                      {['المنتج', 'الكمية', 'الإيراد'].map(col => <th key={col} style={{ ...TH, padding: '8px 10px' }}>{col}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((p, i) => (
                      <tr key={p.productId} style={{ borderBottom: i < data.topProducts.length - 1 ? '1px solid #F9FAFB' : 'none' }}>
                        <td style={{ ...TD, padding: '10px 10px', fontWeight: 500 }}>{p.name}</td>
                        <td style={{ ...TD, padding: '10px 10px', color: '#6B7280' }}>{p.totalQty}</td>
                        <td style={{ ...TD, padding: '10px 10px', fontWeight: 600 }}>{fmt(p.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* ── By payment method ── */}
            <div style={card}>
              <p style={sectionLabel}>طريقة الدفع</p>
              {Object.keys(data.byPayment).length === 0 ? (
                <p style={{ color: '#9CA3AF', fontSize: '13px' }}>لا توجد بيانات بعد</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {Object.entries(data.byPayment).map(([method, revenue]) => {
                    const total = data.totalRevenue || 1;
                    const widthPct = Math.round((revenue / total) * 100);
                    return (
                      <div key={method}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '13px' }}>
                          <span style={{ fontWeight: 500 }}>{PAYMENT_LABELS[method] ?? method}</span>
                          <span style={{ color: '#6B7280' }}>{fmt(revenue)}</span>
                        </div>
                        <div style={{ height: '6px', background: '#F3F4F6', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{ width: `${widthPct}%`, height: '100%', background: '#0F3D2A', borderRadius: '999px', transition: 'width 0.4s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── By employee ── */}
          {data.byEmployee.length > 0 && (
            <div style={card}>
              <p style={sectionLabel}>أداء الموظفين</p>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                    {['الموظف', 'عدد الفواتير', 'إجمالي المبيعات'].map(col => <th key={col} style={TH}>{col}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {data.byEmployee.map((e, i) => (
                    <tr key={e.employeeId} style={{ borderBottom: i < data.byEmployee.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                      <td style={{ ...TD, fontWeight: 500 }}>{e.employeeName || '—'}</td>
                      <td style={{ ...TD, color: '#6B7280' }}>{e.txCount}</td>
                      <td style={{ ...TD, fontWeight: 600 }}>{fmt(e.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Empty state — no data at all */}
      {data && !loading && data.totalTransactions === 0 && (
        <div style={{ ...card, textAlign: 'center', padding: '60px 32px', marginTop: '24px' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
          <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px' }}>لا توجد مبيعات في هذه الفترة</h3>
          <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>ابدأ أولى عمليات البيع من تطبيق POS وستظهر هنا</p>
        </div>
      )}
    </div>
  );
}
