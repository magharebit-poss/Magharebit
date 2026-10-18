'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  id:             string;
  name:           string;
  phone:          string;
  email?:         string;
  totalSpent:     number;
  visitCount:     number;
  loyaltyPoints:  number;
  lastVisitAt?:   string;
  notes?:         string;
  isActive:       boolean;
}

interface TxRow {
  id:            string;
  receiptNo:     string;
  total:         number;
  paymentMethod: string;
  createdAt:     string;
  items:         { name: string; qty: number }[];
}

// ─── Loyalty helpers ──────────────────────────────────────────────────────────
function getTier(pts: number): 'bronze' | 'silver' | 'gold' {
  if (pts >= 2000) return 'gold';
  if (pts >= 500)  return 'silver';
  return 'bronze';
}

const TIER_META = {
  gold:   { emoji: '🥇', label: 'ذهبي',   color: '#854D0E', bg: '#FEF9C3', border: '#FDE68A' },
  silver: { emoji: '🥈', label: 'فضي',    color: '#374151', bg: '#F1F5F9', border: '#CBD5E1' },
  bronze: { emoji: '🥉', label: 'برونزي', color: '#92400E', bg: '#FEF3C7', border: '#FDE68A' },
} as const;

function tierProgress(pts: number): { pct: number; label: string } {
  if (pts >= 2000) return { pct: 100, label: 'أعلى مستوى 🏆' };
  if (pts >= 500)  return { pct: Math.round(((pts - 500) / 1500) * 100), label: `${2000 - pts} نقطة للذهبي` };
  return { pct: Math.round((pts / 500) * 100), label: `${500 - pts} نقطة للفضي` };
}

// ─── Format helpers ───────────────────────────────────────────────────────────
function fmtMAD(n: number) {
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.م';
}

function fmtPhone(digits: string) {
  if (digits.length === 12 && digits.startsWith('212')) {
    return `+212 ${digits[3]} ${digits.slice(4, 7)} ${digits.slice(7, 9)} ${digits.slice(9)}`;
  }
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
  }
  return digits;
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-MA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

function fmtDateTime(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-MA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'نقدي', card: 'بطاقة', mobile_money: 'موبايل', mixed: 'مختلط',
};

// ─── Shared styles ────────────────────────────────────────────────────────────
const INPUT: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px',
  fontSize: '14px', fontFamily: 'inherit', color: '#111827', background: '#FFFFFF',
  outline: 'none', direction: 'rtl', boxSizing: 'border-box',
};
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px',
};
const TH: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600,
  color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: '14px 16px', fontSize: '14px', textAlign: 'right' };

// ─── Tier badge component ─────────────────────────────────────────────────────
function TierBadge({ points }: { points: number }) {
  const tier = getTier(points);
  const meta = TIER_META[tier];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`,
      borderRadius: '999px', padding: '2px 10px', fontSize: '12px', fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {meta.emoji} {meta.label}
    </span>
  );
}

// ─── Overlay modal wrapper ────────────────────────────────────────────────────
function Modal({ onClose, width = 520, children }: {
  onClose: () => void; width?: number; children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: `${width}px`,
        maxHeight: '90vh', overflowY: 'auto', direction: 'rtl',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) ?? 'ar';

  // ── List state ────────────────────────────────────────────────────────────
  const [customers,  setCustomers]  = useState<Customer[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const LIMIT = 20;

  // ── Add modal state ───────────────────────────────────────────────────────
  const [addOpen,    setAddOpen]    = useState(false);
  const [fName,      setFName]      = useState('');
  const [fPhone,     setFPhone]     = useState('');
  const [fEmail,     setFEmail]     = useState('');
  const [fNotes,     setFNotes]     = useState('');
  const [fSaving,    setFSaving]    = useState(false);
  const [fError,     setFError]     = useState('');

  // ── Detail modal state ────────────────────────────────────────────────────
  const [selected,   setSelected]   = useState<Customer | null>(null);
  const [txns,       setTxns]       = useState<TxRow[]>([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [editNotes,  setEditNotes]  = useState('');
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved,  setNotesSaved]  = useState(false);

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast]         = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function showToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }

  // ── Fetch list ────────────────────────────────────────────────────────────
  const fetchCustomers = useCallback((q: string, pg: number) => {
    setLoading(true);
    const qs = new URLSearchParams({
      page:  String(pg),
      limit: String(LIMIT),
      ...(q ? { search: q } : {}),
    });
    fetch(`/api/portal/customers?${qs}`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) { router.push(`/${locale}/portal/login`); return; }
        if (!res.ok) return;
        const data = await res.json() as { customers: Customer[]; total: number };
        setCustomers(data.customers ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => { /* silently fail — list stays empty */ })
      .finally(() => setLoading(false));
  }, [locale, router]);

  useEffect(() => {
    void (async () => { fetchCustomers(search, page); })();
  }, [fetchCustomers, search, page]);

  // Debounce search
  function handleSearchChange(val: string) {
    setSearch(val);
    setPage(1);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => fetchCustomers(val, 1), 300);
  }

  // ── Fetch customer transactions ───────────────────────────────────────────
  const fetchTxns = useCallback((customerId: string) => {
    setTxnLoading(true);
    setTxns([]);
    fetch(`/api/portal/customers/${customerId}/transactions?limit=20`, { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as { transactions: TxRow[] };
        setTxns(data.transactions ?? []);
      })
      .catch(() => { /* empty state */ })
      .finally(() => setTxnLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    void (async () => { fetchTxns(selected.id); })();
  }, [selected, fetchTxns]);

  // ── Open detail ───────────────────────────────────────────────────────────
  function openDetail(c: Customer) {
    setSelected(c);
    setEditNotes(c.notes ?? '');
    setNotesSaved(false);
  }

  // ── Add customer ──────────────────────────────────────────────────────────
  function handleAdd() {
    setFError('');
    if (!fName.trim())  { setFError('الاسم مطلوب');        return; }
    if (!fPhone.trim()) { setFError('رقم الهاتف مطلوب');   return; }
    setFSaving(true);
    fetch('/api/portal/customers', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: fName.trim(), phone: fPhone.trim(), email: fEmail.trim() || undefined, notes: fNotes.trim() || undefined }),
    })
      .then(async (res) => {
        const d = await res.json() as { customer?: Customer; error?: string };
        if (!res.ok) {
          const errMap: Record<string, string> = {
            phone_already_exists: 'رقم الهاتف مسجل مسبقاً',
            phone_too_short:      'رقم الهاتف قصير جداً',
            phone_required:       'رقم الهاتف مطلوب',
            name_required:        'الاسم مطلوب',
            email_invalid:        'البريد الإلكتروني غير صحيح',
          };
          setFError(errMap[d.error ?? ''] ?? 'فشل الإضافة');
          return;
        }
        setAddOpen(false);
        setFName(''); setFPhone(''); setFEmail(''); setFNotes('');
        showToast('✓ تمت إضافة العميل');
        fetchCustomers(search, 1);
        setPage(1);
      })
      .catch(() => setFError('فشل الاتصال'))
      .finally(() => setFSaving(false));
  }

  // ── Save notes ────────────────────────────────────────────────────────────
  function handleSaveNotes() {
    if (!selected) return;
    setNotesSaving(true);
    fetch(`/api/portal/customers/${selected.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: editNotes }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const d = await res.json() as { customer?: Customer };
        if (d.customer) {
          setSelected(d.customer);
          setCustomers(cs => cs.map(c => c.id === d.customer!.id ? d.customer! : c));
        }
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2500);
      })
      .catch(() => { /* ignore */ })
      .finally(() => setNotesSaving(false));
  }

  // ── Computed for detail modal ─────────────────────────────────────────────
  const avgBasket: number =
    selected != null && selected.visitCount > 0
      ? Math.round((selected.totalSpent / selected.visitCount) * 100) / 100
      : 0;

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div style={{ maxWidth: '1100px', color: '#111827' }}>
      <PortalBreadcrumb current="العملاء" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>العملاء</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px', marginBottom: 0 }}>
            {total > 0 ? `${total} عميل مسجل` : 'سجّل عملاءك وتتبع ولاءهم'}
          </p>
        </div>
        <button
          onClick={() => { setAddOpen(true); setFError(''); }}
          style={{
            background: '#0F3D2A', color: '#FFFFFF', border: 'none', borderRadius: '8px',
            padding: '10px 20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          + إضافة عميل
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px', maxWidth: '360px' }}>
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="ابحث بالاسم أو رقم الهاتف…"
          style={{ ...INPUT, paddingRight: '14px' }}
        />
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
            <tr>
              <th style={TH}>العميل</th>
              <th style={TH}>الهاتف</th>
              <th style={TH}>المستوى</th>
              <th style={{ ...TH, textAlign: 'center' }}>النقاط</th>
              <th style={TH}>إجمالي الإنفاق</th>
              <th style={TH}>آخر زيارة</th>
              <th style={{ ...TH, width: '80px' }}></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ ...TD, textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>
                  جاري التحميل…
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...TD, textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>
                  {search ? 'لا توجد نتائج' : 'لا يوجد عملاء حتى الآن — ابدأ بإضافة أول عميل'}
                </td>
              </tr>
            ) : (
              customers.map((c, i) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: i < customers.length - 1 ? '1px solid #F3F4F6' : 'none' }}
                >
                  <td style={TD}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: '#F0F9F4', border: '1px solid #D1FAE5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '13px', fontWeight: 700, color: '#0F3D2A', flexShrink: 0,
                      }}>
                        {c.name.charAt(0)}
                      </div>
                      <span style={{ fontWeight: 500 }}>{c.name}</span>
                    </div>
                  </td>
                  <td style={{ ...TD, fontFamily: 'Inter, monospace', fontSize: '13px', direction: 'ltr', textAlign: 'right' }}>
                    {fmtPhone(c.phone)}
                  </td>
                  <td style={TD}><TierBadge points={c.loyaltyPoints} /></td>
                  <td style={{ ...TD, textAlign: 'center', fontWeight: 600, color: '#0F3D2A' }}>
                    {c.loyaltyPoints.toLocaleString('fr-MA')}
                  </td>
                  <td style={{ ...TD, fontWeight: 600 }}>{fmtMAD(c.totalSpent)}</td>
                  <td style={{ ...TD, color: '#6B7280', fontSize: '13px' }}>{fmtDate(c.lastVisitAt)}</td>
                  <td style={TD}>
                    <button
                      onClick={() => openDetail(c)}
                      style={{
                        background: 'none', border: '1px solid #E5E7EB', borderRadius: '6px',
                        padding: '5px 12px', fontSize: '12px', cursor: 'pointer',
                        color: '#374151', fontFamily: 'inherit',
                      }}
                    >
                      عرض
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#FFFFFF', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1, fontFamily: 'inherit' }}
          >
            ‹ السابق
          </button>
          <span style={{ fontSize: '14px', color: '#6B7280' }}>{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', background: '#FFFFFF', cursor: page >= totalPages ? 'not-allowed' : 'pointer', opacity: page >= totalPages ? 0.5 : 1, fontFamily: 'inherit' }}
          >
            التالي ›
          </button>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)',
          background: '#0F3D2A', color: '#FFFFFF', borderRadius: '8px',
          padding: '12px 24px', fontSize: '14px', fontWeight: 600, zIndex: 2000,
          boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
        }}>
          {toast}
        </div>
      )}

      {/* ── Add Customer Modal ──────────────────────────────────────────────── */}
      {addOpen && (
        <Modal onClose={() => setAddOpen(false)}>
          <div style={{ padding: '28px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>إضافة عميل جديد</h2>
              <button onClick={() => setAddOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9CA3AF', lineHeight: 1 }}>✕</button>
            </div>

            {fError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#DC2626' }}>
                {fError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={LABEL}>الاسم <span style={{ color: '#EF4444' }}>*</span></label>
                <input type="text" value={fName} onChange={e => setFName(e.target.value)} placeholder="محمد العلوي" style={INPUT} />
              </div>
              <div>
                <label style={LABEL}>رقم الهاتف <span style={{ color: '#EF4444' }}>*</span></label>
                <input type="tel" value={fPhone} onChange={e => setFPhone(e.target.value)} placeholder="0612345678" style={{ ...INPUT, direction: 'ltr', textAlign: 'right' }} />
              </div>
              <div>
                <label style={LABEL}>البريد الإلكتروني (اختياري)</label>
                <input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="client@example.com" style={{ ...INPUT, direction: 'ltr', textAlign: 'right' }} />
              </div>
              <div>
                <label style={LABEL}>ملاحظات (اختياري)</label>
                <input type="text" value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="عميل VIP، حساس للجلوتين…" style={INPUT} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '28px' }}>
              <button
                onClick={handleAdd}
                disabled={fSaving}
                style={{ flex: 1, background: '#0F3D2A', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 700, cursor: fSaving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: fSaving ? 0.7 : 1 }}
              >
                {fSaving ? '…' : 'إضافة'}
              </button>
              <button
                onClick={() => setAddOpen(false)}
                style={{ flex: 1, background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Customer Detail Modal ───────────────────────────────────────────── */}
      {selected != null && (
        <Modal onClose={() => setSelected(null)} width={700}>
          <div style={{ padding: '28px 32px' }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '52px', height: '52px', borderRadius: '50%',
                  background: '#F0F9F4', border: '2px solid #D1FAE5',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '20px', fontWeight: 700, color: '#0F3D2A', flexShrink: 0,
                }}>
                  {selected.name.charAt(0)}
                </div>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 4px' }}>{selected.name}</h2>
                  <p style={{ margin: 0, fontSize: '14px', color: '#6B7280', fontFamily: 'Inter, monospace', direction: 'ltr', textAlign: 'right' }}>
                    {fmtPhone(selected.phone)}
                    {selected.email ? ` · ${selected.email}` : ''}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <TierBadge points={selected.loyaltyPoints} />
                <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9CA3AF', lineHeight: 1 }}>✕</button>
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
              {[
                { label: 'إجمالي الإنفاق', value: fmtMAD(selected.totalSpent), color: '#0F3D2A' },
                { label: 'عدد الزيارات',   value: String(selected.visitCount), color: '#1D4ED8' },
                { label: 'متوسط السلة',    value: fmtMAD(avgBasket),            color: '#854D0E' },
                { label: 'نقاط الولاء',    value: selected.loyaltyPoints.toLocaleString('fr-MA'), color: '#7C3AED' },
              ].map(s => (
                <div key={s.label} style={{ background: '#F9FAFB', borderRadius: '10px', padding: '14px', textAlign: 'center', border: '1px solid #F3F4F6' }}>
                  <p style={{ fontSize: '11px', color: '#6B7280', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: s.color, margin: 0 }}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Loyalty progress */}
            {(() => {
              const prog = tierProgress(selected.loyaltyPoints);
              const tier = getTier(selected.loyaltyPoints);
              const meta = TIER_META[tier];
              return (
                <div style={{ background: meta.bg, borderRadius: '10px', padding: '14px 16px', marginBottom: '20px', border: `1px solid ${meta.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: meta.color }}>{meta.emoji} {meta.label}</span>
                    <span style={{ fontSize: '12px', color: meta.color }}>{prog.label}</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(0,0,0,0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ width: `${prog.pct}%`, height: '100%', background: meta.color, borderRadius: '999px', transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })()}

            {/* Last visit */}
            <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '20px' }}>
              آخر زيارة: <strong style={{ color: '#374151' }}>{fmtDate(selected.lastVisitAt)}</strong>
            </p>

            {/* Notes */}
            <div style={{ marginBottom: '24px' }}>
              <label style={LABEL}>ملاحظات</label>
              <textarea
                value={editNotes}
                onChange={e => setEditNotes(e.target.value)}
                rows={2}
                placeholder="ملاحظات حول العميل…"
                style={{ ...INPUT, resize: 'vertical', minHeight: '64px' }}
              />
              <button
                onClick={handleSaveNotes}
                disabled={notesSaving}
                style={{
                  marginTop: '8px', background: notesSaved ? '#22C55E' : '#0F3D2A',
                  color: '#FFFFFF', border: 'none', borderRadius: '8px',
                  padding: '8px 20px', fontSize: '13px', fontWeight: 700,
                  cursor: notesSaving ? 'wait' : 'pointer', fontFamily: 'inherit',
                  transition: 'background 0.2s ease',
                }}
              >
                {notesSaving ? '…' : notesSaved ? '✓ تم الحفظ' : 'حفظ الملاحظات'}
              </button>
            </div>

            {/* Transaction history */}
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 12px', color: '#111827' }}>
                سجل المشتريات
              </h3>
              {txnLoading ? (
                <p style={{ color: '#9CA3AF', fontSize: '13px' }}>جاري التحميل…</p>
              ) : txns.length === 0 ? (
                <p style={{ color: '#9CA3AF', fontSize: '13px' }}>لا توجد معاملات مسجلة بعد</p>
              ) : (
                <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                      <tr>
                        <th style={{ ...TH, fontSize: '11px' }}>رقم الفاتورة</th>
                        <th style={{ ...TH, fontSize: '11px' }}>المنتجات</th>
                        <th style={{ ...TH, fontSize: '11px' }}>طريقة الدفع</th>
                        <th style={{ ...TH, fontSize: '11px' }}>المبلغ</th>
                        <th style={{ ...TH, fontSize: '11px' }}>التاريخ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {txns.map((t, i) => (
                        <tr key={t.id} style={{ borderBottom: i < txns.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                          <td style={{ ...TD, fontSize: '13px', fontFamily: 'Inter, monospace', color: '#6B7280' }}>
                            {t.receiptNo}
                          </td>
                          <td style={{ ...TD, fontSize: '12px', color: '#374151' }}>
                            {Array.isArray(t.items) && t.items.length > 0
                              ? t.items.slice(0, 2).map(i => i.name).join('، ')
                                + (t.items.length > 2 ? ` +${t.items.length - 2}` : '')
                              : '—'}
                          </td>
                          <td style={{ ...TD, fontSize: '12px' }}>
                            {METHOD_LABELS[t.paymentMethod] ?? t.paymentMethod}
                          </td>
                          <td style={{ ...TD, fontWeight: 700, color: '#0F3D2A', fontSize: '13px' }}>
                            {fmtMAD(t.total)}
                          </td>
                          <td style={{ ...TD, fontSize: '12px', color: '#6B7280' }}>
                            {fmtDateTime(t.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
