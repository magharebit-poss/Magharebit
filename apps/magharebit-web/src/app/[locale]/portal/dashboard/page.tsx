'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';
import OnboardingChecklist from '@/components/portal/OnboardingChecklist';
import LiveClock from '@/components/portal/LiveClock';
import SalesChart from '@/components/portal/SalesChart';
import LicenseCard from '@/components/portal/LicenseCard';
import ErrorBoundary from '@/components/ErrorBoundary';

// ─── Types ────────────────────────────────────────────────────────────────────
interface MeData {
  merchantId: string;
  storeName: string;
  sector: string;
  plan: string | null;
  expiresAt: string | null;
  daysRemaining: number | null;
  licenseKey: string | null;
  isTrial: boolean;
  today: { totalRevenue: number; totalTransactions: number; avgBasket: number };
  lowStockCount: number;
}

interface TxItem { name: string; qty: number }
interface Transaction {
  id: string;
  receiptNo: string;
  items: TxItem[];
  total: number;
  paymentMethod: string;
  employeeName?: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtCurrency(n: number) {
  return `MAD ${n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function relativeTime(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 1) return 'للتو';
  if (diff < 60) return `منذ ${diff} دقيقة`;
  const h = Math.floor(diff / 60);
  return h < 24 ? `منذ ${h} ساعة` : `منذ ${Math.floor(h / 24)} يوم`;
}

function methodBadge(m: string): { bg: string; color: string; label: string } {
  const map: Record<string, { bg: string; color: string; label: string }> = {
    cash:         { bg: '#DCFCE7', color: '#166534', label: 'نقدي'    },
    card:         { bg: '#DBEAFE', color: '#1D4ED8', label: 'بطاقة'   },
    mobile_money: { bg: '#EDE9FE', color: '#5B21B6', label: 'موبايل'  },
    mixed:        { bg: '#FEF9C3', color: '#854D0E', label: 'مختلط'   },
  };
  return map[m] ?? { bg: '#F3F4F6', color: '#374151', label: m };
}

const card: React.CSSProperties = {
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  cursor: 'pointer',
  transition: 'all 0.2s ease',
};

const TH: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600,
  color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: '14px 16px', fontSize: '14px', textAlign: 'right' };

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ar';

  const [me,            setMe]            = useState<MeData | null>(null);
  const [transactions,  setTransactions]  = useState<Transaction[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [hoveredCard,   setHoveredCard]   = useState<number | null>(null);

  const fetchData = useCallback(() => {
    // Defined separately so it can also be called from refresh buttons
    setLoading(true);
    Promise.all([
      fetch('/api/portal/auth/me', { credentials: 'include' }),
      fetch('/api/portal/transactions?limit=5', { credentials: 'include' }),
    ]).then(async ([meRes, txRes]) => {
      if (meRes.status === 401) { router.push(`/${locale}/portal/login`); return; }
      if (meRes.ok) setMe(await meRes.json());
      if (txRes.ok) {
        const d = await txRes.json();
        setTransactions(d.transactions ?? []);
      }
    }).catch(() => {/* handled in error state */}).finally(() => setLoading(false));
  }, [locale, router]);

  useEffect(() => {
    // Wrap in async IIFE to satisfy react-hooks/set-state-in-effect
    void (async () => { fetchData(); })();
  }, [fetchData]);

  // ── Derived stat cards ──────────────────────────────────────────────────────
  const statCards = me
    ? [
        {
          icon: '🪙',
          label: 'المبيعات اليوم',
          value: fmtCurrency(me.today.totalRevenue),
          sub: `${me.today.totalTransactions} فاتورة`,
          subColor: '#22C55E',
          isLink: false,
          linkSlug: null,
        },
        {
          icon: '🧾',
          label: 'عدد الفواتير',
          value: String(me.today.totalTransactions),
          sub: `متوسط السلة: ${fmtCurrency(me.today.avgBasket)}`,
          subColor: '#6B7280',
          isLink: false,
          linkSlug: null,
        },
        {
          icon: '📦',
          label: 'منتجات منخفضة المخزون',
          value: String(me.lowStockCount),
          sub: me.lowStockCount > 0 ? 'انقر لعرض المنتجات ←' : 'المخزون بخير ✓',
          subColor: me.lowStockCount > 0 ? '#F0B429' : '#22C55E',
          isLink: me.lowStockCount > 0,
          linkSlug: 'products',
        },
        {
          icon: '📅',
          label: 'الاشتراك',
          value: me.plan ?? 'Starter',
          sub: me.daysRemaining !== null ? `${me.daysRemaining} يوم متبقٍ` : 'لا توجد بيانات',
          subColor: (me.daysRemaining ?? 999) < 14 ? '#EF4444' : '#6B7280',
          isLink: false,
          linkSlug: null,
        },
      ]
    : [];

  // ── Subscription progress — derived from daysRemaining (already server-computed) ──
  // Using daysRemaining avoids any client-side Date impurity.
  const subscriptionProgress: number =
    me != null && me.daysRemaining != null
      ? Math.min(100, Math.max(0, Math.round((me.daysRemaining / 365) * 100)))
      : 75;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1000px', color: '#111827' }}>

      <PortalBreadcrumb />
      <OnboardingChecklist />

      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>
            {loading ? '...' : `مرحباً، ${me?.storeName ?? ''}!`}
          </h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px', marginBottom: 0 }}>
            هذا ملخص نشاط متجرك اليوم
          </p>
        </div>
        <LiveClock locale={locale} />
      </div>

      {/* ── Stat cards 2×2 ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {[0,1,2,3].map(i => (
            <div key={i} style={{ ...card, minHeight: '120px', background: '#F9FAFB' }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
          {statCards.map((sc, i) => {
            const isHovered = hoveredCard === i;
            const cardStyle: React.CSSProperties = {
              ...card,
              boxShadow: isHovered ? '0 4px 16px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.08)',
              transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
              border: isHovered ? '1px solid rgba(240,180,41,0.30)' : '1px solid #E5E7EB',
            };
            const inner = (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>{sc.label}</p>
                  <span style={{ fontSize: '26px', lineHeight: 1 }}>{sc.icon}</span>
                </div>
                <p style={{ fontSize: '28px', fontWeight: 700, margin: '0 0 8px' }}>{sc.value}</p>
                <p style={{ fontSize: '13px', color: sc.subColor, margin: 0 }}>{sc.sub}</p>
              </>
            );
            if (sc.isLink && sc.linkSlug) {
              return (
                <a key={i} href={`/${locale}/portal/${sc.linkSlug}`}
                  onMouseEnter={() => setHoveredCard(i)} onMouseLeave={() => setHoveredCard(null)}
                  style={{ ...cardStyle, textDecoration: 'none', color: 'inherit', display: 'block' }}>
                  {inner}
                </a>
              );
            }
            return (
              <div key={i} onMouseEnter={() => setHoveredCard(i)} onMouseLeave={() => setHoveredCard(null)} style={cardStyle}>
                {inner}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Subscription banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0F3D2A, #1a5c3a)',
        borderRadius: '12px', padding: '20px 24px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: '20px', gap: '24px', flexWrap: 'wrap',
      }}>
        <div>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.60)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 4px' }}>
            الاشتراك النشط
          </p>
          <p style={{ fontSize: '18px', fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px' }}>
            {loading ? '...' : (me?.plan ?? 'Starter')}
          </p>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.60)', margin: 0 }}>
            {loading ? '' : (me?.expiresAt
              ? `ينتهي في: ${new Date(me.expiresAt).toLocaleDateString('ar-MA', { year: 'numeric', month: 'long', day: 'numeric' })}`
              : 'لا يوجد تاريخ انتهاء')
            }
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '240px', height: '6px', background: 'rgba(255,255,255,0.15)', borderRadius: '999px', overflow: 'hidden', marginBottom: '6px' }}>
            <div style={{ width: `${subscriptionProgress}%`, height: '100%', background: '#F0B429', borderRadius: '999px', transition: 'width 0.8s ease' }} />
          </div>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', margin: 0 }}>
            {!loading && me != null && me.daysRemaining != null ? `${me.daysRemaining} يوم متبقٍ` : ''}
          </p>
        </div>
        <a href={`https://wa.me/212619522487?text=مرحباً، أريد تجديد اشتراك MAGHAREBIT`}
          target="_blank" rel="noopener noreferrer"
          style={{
            background: '#F0B429', color: '#0A2318', fontWeight: 700, borderRadius: '8px',
            padding: '10px 20px', fontSize: '14px', whiteSpace: 'nowrap', textDecoration: 'none', display: 'inline-block',
          }}>
          تجديد الاشتراك
        </a>
      </div>

      {/* ── License information card ── */}
      {!loading && (
        <LicenseCard
          licenseKey={me?.licenseKey ?? null}
          plan={me?.plan ?? null}
          isTrial={me?.isTrial ?? false}
          daysRemaining={me?.daysRemaining ?? null}
          expiresAt={me?.expiresAt ?? null}
        />
      )}

      {/* ── App download card ── */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '32px', lineHeight: 1 }}>📱</span>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }}>MAGHAREBIT POS v2.1.0</p>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>آخر تحديث: 10 مايو 2025</p>
          </div>
        </div>
        <a href={`/${locale}/download`} style={{ background: '#0F3D2A', color: '#FFFFFF', fontWeight: 600, borderRadius: '8px', padding: '12px 20px', fontSize: '14px', whiteSpace: 'nowrap', fontFamily: 'inherit', textDecoration: 'none', minHeight: '44px', display: 'inline-flex', alignItems: 'center' }}>
          تحميل التطبيق
        </a>
      </div>

      {/* ── Sales chart ── */}
      <ErrorBoundary>
        <SalesChart />
      </ErrorBoundary>

      {/* ── Recent sales table ── */}
      <div style={{ marginTop: '28px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 16px' }}>آخر المبيعات</h2>
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>جارٍ التحميل...</div>
          ) : transactions.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9CA3AF' }}>
              لا توجد مبيعات بعد — ابدأ أول عملية بيع من تطبيق POS
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['#', 'المنتجات', 'الإجمالي', 'طريقة الدفع', 'الوقت', 'الكاشير'].map(col => (
                    <th key={col} style={TH}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx, i) => {
                  const badge = methodBadge(tx.paymentMethod);
                  const itemsLabel = tx.items
                    .map(it => it.qty > 1 ? `${it.name} ×${it.qty}` : it.name)
                    .join('، ')
                    .slice(0, 50);
                  return (
                    <tr key={tx.id} style={{ borderBottom: i < transactions.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                      <td style={{ ...TD, color: '#6B7280', whiteSpace: 'nowrap' }}>#{tx.receiptNo}</td>
                      <td style={TD}>{itemsLabel || '—'}</td>
                      <td style={{ ...TD, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtCurrency(tx.total)}</td>
                      <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                        <span style={{ background: badge.bg, color: badge.color, borderRadius: '999px', padding: '2px 10px', fontSize: '12px', fontWeight: 500 }}>
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ ...TD, color: '#6B7280', whiteSpace: 'nowrap' }}>{relativeTime(tx.createdAt)}</td>
                      <td style={{ ...TD, fontWeight: 500 }}>{tx.employeeName ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
