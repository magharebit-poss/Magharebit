// SECURITY NOTICE:
// The current admin gate uses a client-side localStorage password check + server-side x-admin-secret header.
// This is acceptable for current scale but MUST be replaced with proper auth (NextAuth, Clerk, or custom JWT)
// before any production deployment with real merchant data.
// Tracked in DEPLOY.md → "Pre-launch backend integration TODOs"

'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/brand/Logo';

type LicenseStatus = 'active' | 'expired' | 'suspended';

interface License {
  id: string;
  key: string;
  store: string;
  status: LicenseStatus;
  plan: string;
  activatedAt: string;
  expiresAt: string;
}

const STATUS_LABELS: Record<LicenseStatus, string> = {
  active:    'نشط',
  expired:   'منتهي',
  suspended: 'معلّق',
};

const STATUS_COLORS: Record<LicenseStatus, { bg: string; text: string }> = {
  active:    { bg: '#DCFCE7', text: '#166534' },
  expired:   { bg: '#FEE2E2', text: '#991B1B' },
  suspended: { bg: '#FEF3C7', text: '#92400E' },
};

function maskKey(key: string): string {
  const parts = key.split('-');
  if (parts.length !== 3) return key;
  return `${parts[0]}-••••••••-${parts[2]}`;
}

export default function AdminLicensesPage() {
  const pathname = usePathname();
  const locale = pathname.split('/')[1] ?? 'ar';

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [licenses, setLicenses] = useState<License[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [search, setSearch] = useState('');
  const [revealedId, setRevealedId] = useState<string | null>(null);

  // New license modal
  const [showModal, setShowModal] = useState(false);
  const [newStore, setNewStore] = useState('');
  const [newPlan, setNewPlan] = useState('Starter');
  const [creating, setCreating] = useState(false);
  const [createToast, setCreateToast] = useState(false);

  const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? '';

  const fetchLicenses = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await fetch('/api/licenses', {
        headers: { 'x-admin-secret': adminPassword },
      });
      if (!res.ok) { setFetchError('خطأ في الاتصال بالخادم'); return; }
      const data = await res.json();
      setLicenses(data.licenses ?? []);
    } catch {
      setFetchError('تعذّر تحميل البيانات');
    } finally {
      setLoading(false);
    }
  }, [adminPassword]);

  // Close modal on Escape
  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  // Auto-hide toast
  useEffect(() => {
    if (!createToast) return;
    const id = setTimeout(() => setCreateToast(false), 3000);
    return () => clearTimeout(id);
  }, [createToast]);

  const login = () => {
    if (password === adminPassword) {
      setAuthenticated(true);
      setAuthError('');
      fetchLicenses();
    } else {
      setAuthError('كلمة المرور غير صحيحة');
    }
  };

  const createLicense = async () => {
    if (!newStore.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/licenses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-secret': adminPassword,
        },
        body: JSON.stringify({ store: newStore, plan: newPlan }),
      });
      if (res.ok) {
        const data = await res.json();
        setLicenses((prev) => [...prev, data.license]);
        setShowModal(false);
        setNewStore('');
        setNewPlan('Starter');
        setCreateToast(true);
      }
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  const stats = {
    total: licenses.length,
    active: licenses.filter((l) => l.status === 'active').length,
    expired: licenses.filter((l) => l.status === 'expired').length,
  };

  const filtered = search.trim()
    ? licenses.filter(
        (l) =>
          l.store.toLowerCase().includes(search.toLowerCase()) ||
          l.key.toLowerCase().includes(search.toLowerCase())
      )
    : licenses;

  // ── Password gate ────────────────────────────────────────────────────────────
  if (!authenticated) {
    return (
      <main
        style={{
          minHeight: '100vh',
          background: '#F8F9FA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '16px',
            padding: '40px 36px',
            width: '100%',
            maxWidth: '360px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            direction: 'rtl',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px', justifyContent: 'center' }}>
            <Logo height={28} on="light" variant="horizontal" />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', textAlign: 'center', margin: '0 0 24px' }}>
            إدارة التراخيص
          </h1>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
            كلمة المرور
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
            placeholder="••••••••"
            style={{
              width: '100%', padding: '10px 14px',
              border: authError ? '1px solid #EF4444' : '1px solid #D1D5DB',
              borderRadius: '8px', fontSize: '15px', outline: 'none',
              marginBottom: '8px', boxSizing: 'border-box',
            }}
          />
          {authError && (
            <p style={{ fontSize: '13px', color: '#EF4444', margin: '0 0 12px' }}>{authError}</p>
          )}
          <button
            onClick={login}
            style={{
              width: '100%', background: '#0F3D2A', color: '#FFFFFF', border: 'none',
              borderRadius: '8px', padding: '11px', fontSize: '15px', fontWeight: 700,
              cursor: 'pointer', marginTop: authError ? '0' : '8px',
            }}
          >
            دخول
          </button>
        </div>
      </main>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  return (
    <main style={{ minHeight: '100vh', background: '#F8F9FA', padding: '32px 24px', direction: 'rtl' }}>

      {/* New license modal */}
      {showModal && (
        <>
          <div
            onClick={() => setShowModal(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 40 }}
          />
          <div
            style={{
              position: 'fixed', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              background: '#FFFFFF', borderRadius: '16px', padding: '32px',
              width: '420px', maxWidth: 'calc(100vw - 32px)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.20)', zIndex: 50, direction: 'rtl',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>إنشاء مفتاح جديد</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '20px', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  اسم المتجر *
                </label>
                <input
                  type="text"
                  value={newStore}
                  onChange={(e) => setNewStore(e.target.value)}
                  placeholder="مثال: بقالة الأمين"
                  style={{
                    width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB',
                    borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit',
                    direction: 'rtl', boxSizing: 'border-box', outline: 'none',
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  الخطة
                </label>
                <select
                  value={newPlan}
                  onChange={(e) => setNewPlan(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB',
                    borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit',
                    direction: 'rtl', boxSizing: 'border-box', outline: 'none', cursor: 'pointer',
                  }}
                >
                  <option value="Starter">Starter — 249 درهم/شهر</option>
                  <option value="Business">Business — 499 درهم/شهر</option>
                  <option value="Enterprise">Enterprise — مخصص</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={createLicense}
                disabled={creating || !newStore.trim()}
                style={{
                  flex: 1, background: creating || !newStore.trim() ? '#9CA3AF' : '#0F3D2A',
                  color: '#FFFFFF', border: 'none', borderRadius: '8px',
                  padding: '10px', fontSize: '14px', fontWeight: 700,
                  cursor: creating || !newStore.trim() ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {creating ? 'جارٍ الإنشاء...' : '🔑 إنشاء المفتاح'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1, background: '#FFFFFF', color: '#374151', border: '1px solid #E5E7EB',
                  borderRadius: '8px', padding: '10px', fontSize: '14px', fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </>
      )}

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>

        {/* Tab navigation */}
        <div
          style={{
            display: 'flex', gap: '4px', background: '#E5E7EB',
            borderRadius: '10px', padding: '4px', marginBottom: '28px',
            width: 'fit-content',
          }}
        >
          <Link
            href={`/${locale}/admin/leads`}
            style={{
              padding: '8px 20px', borderRadius: '8px', fontWeight: 600,
              fontSize: '14px', color: '#6B7280', textDecoration: 'none',
            }}
          >
            العملاء المحتملون
          </Link>
          <span
            style={{
              padding: '8px 20px', borderRadius: '8px', fontWeight: 700,
              fontSize: '14px', background: '#FFFFFF',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)', color: '#111827',
            }}
          >
            التراخيص
          </span>
          <Link
            href={`/${locale}/admin/merchants`}
            style={{
              padding: '8px 20px', borderRadius: '8px', fontWeight: 600,
              fontSize: '14px', color: '#6B7280', textDecoration: 'none',
            }}
          >
            المشتركون
          </Link>
        </div>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
              التراخيص
            </h1>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: 0 }}>
              {licenses.length} ترخيص مُصدَر
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={fetchLicenses}
              style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}
            >
              تحديث
            </button>
            <button
              onClick={() => { setNewStore(''); setNewPlan('Starter'); setShowModal(true); }}
              style={{ background: '#F0B429', color: '#0A2318', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              + إنشاء مفتاح
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          {[
            { label: 'إجمالي التراخيص', value: stats.total, icon: '🔑', color: '#1D4ED8', bg: '#DBEAFE' },
            { label: 'نشطة', value: stats.active, icon: '✅', color: '#166534', bg: '#DCFCE7' },
            { label: 'منتهية', value: stats.expired, icon: '⏰', color: '#991B1B', bg: '#FEE2E2' },
          ].map((card) => (
            <div
              key={card.label}
              style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ width: '36px', height: '36px', borderRadius: '8px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>
                  {card.icon}
                </span>
                <span style={{ fontSize: '12px', color: '#6B7280', fontWeight: 500 }}>{card.label}</span>
              </div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        <div style={{ marginBottom: '20px' }}>
          <input
            type="text"
            placeholder="🔍  بحث بالمتجر أو المفتاح..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%', maxWidth: '400px', padding: '9px 14px',
              border: '1px solid #D1D5DB', borderRadius: '8px',
              fontSize: '14px', outline: 'none', background: '#FFFFFF',
              direction: 'rtl', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Error */}
        {fetchError && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', color: '#991B1B', fontSize: '14px' }}>
            {fetchError}
          </div>
        )}

        {/* Table */}
        <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'auto', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '15px' }}>
              جاري التحميل...
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF', fontSize: '15px' }}>
              {licenses.length === 0 ? 'لا توجد تراخيص بعد' : 'لا توجد نتائج مطابقة'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '650px' }}>
              <thead>
                <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  {['#', 'المتجر', 'المفتاح', 'الخطة', 'الحالة', 'الانتهاء', ''].map((col, i) => (
                    <th
                      key={i}
                      style={{ padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lic, i) => (
                  <tr key={lic.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#9CA3AF', fontFamily: 'Inter, monospace' }}>
                      {lic.id}
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '14px', fontWeight: 600, color: '#111827' }}>
                      {lic.store}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                        <code
                          style={{
                            fontSize: '12px',
                            fontFamily: 'Inter, monospace',
                            color: '#374151',
                            background: '#F3F4F6',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            direction: 'ltr',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {revealedId === lic.id ? lic.key : maskKey(lic.key)}
                        </code>
                        <button
                          onClick={() => setRevealedId(revealedId === lic.id ? null : lic.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#9CA3AF', padding: '2px', lineHeight: 1 }}
                          title={revealedId === lic.id ? 'إخفاء' : 'إظهار'}
                        >
                          {revealedId === lic.id ? '🙈' : '👁️'}
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
                      {lic.plan}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span
                        style={{
                          background: STATUS_COLORS[lic.status].bg,
                          color: STATUS_COLORS[lic.status].text,
                          fontSize: '12px', fontWeight: 600,
                          padding: '3px 10px', borderRadius: '999px',
                        }}
                      >
                        {STATUS_LABELS[lic.status]}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', fontSize: '12px', color: '#9CA3AF', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'right' }}>
                      {new Date(lic.expiresAt).toLocaleDateString('ar-MA')}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <button
                        onClick={() => {
                          void navigator.clipboard.writeText(lic.key);
                        }}
                        title="نسخ المفتاح"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#9CA3AF', padding: '2px' }}
                      >
                        📋
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create toast */}
      {createToast && (
        <div
          style={{
            position: 'fixed', bottom: '24px', left: '24px',
            background: '#0F3D2A', color: '#FFFFFF',
            borderRadius: '8px', padding: '12px 20px',
            fontSize: '14px', fontFamily: 'inherit', fontWeight: 500,
            zIndex: 60, boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            display: 'flex', alignItems: 'center', gap: '8px',
          }}
        >
          <span style={{ color: '#22C55E', fontSize: '16px' }}>✓</span>
          تم إنشاء مفتاح الترخيص بنجاح
        </div>
      )}
    </main>
  );
}
