'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  id:       string;
  name:     string;
  phone?:   string;
  email?:   string;
  address?: string;
  notes?:   string;
  isActive: boolean;
}

type OrderStatus = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';

interface OrderItem {
  productId:   string;
  productName: string;
  productPlu?: string;
  qtyOrdered:  number;
  qtyReceived: number;
  unitCost:    number;
}

interface PurchaseOrder {
  id:           string;
  supplierId:   string;
  supplierName: string;
  status:       OrderStatus;
  items:        OrderItem[];
  totalCost:    number;
  notes?:       string;
  expectedAt?:  string;
  createdAt:    string;
  updatedAt:    string;
}

interface Product {
  id:   string;
  name: string;
  plu:  string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMAD(n: number) {
  return n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' د.م';
}

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-MA', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
}

const STATUS_META: Record<OrderStatus, { label: string; color: string; bg: string; border: string }> = {
  draft:     { label: 'مسودة',     color: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  ordered:   { label: 'مُرسَل',   color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  partial:   { label: 'جزئي',     color: '#854D0E', bg: '#FEF3C7', border: '#FDE68A' },
  received:  { label: 'مُستلَم',  color: '#065F46', bg: '#D1FAE5', border: '#A7F3D0' },
  cancelled: { label: 'ملغى',     color: '#991B1B', bg: '#FEF2F2', border: '#FECACA' },
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '9px 14px', border: '1px solid #D1D5DB', borderRadius: '8px',
  fontSize: '14px', fontFamily: 'inherit', color: '#111827', background: '#FFFFFF',
  outline: 'none', direction: 'rtl', boxSizing: 'border-box',
};
const LABEL: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '5px',
};
const TH: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'right', fontSize: '11px', fontWeight: 700,
  color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: '13px 14px', fontSize: '14px', textAlign: 'right' };

function StatusBadge({ status }: { status: OrderStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: '999px', fontSize: '12px',
      fontWeight: 600, color: m.color, background: m.bg, border: `1px solid ${m.border}`,
      whiteSpace: 'nowrap',
    }}>
      {m.label}
    </span>
  );
}

function Modal({ onClose, width = 540, children }: {
  onClose: () => void; width?: number; children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: `${width}px`,
        maxHeight: '92vh', overflowY: 'auto', direction: 'rtl',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }}>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PurchasesPage() {
  const router  = useRouter();
  const params  = useParams();
  const locale  = (params?.locale as string) ?? 'ar';

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'orders' | 'suppliers'>('orders');

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast]     = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function showToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }

  // ═══ SUPPLIERS ═══════════════════════════════════════════════════════════

  const [suppliers,  setSuppliers]  = useState<Supplier[]>([]);
  const [suppTotal,  setSuppTotal]  = useState(0);
  const [suppLoading, setSuppLoading] = useState(false);
  const [suppSearch, setSuppSearch] = useState('');
  const suppTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Add/edit supplier modal
  const [suppModal,  setSuppModal]  = useState(false);
  const [editSupp,   setEditSupp]   = useState<Supplier | null>(null);
  const [sName,  setSName]  = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sAddr,  setSAddr]  = useState('');
  const [sNotes, setSNotes] = useState('');
  const [sSaving, setSSaving] = useState(false);
  const [sError,  setSError]  = useState('');

  const fetchSuppliers = useCallback((q: string) => {
    setSuppLoading(true);
    const qs = new URLSearchParams({ limit: '50', ...(q ? { search: q } : {}) });
    fetch(`/api/portal/suppliers?${qs}`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) { router.push(`/${locale}/portal/login`); return; }
        if (!res.ok) return;
        const d = await res.json() as { suppliers: Supplier[]; total: number };
        setSuppliers(d.suppliers ?? []);
        setSuppTotal(d.total ?? 0);
      })
      .catch(() => { /* empty state */ })
      .finally(() => setSuppLoading(false));
  }, [locale, router]);

  useEffect(() => {
    if (tab === 'suppliers') {
      void (async () => { fetchSuppliers(suppSearch); })();
    }
  }, [tab, fetchSuppliers, suppSearch]);

  function openAddSupplier() {
    setEditSupp(null);
    setSName(''); setSPhone(''); setSEmail(''); setSAddr(''); setSNotes(''); setSError('');
    setSuppModal(true);
  }

  function openEditSupplier(s: Supplier) {
    setEditSupp(s);
    setSName(s.name); setSPhone(s.phone ?? ''); setSEmail(s.email ?? '');
    setSAddr(s.address ?? ''); setSNotes(s.notes ?? ''); setSError('');
    setSuppModal(true);
  }

  function handleSaveSupplier() {
    setSError('');
    if (!sName.trim()) { setSError('اسم المورد مطلوب'); return; }
    setSSaving(true);
    const url    = editSupp ? `/api/portal/suppliers/${editSupp.id}` : '/api/portal/suppliers';
    const method = editSupp ? 'PATCH' : 'POST';
    fetch(url, {
      method, credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: sName.trim(), phone: sPhone.trim() || undefined, email: sEmail.trim() || undefined, address: sAddr.trim() || undefined, notes: sNotes.trim() || undefined }),
    })
      .then(async (res) => {
        const d = await res.json() as { supplier?: Supplier; error?: string };
        if (!res.ok) {
          const errMap: Record<string, string> = {
            name_already_exists: 'هذا الاسم مسجل مسبقاً',
            name_required: 'الاسم مطلوب',
            email_invalid: 'البريد الإلكتروني غير صحيح',
          };
          setSError(errMap[d.error ?? ''] ?? 'فشل الحفظ');
          return;
        }
        setSuppModal(false);
        showToast(editSupp ? '✓ تم تحديث المورد' : '✓ تمت إضافة المورد');
        fetchSuppliers(suppSearch);
      })
      .catch(() => setSError('فشل الاتصال'))
      .finally(() => setSSaving(false));
  }

  // ═══ PURCHASE ORDERS ═════════════════════════════════════════════════════

  const [orders,    setOrders]    = useState<PurchaseOrder[]>([]);
  const [ordTotal,  setOrdTotal]  = useState(0);
  const [ordLoading, setOrdLoading] = useState(false);
  const [ordFilter, setOrdFilter] = useState<string>('');  // status filter

  // Add order modal state
  const [addOrderOpen, setAddOrderOpen] = useState(false);
  const [allProducts,  setAllProducts]  = useState<Product[]>([]);
  const [oSupplier,    setOSupplier]    = useState('');
  const [oItems,       setOItems]       = useState<Array<{ productId: string; productName: string; productPlu: string; qtyOrdered: number; unitCost: number }>>([]);
  const [oNotes,       setONotes]       = useState('');
  const [oExpected,    setOExpected]    = useState('');
  const [oSaving,      setOSaving]      = useState(false);
  const [oError,       setOError]       = useState('');

  // Detail / receive modal
  const [detailOrder, setDetailOrder] = useState<PurchaseOrder | null>(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [rcvItems,    setRcvItems]    = useState<Array<{ productId: string; productName: string; qtyOrdered: number; qtyReceived: number; qtyReceive: number }>>([]);
  const [rcvSaving,   setRcvSaving]   = useState(false);
  const [rcvError,    setRcvError]    = useState('');

  // Mark-as-ordered
  const [markSaving, setMarkSaving] = useState<string | null>(null);

  const fetchOrders = useCallback(() => {
    setOrdLoading(true);
    const qs = new URLSearchParams({ limit: '50', ...(ordFilter ? { status: ordFilter } : {}) });
    fetch(`/api/portal/purchase-orders?${qs}`, { credentials: 'include' })
      .then(async (res) => {
        if (res.status === 401) { router.push(`/${locale}/portal/login`); return; }
        if (!res.ok) return;
        const d = await res.json() as { orders: PurchaseOrder[]; total: number };
        setOrders(d.orders ?? []);
        setOrdTotal(d.total ?? 0);
      })
      .catch(() => { /* empty state */ })
      .finally(() => setOrdLoading(false));
  }, [locale, router, ordFilter]);

  useEffect(() => {
    if (tab === 'orders') {
      void (async () => { fetchOrders(); })();
    }
  }, [tab, fetchOrders]);

  // Load products and suppliers for new-order modal
  function openAddOrder() {
    setOError('');
    setOSupplier(''); setOItems([]); setONotes(''); setOExpected('');

    // Fetch suppliers list (active only)
    if (suppliers.length === 0) fetchSuppliers('');

    // Fetch products (up to 200, enough for a picker)
    fetch('/api/portal/products?limit=200&isActive=true', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const d = await res.json() as { products: Product[] };
        setAllProducts(d.products ?? []);
      })
      .catch(() => { /* fallback to empty */ });

    // Ensure suppliers loaded
    fetch('/api/portal/suppliers?limit=100', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return;
        const d = await res.json() as { suppliers: Supplier[] };
        setSuppliers(prev => prev.length > 0 ? prev : (d.suppliers ?? []));
      })
      .catch(() => { /* fallback */ });

    setAddOrderOpen(true);
  }

  function addOrderLine() {
    setOItems(prev => [...prev, { productId: '', productName: '', productPlu: '', qtyOrdered: 1, unitCost: 0 }]);
  }

  function removeOrderLine(idx: number) {
    setOItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateOrderLine(idx: number, field: string, value: string | number) {
    setOItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (field === 'productId') {
        const p = allProducts.find(x => x.id === value);
        return { ...item, productId: String(value), productName: p?.name ?? '', productPlu: p?.plu ?? '' };
      }
      return { ...item, [field]: value };
    }));
  }

  function handleSaveOrder() {
    setOError('');
    if (!oSupplier)         { setOError('اختر موردًا');             return; }
    if (oItems.length === 0) { setOError('أضف منتجًا واحدًا على الأقل'); return; }
    if (oItems.some(i => !i.productId)) { setOError('اختر منتجًا لكل سطر'); return; }

    setOSaving(true);
    fetch('/api/portal/purchase-orders', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: oSupplier,
        items: oItems.map(i => ({ productId: i.productId, qtyOrdered: Number(i.qtyOrdered), unitCost: Number(i.unitCost) })),
        notes: oNotes || undefined,
        expectedAt: oExpected || undefined,
      }),
    })
      .then(async (res) => {
        const d = await res.json() as { order?: PurchaseOrder; error?: string };
        if (!res.ok) {
          const errMap: Record<string, string> = {
            supplierId_required: 'اختر موردًا',
            items_required: 'أضف منتجًا واحدًا على الأقل',
            supplier_not_found: 'المورد غير موجود',
          };
          setOError(errMap[d.error ?? ''] ?? (d.error ?? 'فشل الإنشاء'));
          return;
        }
        setAddOrderOpen(false);
        showToast('✓ تم إنشاء طلب الشراء');
        fetchOrders();
      })
      .catch(() => setOError('فشل الاتصال'))
      .finally(() => setOSaving(false));
  }

  function handleMarkOrdered(order: PurchaseOrder) {
    setMarkSaving(order.id);
    fetch(`/api/portal/purchase-orders/${order.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ordered' }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        showToast('✓ تم إرسال الطلب للمورد');
        fetchOrders();
      })
      .catch(() => { /* silently fail */ })
      .finally(() => setMarkSaving(null));
  }

  function handleCancelOrder(order: PurchaseOrder) {
    if (!confirm('هل تريد إلغاء هذا الطلب؟')) return;
    fetch(`/api/portal/purchase-orders/${order.id}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        showToast('تم إلغاء الطلب');
        fetchOrders();
        if (detailOrder?.id === order.id) setDetailOrder(null);
      })
      .catch(() => { /* silently fail */ });
  }

  function openReceive(order: PurchaseOrder) {
    const unreceived = order.items.filter(i => i.qtyReceived < i.qtyOrdered);
    setRcvItems(unreceived.map(i => ({
      productId:   i.productId,
      productName: i.productName,
      qtyOrdered:  i.qtyOrdered,
      qtyReceived: i.qtyReceived,
      qtyReceive:  i.qtyOrdered - i.qtyReceived, // default: receive all remaining
    })));
    setRcvError('');
    setReceiveOpen(true);
  }

  function handleReceive() {
    if (!detailOrder) return;
    const toReceive = rcvItems.filter(i => i.qtyReceive > 0);
    if (toReceive.length === 0) { setRcvError('أدخل كمية واحدة على الأقل'); return; }

    setRcvSaving(true);
    setRcvError('');
    fetch(`/api/portal/purchase-orders/${detailOrder.id}/receive`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: toReceive.map(i => ({ productId: i.productId, qtyReceive: Number(i.qtyReceive) })) }),
    })
      .then(async (res) => {
        const d = await res.json() as { order?: PurchaseOrder; error?: string };
        if (!res.ok) {
          const errMap: Record<string, string> = {
            nothing_to_receive: 'لا توجد كميات متبقية للاستلام',
            order_not_receivable: 'الطلب لا يقبل الاستلام بهذه الحالة',
          };
          setRcvError(errMap[d.error ?? ''] ?? (d.error ?? 'فشل الاستلام'));
          return;
        }
        setReceiveOpen(false);
        if (d.order) setDetailOrder(d.order);
        showToast('✓ تم تسجيل الاستلام وتحديث المخزون');
        fetchOrders();
      })
      .catch(() => setRcvError('فشل الاتصال'))
      .finally(() => setRcvSaving(false));
  }

  // ─── Summary stats ────────────────────────────────────────────────────────
  const pendingCount  = orders.filter(o => o.status === 'ordered' || o.status === 'partial').length;
  const draftCount    = orders.filter(o => o.status === 'draft').length;
  const totalValue    = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.totalCost, 0);

  return (
    <div style={{ maxWidth: '1100px', color: '#111827' }}>
      <PortalBreadcrumb current="المشتريات" />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>المشتريات</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px', marginBottom: 0 }}>
            إدارة الموردين وطلبات الشراء
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {tab === 'orders' && (
            <button onClick={openAddOrder} style={{ background: '#0F3D2A', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              + طلب شراء
            </button>
          )}
          {tab === 'suppliers' && (
            <button onClick={openAddSupplier} style={{ background: '#0F3D2A', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              + إضافة مورد
            </button>
          )}
        </div>
      </div>

      {/* Summary cards — orders tab only */}
      {tab === 'orders' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '20px' }}>
          {[
            { label: 'طلبات معلقة', value: String(pendingCount),  color: '#1D4ED8' },
            { label: 'مسودات',      value: String(draftCount),     color: '#6B7280' },
            { label: 'قيمة إجمالية',value: fmtMAD(totalValue),    color: '#0F3D2A' },
          ].map(s => (
            <div key={s.label} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '10px', padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</p>
              <p style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: s.color }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', background: '#F3F4F6', borderRadius: '8px', padding: '4px', marginBottom: '20px', width: 'fit-content' }}>
        {(['orders', 'suppliers'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: '14px', fontWeight: tab === t ? 700 : 500,
            background: tab === t ? '#FFFFFF' : 'transparent',
            color: tab === t ? '#0F3D2A' : '#6B7280',
            boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s',
          }}>
            {t === 'orders' ? 'طلبات الشراء' : 'الموردون'}
          </button>
        ))}
      </div>

      {/* ═══ ORDERS TAB ═══════════════════════════════════════════════════════ */}
      {tab === 'orders' && (
        <>
          {/* Status filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {(['', 'draft', 'ordered', 'partial', 'received', 'cancelled'] as const).map(s => (
              <button key={s} onClick={() => setOrdFilter(s)} style={{
                padding: '5px 14px', borderRadius: '999px', border: '1px solid',
                borderColor: ordFilter === s ? '#0F3D2A' : '#E5E7EB',
                background: ordFilter === s ? '#0F3D2A' : '#FFFFFF',
                color: ordFilter === s ? '#FFFFFF' : '#374151',
                fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                {s === '' ? 'الكل' : STATUS_META[s].label}
              </button>
            ))}
          </div>

          {/* Orders table */}
          <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <tr>
                  <th style={TH}>المورد</th>
                  <th style={TH}>المنتجات</th>
                  <th style={TH}>التكلفة</th>
                  <th style={TH}>الحالة</th>
                  <th style={TH}>التاريخ</th>
                  <th style={{ ...TH, width: '120px' }}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {ordLoading ? (
                  <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>جاري التحميل…</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>لا توجد طلبات — ابدأ بإنشاء طلب شراء جديد</td></tr>
                ) : (
                  orders.map((o, i) => (
                    <tr key={o.id} style={{ borderBottom: i < orders.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                      <td style={{ ...TD, fontWeight: 600 }}>{o.supplierName}</td>
                      <td style={{ ...TD, color: '#6B7280', fontSize: '13px' }}>
                        {o.items.length} {o.items.length === 1 ? 'منتج' : 'منتجات'}
                      </td>
                      <td style={{ ...TD, fontWeight: 600 }}>{fmtMAD(o.totalCost)}</td>
                      <td style={TD}><StatusBadge status={o.status} /></td>
                      <td style={{ ...TD, color: '#6B7280', fontSize: '13px' }}>{fmtDate(o.createdAt)}</td>
                      <td style={TD}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={() => setDetailOrder(o)}
                            style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}
                          >
                            عرض
                          </button>
                          {o.status === 'draft' && (
                            <button
                              onClick={() => handleMarkOrdered(o)}
                              disabled={markSaving === o.id}
                              style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: '#1D4ED8', fontFamily: 'inherit', opacity: markSaving === o.id ? 0.6 : 1 }}
                            >
                              {markSaving === o.id ? '…' : 'إرسال'}
                            </button>
                          )}
                          {(o.status === 'ordered' || o.status === 'partial') && (
                            <button
                              onClick={() => { setDetailOrder(o); openReceive(o); }}
                              style={{ background: '#D1FAE5', border: '1px solid #A7F3D0', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: '#065F46', fontFamily: 'inherit' }}
                            >
                              استلام
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {ordTotal > orders.length && (
            <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '12px', textAlign: 'center' }}>
              يُعرض {orders.length} من أصل {ordTotal}
            </p>
          )}
        </>
      )}

      {/* ═══ SUPPLIERS TAB ═══════════════════════════════════════════════════ */}
      {tab === 'suppliers' && (
        <>
          <div style={{ marginBottom: '16px', maxWidth: '320px' }}>
            <input
              type="text"
              value={suppSearch}
              onChange={e => {
                setSuppSearch(e.target.value);
                clearTimeout(suppTimer.current);
                suppTimer.current = setTimeout(() => fetchSuppliers(e.target.value), 300);
              }}
              placeholder="ابحث بالاسم أو الهاتف…"
              style={INPUT}
            />
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                <tr>
                  <th style={TH}>الاسم</th>
                  <th style={TH}>الهاتف</th>
                  <th style={TH}>البريد</th>
                  <th style={TH}>العنوان</th>
                  <th style={{ ...TH, width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {suppLoading ? (
                  <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>جاري التحميل…</td></tr>
                ) : suppliers.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...TD, textAlign: 'center', padding: '48px', color: '#9CA3AF' }}>{suppSearch ? 'لا توجد نتائج' : 'لا يوجد موردون — أضف أول مورد'}</td></tr>
                ) : (
                  suppliers.map((s, i) => (
                    <tr key={s.id} style={{ borderBottom: i < suppliers.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                      <td style={{ ...TD, fontWeight: 600 }}>{s.name}</td>
                      <td style={{ ...TD, color: '#6B7280', fontSize: '13px', direction: 'ltr', textAlign: 'right' }}>{s.phone || '—'}</td>
                      <td style={{ ...TD, color: '#6B7280', fontSize: '13px' }}>{s.email || '—'}</td>
                      <td style={{ ...TD, color: '#6B7280', fontSize: '13px' }}>{s.address || '—'}</td>
                      <td style={TD}>
                        <button onClick={() => openEditSupplier(s)} style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
                          تعديل
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {suppTotal > suppliers.length && (
            <p style={{ fontSize: '13px', color: '#9CA3AF', marginTop: '12px', textAlign: 'center' }}>
              يُعرض {suppliers.length} من أصل {suppTotal}
            </p>
          )}
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#0F3D2A', color: '#FFFFFF', borderRadius: '8px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, zIndex: 2000, boxShadow: '0 4px 16px rgba(0,0,0,0.20)' }}>
          {toast}
        </div>
      )}

      {/* ── Add / Edit Supplier Modal ──────────────────────────────────────── */}
      {suppModal && (
        <Modal onClose={() => setSuppModal(false)}>
          <div style={{ padding: '28px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>{editSupp ? 'تعديل المورد' : 'إضافة مورد'}</h2>
              <button onClick={() => setSuppModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9CA3AF' }}>✕</button>
            </div>

            {sError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#DC2626' }}>
                {sError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={LABEL}>اسم المورد <span style={{ color: '#EF4444' }}>*</span></label>
                <input type="text" value={sName} onChange={e => setSName(e.target.value)} placeholder="شركة الإمداد المتحدة" style={INPUT} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={LABEL}>الهاتف</label>
                  <input type="tel" value={sPhone} onChange={e => setSPhone(e.target.value)} placeholder="0661234567" style={{ ...INPUT, direction: 'ltr', textAlign: 'right' }} />
                </div>
                <div>
                  <label style={LABEL}>البريد الإلكتروني</label>
                  <input type="email" value={sEmail} onChange={e => setSEmail(e.target.value)} placeholder="contact@supplier.ma" style={{ ...INPUT, direction: 'ltr', textAlign: 'right' }} />
                </div>
              </div>
              <div>
                <label style={LABEL}>العنوان</label>
                <input type="text" value={sAddr} onChange={e => setSAddr(e.target.value)} placeholder="الدار البيضاء، المغرب" style={INPUT} />
              </div>
              <div>
                <label style={LABEL}>ملاحظات</label>
                <input type="text" value={sNotes} onChange={e => setSNotes(e.target.value)} placeholder="شروط الدفع، مدد التسليم…" style={INPUT} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={handleSaveSupplier} disabled={sSaving} style={{ flex: 1, background: '#0F3D2A', color: '#FFF', border: 'none', borderRadius: '8px', padding: '11px', fontSize: '15px', fontWeight: 700, cursor: sSaving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: sSaving ? 0.7 : 1 }}>
                {sSaving ? '…' : editSupp ? 'حفظ التعديلات' : 'إضافة'}
              </button>
              <button onClick={() => setSuppModal(false)} style={{ flex: 1, background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '11px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Add Order Modal ────────────────────────────────────────────────── */}
      {addOrderOpen && (
        <Modal onClose={() => setAddOrderOpen(false)} width={680}>
          <div style={{ padding: '28px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>طلب شراء جديد</h2>
              <button onClick={() => setAddOrderOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9CA3AF' }}>✕</button>
            </div>

            {oError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#DC2626' }}>
                {oError}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              {/* Supplier */}
              <div>
                <label style={LABEL}>المورد <span style={{ color: '#EF4444' }}>*</span></label>
                <select
                  value={oSupplier}
                  onChange={e => setOSupplier(e.target.value)}
                  style={{ ...INPUT, appearance: 'none', backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\'%3E%3Cpath d=\'M0 0l6 8 6-8z\' fill=\'%236B7280\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: '12px center' }}
                >
                  <option value="">— اختر موردًا —</option>
                  {suppliers.filter(s => s.isActive).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              {/* Expected delivery */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={LABEL}>تاريخ التسليم المتوقع</label>
                  <input type="date" value={oExpected} onChange={e => setOExpected(e.target.value)} style={{ ...INPUT, direction: 'ltr' }} />
                </div>
                <div>
                  <label style={LABEL}>ملاحظات</label>
                  <input type="text" value={oNotes} onChange={e => setONotes(e.target.value)} placeholder="شروط خاصة…" style={INPUT} />
                </div>
              </div>
            </div>

            {/* Items */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ ...LABEL, marginBottom: 0 }}>المنتجات <span style={{ color: '#EF4444' }}>*</span></label>
                <button onClick={addOrderLine} style={{ background: '#F0F9F4', color: '#0F3D2A', border: '1px solid #D1FAE5', borderRadius: '6px', padding: '4px 12px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                  + سطر
                </button>
              </div>

              {oItems.length === 0 ? (
                <p style={{ color: '#9CA3AF', fontSize: '13px', textAlign: 'center', padding: '20px', border: '1px dashed #E5E7EB', borderRadius: '8px' }}>
                  اضغط &quot;+ سطر&quot; لإضافة منتج
                </p>
              ) : (
                <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#F9FAFB' }}>
                      <tr>
                        <th style={{ ...TH, fontSize: '11px' }}>المنتج</th>
                        <th style={{ ...TH, fontSize: '11px', width: '80px' }}>الكمية</th>
                        <th style={{ ...TH, fontSize: '11px', width: '100px' }}>سعر التكلفة</th>
                        <th style={{ ...TH, width: '36px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {oItems.map((item, idx) => (
                        <tr key={idx} style={{ borderTop: '1px solid #F3F4F6' }}>
                          <td style={{ padding: '8px' }}>
                            <select
                              value={item.productId}
                              onChange={e => updateOrderLine(idx, 'productId', e.target.value)}
                              style={{ ...INPUT, padding: '7px 10px', fontSize: '13px' }}
                            >
                              <option value="">— اختر منتجًا —</option>
                              {allProducts.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.plu})</option>
                              ))}
                            </select>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="number" min="1" step="1"
                              value={item.qtyOrdered}
                              onChange={e => updateOrderLine(idx, 'qtyOrdered', Number(e.target.value))}
                              style={{ ...INPUT, padding: '7px 8px', textAlign: 'center', direction: 'ltr' }}
                            />
                          </td>
                          <td style={{ padding: '8px' }}>
                            <input
                              type="number" min="0" step="0.01"
                              value={item.unitCost}
                              onChange={e => updateOrderLine(idx, 'unitCost', Number(e.target.value))}
                              style={{ ...INPUT, padding: '7px 8px', textAlign: 'right', direction: 'ltr' }}
                            />
                          </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                            <button onClick={() => removeOrderLine(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: '16px', lineHeight: 1, padding: '2px' }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Total */}
              {oItems.length > 0 && (
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#0F3D2A', marginTop: '10px', textAlign: 'left', direction: 'ltr' }}>
                  الإجمالي: {fmtMAD(oItems.reduce((s, i) => s + Number(i.qtyOrdered) * Number(i.unitCost), 0))}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button onClick={handleSaveOrder} disabled={oSaving} style={{ flex: 1, background: '#0F3D2A', color: '#FFF', border: 'none', borderRadius: '8px', padding: '11px', fontSize: '15px', fontWeight: 700, cursor: oSaving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: oSaving ? 0.7 : 1 }}>
                {oSaving ? '…' : 'إنشاء الطلب'}
              </button>
              <button onClick={() => setAddOrderOpen(false)} style={{ flex: 1, background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '11px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Order Detail Modal ─────────────────────────────────────────────── */}
      {detailOrder != null && !receiveOpen && (
        <Modal onClose={() => setDetailOrder(null)} width={640}>
          <div style={{ padding: '28px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 700 }}>{detailOrder.supplierName}</h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <StatusBadge status={detailOrder.status} />
                  <span style={{ fontSize: '13px', color: '#6B7280' }}>{fmtDate(detailOrder.createdAt)}</span>
                </div>
              </div>
              <button onClick={() => setDetailOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9CA3AF' }}>✕</button>
            </div>

            {/* Items table */}
            <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <tr>
                    <th style={{ ...TH, fontSize: '11px' }}>المنتج</th>
                    <th style={{ ...TH, fontSize: '11px', textAlign: 'center' }}>مُطلوب</th>
                    <th style={{ ...TH, fontSize: '11px', textAlign: 'center' }}>مُستلَم</th>
                    <th style={{ ...TH, fontSize: '11px' }}>سعر التكلفة</th>
                    <th style={{ ...TH, fontSize: '11px' }}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {detailOrder.items.map((item, i) => {
                    const done = item.qtyReceived >= item.qtyOrdered;
                    return (
                      <tr key={item.productId} style={{ borderBottom: i < detailOrder.items.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                        <td style={{ ...TD, fontWeight: 500 }}>
                          {item.productName}
                          {item.productPlu ? <span style={{ fontSize: '11px', color: '#9CA3AF', marginRight: '6px' }}>({item.productPlu})</span> : null}
                        </td>
                        <td style={{ ...TD, textAlign: 'center' }}>{item.qtyOrdered}</td>
                        <td style={{ ...TD, textAlign: 'center', fontWeight: 600, color: done ? '#065F46' : item.qtyReceived > 0 ? '#854D0E' : '#6B7280' }}>
                          {item.qtyReceived}
                          {done ? ' ✓' : ''}
                        </td>
                        <td style={TD}>{fmtMAD(item.unitCost)}</td>
                        <td style={{ ...TD, fontWeight: 600 }}>{fmtMAD(item.unitCost * item.qtyOrdered)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot style={{ borderTop: '2px solid #E5E7EB', background: '#F9FAFB' }}>
                  <tr>
                    <td colSpan={4} style={{ ...TD, fontWeight: 700, textAlign: 'right', fontSize: '13px' }}>الإجمالي</td>
                    <td style={{ ...TD, fontWeight: 700, color: '#0F3D2A' }}>{fmtMAD(detailOrder.totalCost)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {detailOrder.notes && (
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
                ملاحظات: <strong style={{ color: '#374151' }}>{detailOrder.notes}</strong>
              </p>
            )}
            {detailOrder.expectedAt && (
              <p style={{ fontSize: '13px', color: '#6B7280', marginBottom: '16px' }}>
                تاريخ التسليم المتوقع: <strong style={{ color: '#374151' }}>{fmtDate(detailOrder.expectedAt)}</strong>
              </p>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {detailOrder.status === 'draft' && (
                <>
                  <button onClick={() => handleMarkOrdered(detailOrder)} style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    إرسال للمورد
                  </button>
                  <button onClick={() => handleCancelOrder(detailOrder)} style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    إلغاء الطلب
                  </button>
                </>
              )}
              {(detailOrder.status === 'ordered' || detailOrder.status === 'partial') && (
                <>
                  <button onClick={() => openReceive(detailOrder)} style={{ background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    تسجيل الاستلام
                  </button>
                  <button onClick={() => handleCancelOrder(detailOrder)} style={{ background: '#FEF2F2', color: '#991B1B', border: '1px solid #FECACA', borderRadius: '8px', padding: '9px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    إلغاء الطلب
                  </button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* ── Receive Modal ──────────────────────────────────────────────────── */}
      {detailOrder != null && receiveOpen && (
        <Modal onClose={() => setReceiveOpen(false)} width={560}>
          <div style={{ padding: '28px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 700 }}>تسجيل الاستلام</h2>
                <p style={{ margin: 0, fontSize: '13px', color: '#6B7280' }}>{detailOrder.supplierName}</p>
              </div>
              <button onClick={() => setReceiveOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#9CA3AF' }}>✕</button>
            </div>

            <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#92400E' }}>
              ⚠️ تسجيل الاستلام سيُضاف الكميات مباشرةً إلى مخزونك. تأكد من العدّ الفعلي قبل التأكيد.
            </div>

            {rcvError && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '13px', color: '#DC2626' }}>
                {rcvError}
              </div>
            )}

            <div style={{ border: '1px solid #E5E7EB', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                  <tr>
                    <th style={{ ...TH, fontSize: '11px' }}>المنتج</th>
                    <th style={{ ...TH, fontSize: '11px', textAlign: 'center' }}>متبقٍ</th>
                    <th style={{ ...TH, fontSize: '11px', textAlign: 'center', width: '100px' }}>يُستلم الآن</th>
                  </tr>
                </thead>
                <tbody>
                  {rcvItems.map((item, idx) => {
                    const remaining = item.qtyOrdered - item.qtyReceived;
                    return (
                      <tr key={item.productId} style={{ borderBottom: idx < rcvItems.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                        <td style={{ ...TD, fontWeight: 500, fontSize: '13px' }}>{item.productName}</td>
                        <td style={{ ...TD, textAlign: 'center', color: '#6B7280', fontSize: '13px' }}>{remaining}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <input
                            type="number" min="0" max={remaining} step="1"
                            value={item.qtyReceive}
                            onChange={e => {
                              const val = Math.min(remaining, Math.max(0, Number(e.target.value)));
                              setRcvItems(prev => prev.map((x, i) => i === idx ? { ...x, qtyReceive: val } : x));
                            }}
                            style={{ ...INPUT, padding: '7px 8px', textAlign: 'center', direction: 'ltr', width: '80px' }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleReceive}
                disabled={rcvSaving}
                style={{ flex: 1, background: '#0F3D2A', color: '#FFF', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 700, cursor: rcvSaving ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: rcvSaving ? 0.7 : 1 }}
              >
                {rcvSaving ? '…' : 'تأكيد الاستلام وتحديث المخزون'}
              </button>
              <button onClick={() => setReceiveOpen(false)} style={{ flex: 1, background: '#F9FAFB', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                إلغاء
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
