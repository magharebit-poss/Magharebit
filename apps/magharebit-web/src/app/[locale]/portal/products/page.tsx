'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import PortalBreadcrumb from '@/components/portal/PortalBreadcrumb';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Product {
  id: string;
  plu: string;
  name: string;
  category: string;
  price: number;
  costPrice: number;
  stock: number;
  minStock: number;
  unit: string;
  emoji: string;
  barcode?: string;
  isActive: boolean;
}

interface ProductsResponse {
  products: Product[];
  total: number;
  page: number;
  pages: number;
  categories: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtPrice(n: number) {
  return `MAD ${n.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function readAlertDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  try { return localStorage.getItem('inv_alert_dismissed_date') === new Date().toDateString(); }
  catch { return false; }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const TH: React.CSSProperties = {
  padding: '12px 16px', textAlign: 'right', fontSize: '12px', fontWeight: 600,
  color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
};
const TD: React.CSSProperties = { padding: '14px 16px', fontSize: '14px', textAlign: 'right' };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', border: '1px solid #D1D5DB', borderRadius: '8px',
  fontSize: '14px', fontFamily: 'inherit', color: '#111827', background: '#FFFFFF',
  outline: 'none', direction: 'rtl', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px',
};

const UNITS = ['pièce', 'kg', 'g', 'L', 'mL', 'boîte', 'pack', 'lot', 'service'];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const router = useRouter();

  // ── List state ──
  const [data,          setData]          = useState<ProductsResponse | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState('');
  const [category,      setCategory]      = useState('');
  const [lowStockOnly,  setLowStockOnly]  = useState(false);
  const [page,          setPage]          = useState(1);
  const [alertDismissed, setAlertDismissed] = useState(() => readAlertDismissed());

  // ── Modal state ──
  const [showModal,    setShowModal]    = useState(false);
  const [editProduct,  setEditProduct]  = useState<Product | null>(null);   // null = create
  const [saving,       setSaving]       = useState(false);
  const [modalError,   setModalError]   = useState('');

  // ── Adjust stock modal ──
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [adjustDelta,  setAdjustDelta]  = useState('');
  const [adjustReason, setAdjustReason] = useState<'manual_add' | 'manual_remove' | 'purchase' | 'return'>('manual_add');
  const [adjustSaving, setAdjustSaving] = useState(false);

  // ── Seed modal ──
  const [showSeedModal, setShowSeedModal] = useState(false);
  const [seedSector,    setSeedSector]    = useState('');
  const [seedForce,     setSeedForce]     = useState(false);
  const [seedLoading,   setSeedLoading]   = useState(false);

  // ── Toast ──
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ── Form fields (modal) ──
  const [fName,     setFName]     = useState('');
  const [fCat,      setFCat]      = useState('');
  const [fPrice,    setFPrice]    = useState('');
  const [fCost,     setFCost]     = useState('');
  const [fStock,    setFStock]    = useState('');
  const [fMinStock, setFMinStock] = useState('5');
  const [fUnit,     setFUnit]     = useState('pièce');
  const [fEmoji,    setFEmoji]    = useState('📦');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (search)       params.set('search',   search);
    if (category)     params.set('category', category);
    if (lowStockOnly) params.set('lowStock', 'true');
    try {
      const res = await fetch(`/api/portal/products?${params}`, { credentials: 'include' });
      if (res.status === 401) { router.push('/portal/login'); return; }
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [page, search, category, lowStockOnly, router]);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300);
    return () => clearTimeout(t);
  }, [fetchProducts]);

  // Escape key for modals
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setShowModal(false); setAdjustTarget(null); setShowSeedModal(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function showToast(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3000);
  }

  function openCreate() {
    setEditProduct(null);
    setFName(''); setFCat(''); setFPrice(''); setFCost('');
    setFStock('0'); setFMinStock('5'); setFUnit('pièce'); setFEmoji('📦');
    setModalError('');
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditProduct(p);
    setFName(p.name); setFCat(p.category); setFPrice(String(p.price));
    setFCost(String(p.costPrice)); setFStock(String(p.stock));
    setFMinStock(String(p.minStock)); setFUnit(p.unit); setFEmoji(p.emoji);
    setModalError('');
    setShowModal(true);
  }

  function dismissAlert() {
    localStorage.setItem('inv_alert_dismissed_date', new Date().toDateString());
    setAlertDismissed(true);
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────
  async function handleSave() {
    if (!fName.trim())  { setModalError('اسم المنتج مطلوب');  return; }
    if (!fCat.trim())   { setModalError('الفئة مطلوبة');       return; }
    if (!fPrice)        { setModalError('السعر مطلوب');         return; }
    setSaving(true); setModalError('');
    try {
      const url    = editProduct ? `/api/portal/products/${editProduct.id}` : '/api/portal/products';
      const method = editProduct ? 'PATCH' : 'POST';
      const body   = {
        name: fName.trim(), category: fCat.trim(),
        price: parseFloat(fPrice), costPrice: parseFloat(fCost || '0'),
        stock: parseInt(fStock || '0'), minStock: parseInt(fMinStock || '5'),
        unit: fUnit, emoji: fEmoji || '📦',
      };
      const res = await fetch(url, {
        method, credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) { setModalError(d.error ?? 'فشل الحفظ'); return; }
      setShowModal(false);
      showToast(editProduct ? 'تم تحديث المنتج ✓' : 'تم إضافة المنتج ✓');
      fetchProducts();
    } finally { setSaving(false); }
  }

  async function handleDelete(p: Product) {
    if (!confirm(`هل تريد حذف "${p.name}"؟`)) return;
    const res = await fetch(`/api/portal/products/${p.id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) { showToast('تم حذف المنتج'); fetchProducts(); }
    else showToast('فشل الحذف');
  }

  async function handleAdjust() {
    if (!adjustTarget) return;
    const delta = parseInt(adjustDelta);
    if (!delta) { alert('أدخل كمية غير صفرية'); return; }
    setAdjustSaving(true);
    try {
      const res = await fetch(`/api/portal/products/${adjustTarget.id}/adjust`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta, reason: adjustReason }),
      });
      const d = await res.json();
      if (!res.ok) { alert(d.error ?? 'فشل التعديل'); return; }
      if (d.isLowStock) showToast(`⚠️ المخزون منخفض: ${adjustTarget.name}`);
      else showToast('تم تعديل المخزون ✓');
      setAdjustTarget(null);
      fetchProducts();
    } finally { setAdjustSaving(false); }
  }

  async function handleSeed() {
    if (!seedSector) { alert('اختر القطاع'); return; }
    setSeedLoading(true);
    try {
      const res = await fetch('/api/portal/products/seed', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sector: seedSector, force: seedForce }),
      });
      const d = await res.json();
      if (res.status === 409) {
        setSeedForce(true);
        alert(`يوجد ${d.count} منتج بالفعل. فعّل "استبدال" وأعد المحاولة.`);
        return;
      }
      if (!res.ok) { alert(d.error ?? 'فشل التوليد'); return; }
      showToast(`تم توليد ${d.seeded} منتج من قالب ${seedSector} ✓`);
      setShowSeedModal(false); setSeedForce(false);
      fetchProducts();
    } finally { setSeedLoading(false); }
  }

  // ── CSV Export ──────────────────────────────────────────────────────────────
  function exportCsv() {
    if (!data?.products.length) return;
    const headers = ['PLU', 'الاسم', 'الفئة', 'السعر', 'التكلفة', 'المخزون', 'الحد الأدنى'];
    const rows = data.products.map(p => [p.plu, p.name, p.category, String(p.price), String(p.costPrice), String(p.stock), String(p.minStock)]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url; a.download = 'products.csv'; a.click();
    URL.revokeObjectURL(url);
  }

  const products    = data?.products    ?? [];
  const categories  = data?.categories  ?? [];
  const lowStockCount = products.filter(p => p.stock <= p.minStock).length;
  const totalPages  = data?.pages ?? 1;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: '1000px', color: '#111827' }}>
      <PortalBreadcrumb current="المنتجات" />

      {/* Low-stock alert */}
      {!alertDismissed && lowStockCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', gap: '12px', direction: 'rtl' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px' }}>⚠️</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#92400E' }}>
              {lowStockCount} منتج وصل للمخزون المنخفض — مراجعة الكميات مُوصى به
            </span>
          </div>
          <button onClick={dismissAlert} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: '#B45309', lineHeight: 1, padding: '2px 4px' }}>×</button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 700, margin: 0 }}>المنتجات</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '4px', marginBottom: 0 }}>
            {data ? `${data.total} منتج في القاعدة` : 'جارٍ التحميل...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={() => setShowSeedModal(true)}
            style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '10px 16px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            🌱 توليد قالب
          </button>
          <button onClick={exportCsv} disabled={products.length === 0}
            style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '8px', padding: '10px 16px', cursor: products.length === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 600, color: '#374151', fontFamily: 'inherit', whiteSpace: 'nowrap', opacity: products.length === 0 ? 0.5 : 1 }}>
            📥 تصدير CSV
          </button>
          <button onClick={openCreate}
            style={{ background: '#0F3D2A', color: '#FFFFFF', fontWeight: 600, border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            + إضافة منتج
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <input type="text" placeholder="البحث عن منتج أو PLU..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: '200px', padding: '10px 16px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', color: '#111827', background: '#FFFFFF', outline: 'none', direction: 'rtl' }} />
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
          style={{ padding: '10px 16px', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '14px', fontFamily: 'inherit', color: '#111827', background: '#FFFFFF', outline: 'none', cursor: 'pointer', direction: 'rtl' }}>
          <option value="">كل الفئات</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#374151', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={lowStockOnly} onChange={e => { setLowStockOnly(e.target.checked); setPage(1); }} />
          المخزون المنخفض فقط
        </label>
      </div>

      {/* Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
              {['PLU', 'المنتج', 'الفئة', 'السعر', 'التكلفة', 'المخزون', 'إجراءات'].map(col => (
                <th key={col} style={TH}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>جارٍ التحميل...</td></tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...TD, textAlign: 'center', padding: '40px 24px' }}>
                  <div style={{ color: '#9CA3AF', fontSize: '15px', marginBottom: '12px' }}>
                    {search || category || lowStockOnly ? '🔍 لا توجد منتجات مطابقة' : '📦 لا توجد منتجات بعد'}
                  </div>
                  {!search && !category && !lowStockOnly && (
                    <button onClick={() => setShowSeedModal(true)} style={{ background: '#0F3D2A', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>
                      🌱 توليد منتجات من قالب
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              products.map((p, i) => {
                const isLow = p.stock <= p.minStock;
                return (
                  <tr key={p.id} style={{ borderBottom: i < products.length - 1 ? '1px solid #F3F4F6' : 'none', background: isLow ? '#FEF3C7' : 'transparent' }}>
                    <td style={{ ...TD, color: '#6B7280', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{p.plu}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end' }}>
                        <span style={{ fontWeight: 500 }}>{p.name}</span>
                        <span style={{ fontSize: '20px', lineHeight: 1 }}>{p.emoji}</span>
                      </div>
                    </td>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                      <span style={{ background: '#F3F4F6', color: '#374151', borderRadius: '999px', padding: '2px 10px', fontSize: '12px', fontWeight: 500 }}>{p.category}</span>
                    </td>
                    <td style={{ ...TD, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtPrice(p.price)}</td>
                    <td style={{ ...TD, color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtPrice(p.costPrice)}</td>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                      <span style={{ fontWeight: 600, color: isLow ? '#92400E' : '#166534' }}>
                        {p.stock} {p.unit}
                        {isLow && <span style={{ fontSize: '11px', fontWeight: 500, marginRight: '4px' }}>⚠️</span>}
                      </span>
                    </td>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                        <button onClick={() => { setAdjustTarget(p); setAdjustDelta(''); setAdjustReason('manual_add'); }}
                          title="تعديل المخزون"
                          style={{ background: 'none', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
                          ±
                        </button>
                        <button onClick={() => openEdit(p)}
                          style={{ background: 'none', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: '#374151', fontFamily: 'inherit' }}>
                          تعديل
                        </button>
                        <button onClick={() => handleDelete(p)}
                          style={{ background: 'none', border: '1px solid #FCA5A5', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer', color: '#DC2626', fontFamily: 'inherit' }}>
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            style={{ padding: '8px 16px', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#FFFFFF', cursor: page <= 1 ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: page <= 1 ? 0.5 : 1, fontFamily: 'inherit' }}>
            ← السابق
          </button>
          <span style={{ padding: '8px 16px', fontSize: '13px', color: '#6B7280' }}>
            {page} / {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            style={{ padding: '8px 16px', border: '1px solid #E5E7EB', borderRadius: '8px', background: '#FFFFFF', cursor: page >= totalPages ? 'not-allowed' : 'pointer', fontSize: '13px', opacity: page >= totalPages ? 0.5 : 1, fontFamily: 'inherit' }}>
            التالي →
          </button>
        </div>
      )}

      {/* Legend */}
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ width: '12px', height: '12px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '3px', display: 'inline-block' }} />
        <span style={{ fontSize: '12px', color: '#6B7280' }}>الصفوف الصفراء: المخزون أقل من الحد الأدنى</span>
      </div>

      {/* ── Add/Edit product modal ── */}
      {showModal && (
        <>
          <div onClick={() => setShowModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#FFFFFF', borderRadius: '16px', padding: '32px', width: '520px', maxWidth: 'calc(100vw - 32px)', boxShadow: '0 20px 60px rgba(0,0,0,0.20)', zIndex: 51, direction: 'rtl', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#111827' }}>
                {editProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: '20px', lineHeight: 1, padding: '4px' }}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>اسم المنتج *</label>
                <input type="text" value={fName} onChange={e => setFName(e.target.value)} placeholder="مثال: أتاي بالنعناع" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>الفئة *</label>
                <input type="text" value={fCat} onChange={e => setFCat(e.target.value)} placeholder="مشروبات" style={inputStyle} list="cat-list" />
                <datalist id="cat-list">
                  {categories.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label style={labelStyle}>الإيموجي</label>
                <input type="text" value={fEmoji} onChange={e => setFEmoji(e.target.value)} placeholder="📦" style={{ ...inputStyle, textAlign: 'center', fontSize: '20px' }} maxLength={4} />
              </div>
              <div>
                <label style={labelStyle}>السعر (MAD) *</label>
                <input type="number" value={fPrice} onChange={e => setFPrice(e.target.value)} placeholder="0.00" min="0" step="0.5" style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
              </div>
              <div>
                <label style={labelStyle}>تكلفة الشراء (MAD)</label>
                <input type="number" value={fCost} onChange={e => setFCost(e.target.value)} placeholder="0.00" min="0" step="0.5" style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
              </div>
              <div>
                <label style={labelStyle}>المخزون الأولي</label>
                <input type="number" value={fStock} onChange={e => setFStock(e.target.value)} placeholder="0" min="0" style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
              </div>
              <div>
                <label style={labelStyle}>الحد الأدنى للتنبيه</label>
                <input type="number" value={fMinStock} onChange={e => setFMinStock(e.target.value)} placeholder="5" min="0" style={{ ...inputStyle, direction: 'ltr', textAlign: 'right' }} />
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={labelStyle}>الوحدة</label>
                <select value={fUnit} onChange={e => setFUnit(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            {modalError && (
              <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: '8px', padding: '10px 14px', color: '#DC2626', fontSize: '13px', marginBottom: '16px' }}>
                {modalError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSave} disabled={saving}
                style={{ background: saving ? '#1a5c3a' : '#0F3D2A', color: '#FFFFFF', fontWeight: 700, border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>
                {saving ? 'جارٍ الحفظ...' : 'حفظ المنتج'}
              </button>
              <button onClick={() => setShowModal(false)} style={{ background: '#FFFFFF', color: '#374151', fontWeight: 500, border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>
                إلغاء
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Stock adjustment modal ── */}
      {adjustTarget && (
        <>
          <div onClick={() => setAdjustTarget(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#FFFFFF', borderRadius: '16px', padding: '32px', width: '400px', maxWidth: 'calc(100vw - 32px)', boxShadow: '0 20px 60px rgba(0,0,0,0.20)', zIndex: 51, direction: 'rtl' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#111827' }}>تعديل المخزون</h3>
            <p style={{ fontSize: '14px', color: '#6B7280', margin: '0 0 24px' }}>{adjustTarget.emoji} {adjustTarget.name} — المخزون الحالي: {adjustTarget.stock}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={labelStyle}>الكمية (موجب = إضافة، سالب = إزالة)</label>
                <input type="number" value={adjustDelta} onChange={e => setAdjustDelta(e.target.value)} placeholder="مثال: 10 أو -5" style={{ ...inputStyle, direction: 'ltr', textAlign: 'center', fontSize: '18px', fontWeight: 600 }} />
              </div>
              <div>
                <label style={labelStyle}>السبب</label>
                <select value={adjustReason} onChange={e => setAdjustReason(e.target.value as typeof adjustReason)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="manual_add">إضافة يدوية</option>
                  <option value="manual_remove">إزالة يدوية</option>
                  <option value="purchase">شراء جديد</option>
                  <option value="return">مرتجع</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleAdjust} disabled={adjustSaving}
                style={{ background: '#0F3D2A', color: '#FFFFFF', fontWeight: 700, border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>
                {adjustSaving ? '...' : 'تأكيد'}
              </button>
              <button onClick={() => setAdjustTarget(null)} style={{ background: '#FFFFFF', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>إلغاء</button>
            </div>
          </div>
        </>
      )}

      {/* ── Seed from template modal ── */}
      {showSeedModal && (
        <>
          <div onClick={() => setShowSeedModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50 }} />
          <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#FFFFFF', borderRadius: '16px', padding: '32px', width: '440px', maxWidth: 'calc(100vw - 32px)', boxShadow: '0 20px 60px rgba(0,0,0,0.20)', zIndex: 51, direction: 'rtl' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 8px', color: '#111827' }}>توليد منتجات من قالب</h3>
            <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 24px', lineHeight: 1.6 }}>
              سيتم توليد قائمة منتجات جاهزة بأسعار MAD واقعية بناءً على قطاع متجرك.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
              <div>
                <label style={labelStyle}>قطاع المتجر</label>
                <select value={seedSector} onChange={e => setSeedSector(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="" disabled>اختر القطاع</option>
                  <option value="cafe">مقهى / Café</option>
                  <option value="epicerie">بقالة / Épicerie</option>
                  <option value="restaurant">مطعم / Restaurant</option>
                  <option value="pharmacie">صيدلية / Pharmacie</option>
                  <option value="beaute">تجميل / Beauté</option>
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#374151' }}>
                <input type="checkbox" checked={seedForce} onChange={e => setSeedForce(e.target.checked)} />
                استبدال المنتجات الموجودة (تحذير: سيتم أرشفة المنتجات الحالية)
              </label>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={handleSeed} disabled={seedLoading || !seedSector}
                style={{ background: seedSector ? '#0F3D2A' : '#D1D5DB', color: '#FFFFFF', fontWeight: 700, border: 'none', borderRadius: '8px', padding: '10px 20px', cursor: seedSector ? 'pointer' : 'not-allowed', fontSize: '14px', fontFamily: 'inherit' }}>
                {seedLoading ? 'جارٍ التوليد...' : 'توليد المنتجات'}
              </button>
              <button onClick={() => setShowSeedModal(false)} style={{ background: '#FFFFFF', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 20px', cursor: 'pointer', fontSize: '14px', fontFamily: 'inherit' }}>إلغاء</button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '24px', background: '#0F3D2A', color: '#FFFFFF', borderRadius: '8px', padding: '12px 20px', fontSize: '14px', fontFamily: 'inherit', fontWeight: 500, zIndex: 60, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: '#22C55E', fontSize: '16px' }}>✓</span> {toast}
        </div>
      )}
    </div>
  );
}
