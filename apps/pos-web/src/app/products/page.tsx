'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../context/LanguageContext';
import { BrandLockup } from '../../components/brand/BrandLockup';

const UOM_OPTIONS = ['UNIT', 'KG', 'G', 'L', 'ML', 'BUNCH', 'BOX', 'BAG', 'PIECE'];

const CATEGORY_OPTIONS = [
  'فواكه', 'خضروات', 'عصائر', 'مشروبات', 'مجمدات', 'منتجات الألبان', 'حبوب', 'بقوليات', 'أخرى',
];

interface Product {
  product_id:       string;
  name_ar:          string;
  name_fr:          string | null;
  category:         string | null;
  barcode:          string | null;
  plu_code:         string | null;
  price_cents:      number;
  // null = no cost recorded, or the backend withheld it because of the caller's role.
  cost_price_cents: number | null;
  stock_quantity:   number;
  uom:              string;
  track_stock:      boolean;
  is_weighted:      boolean;
  is_bom:           boolean;
  is_active:        boolean;
  thumb_url:        string | null;
}

// Roles the backend returns cost_price_cents to (must match GET /products).
const COST_ROLES = ['INVENTORY', 'MANAGER', 'SUPERVISOR', 'OWNER'];
// Margin below this percentage (or negative) is shown in red.
const LOW_MARGIN_PCT = 15;

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_MAX_BYTES = 20 * 1024 * 1024;

type Mode = 'list' | 'add' | 'edit';

const MAD = (cents: number) => (cents / 100).toFixed(2);
const CENTS = (mad: string) => Math.round(parseFloat(mad || '0') * 100);

export default function ProductsPage() {
  const router = useRouter();
  const { t, dir } = useLanguage();
  const tp = t.products;

  const [token,    setToken]    = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [mode,     setMode]     = useState<Mode>('list');
  const [editing,  setEditing]  = useState<Product | null>(null);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [search,   setSearch]   = useState('');
  const [catFilter, setCatFilter] = useState('');

  const [nameAr,     setNameAr]     = useState('');
  const [nameFr,     setNameFr]     = useState('');
  const [category,   setCategory]   = useState('');
  const [barcode,    setBarcode]    = useState('');
  const [pluCode,    setPluCode]    = useState('');
  const [priceMAD,   setPriceMAD]   = useState('');
  const [costMAD,    setCostMAD]    = useState('');
  const [canSeeCost, setCanSeeCost] = useState(false);
  const [stockQty,   setStockQty]   = useState('');
  const [uom,        setUom]        = useState('UNIT');
  const [trackStock, setTrackStock] = useState(false);
  const [isWeighted, setIsWeighted] = useState(false);
  const [isActive,   setIsActive]   = useState(true);

  // Image: imageUrl is what the server holds; pendingFile/localPreview exist only
  // while adding a product that has not been created yet.
  const [imageUrl,       setImageUrl]       = useState<string | null>(null);
  const [pendingFile,    setPendingFile]    = useState<File | null>(null);
  const [localPreview,   setLocalPreview]   = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError,     setImageError]     = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Margin of the form's current price/cost. Null (line hidden) when the cost is
  // empty or zero (0 is how a missing cost was stored), or there is no price.
  const marginPct = (() => {
    if (!canSeeCost) return null;
    const price = parseFloat(priceMAD);
    const cost  = parseFloat(costMAD);
    if (!(price > 0) || !(cost > 0)) return null;
    return ((price - cost) / price) * 100;
  })();

  useEffect(() => {
    const tk = sessionStorage.getItem('greengo_token') ?? localStorage.getItem('greengo_token') ?? '';
    const r  = sessionStorage.getItem('greengo_cashier_role') ?? '';
    if (!tk) { router.replace('/'); return; }
    if (!['INVENTORY', 'MANAGER', 'SUPERVISOR', 'OWNER'].includes(r)) {
      router.replace('/pos');
      return;
    }
    setCanSeeCost(COST_ROLES.includes(r));
    setToken(tk);
  }, [router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/products', { headers: { authorization: `Bearer ${token}` } });
      if (res.ok) setProducts((await res.json()) as Product[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { void load(); }, [load]);

  function resetImage() {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setPendingFile(null);
    setLocalPreview(null);
    setImageUrl(null);
    setImageError('');
    setImageUploading(false);
  }

  async function uploadImage(productId: string, file: File): Promise<string | null> {
    const form = new FormData();
    form.append('image', file);
    try {
      const res = await fetch(`/api/products/${productId}/image`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { thumbUrl?: string };
      return data.thumbUrl ?? null;
    } catch {
      return null;
    }
  }

  async function handleImageSelected(file: File | undefined) {
    if (!file) return;
    setImageError('');
    if (!IMAGE_TYPES.includes(file.type)) { setImageError(tp.imageInvalidType); return; }
    if (file.size > IMAGE_MAX_BYTES) { setImageError(tp.imageTooBig); return; }

    if (localPreview) URL.revokeObjectURL(localPreview);
    const preview = URL.createObjectURL(file);
    setLocalPreview(preview);

    if (mode === 'edit' && editing) {
      setImageUploading(true);
      const url = await uploadImage(editing.product_id, file);
      setImageUploading(false);
      URL.revokeObjectURL(preview);
      setLocalPreview(null);
      if (url) {
        setImageUrl(`${url}?v=${Date.now()}`);
        await load();
      } else {
        setImageError(tp.errorSave);
      }
    } else {
      setPendingFile(file);
    }
  }

  async function handleRemoveImage() {
    setImageError('');
    if (localPreview || pendingFile) {
      if (localPreview) URL.revokeObjectURL(localPreview);
      setLocalPreview(null);
      setPendingFile(null);
      return;
    }
    if (mode === 'edit' && editing && imageUrl) {
      setImageUploading(true);
      try {
        const res = await fetch(`/api/products/${editing.product_id}/image`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${token}` },
        });
        if (res.ok) { setImageUrl(null); await load(); }
        else setImageError(tp.errorSave);
      } catch {
        setImageError(tp.errorConnection);
      } finally {
        setImageUploading(false);
      }
    }
  }

  function openAdd() {
    resetImage();
    setEditing(null);
    setNameAr(''); setNameFr(''); setCategory(''); setBarcode(''); setPluCode('');
    setPriceMAD(''); setCostMAD(''); setStockQty('0'); setUom('UNIT');
    setTrackStock(false); setIsWeighted(false); setIsActive(true);
    setError(''); setSuccess('');
    setMode('add');
  }

  function openEdit(p: Product) {
    resetImage();
    setImageUrl(p.thumb_url);
    setEditing(p);
    setNameAr(p.name_ar);
    setNameFr(p.name_fr ?? '');
    setCategory(p.category ?? '');
    setBarcode(p.barcode ?? '');
    setPluCode(p.plu_code ?? '');
    setPriceMAD(MAD(p.price_cents));
    setCostMAD(canSeeCost && p.cost_price_cents != null ? MAD(p.cost_price_cents) : '');
    setStockQty(String(p.stock_quantity));
    setUom(p.uom);
    setTrackStock(p.track_stock);
    setIsWeighted(p.is_weighted);
    setIsActive(p.is_active);
    setError(''); setSuccess('');
    setMode('edit');
  }

  // Cost is sent only when it must change. An empty field never becomes 0:
  //  - role without cost access  → nothing
  //  - empty, no cost before     → nothing
  //  - empty, cost set before    → null (the user cleared it on purpose)
  //  - unchanged                 → nothing (keeps invoice-driven updates intact)
  function costPatch(): { cost_price_cents?: number | null } {
    if (!canSeeCost) return {};
    const before = mode === 'edit' ? (editing?.cost_price_cents ?? null) : null;
    if (costMAD.trim() === '') return before !== null ? { cost_price_cents: null } : {};
    const cents = CENTS(costMAD);
    return cents === before ? {} : { cost_price_cents: cents };
  }

  async function handleSave() {
    setError(''); setSuccess('');
    if (!nameAr.trim()) { setError(tp.errorNameRequired); return; }

    const body = {
      name_ar:          nameAr.trim(),
      name_fr:          nameFr.trim() || null,
      category:         category || null,
      barcode:          barcode.trim() || null,
      plu_code:         pluCode.trim() || null,
      price_cents:      CENTS(priceMAD),
      ...costPatch(),
      stock_quantity:   parseFloat(stockQty || '0'),
      uom,
      track_stock:      trackStock,
      is_weighted:      isWeighted,
      ...(mode === 'edit' ? { is_active: isActive } : {}),
    };

    try {
      const url    = mode === 'add' ? '/api/products' : `/api/products/${editing!.product_id}`;
      const method = mode === 'add' ? 'POST' : 'PATCH';
      const res = await fetch(url, {
        method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as { error?: string; product_id?: string };
      if (!res.ok) { setError(data.error ?? tp.errorSave); return; }

      // A new product exists only now, so a picked image is uploaded after creation.
      let imageFailed = false;
      if (mode === 'add' && pendingFile && data.product_id) {
        imageFailed = (await uploadImage(data.product_id, pendingFile)) === null;
      }

      setSuccess(mode === 'add' ? tp.successAdd : tp.successEdit);
      if (imageFailed) setError(tp.errorSave);
      await load();
      setTimeout(() => { setMode('list'); setSuccess(''); setError(''); }, imageFailed ? 3000 : 1200);
    } catch {
      setError(tp.errorConnection);
    }
  }

  async function handleDelete(p: Product) {
    if (!confirm(tp.confirmDeleteMsg.replace('{name}', p.name_ar))) return;
    await fetch(`/api/products/${p.product_id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    await load();
  }

  const cashierRole = typeof window !== 'undefined'
    ? (sessionStorage.getItem('greengo_cashier_role') ?? '')
    : '';
  const canDelete = ['MANAGER', 'SUPERVISOR', 'OWNER'].includes(cashierRole);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name_ar.includes(q) || (p.name_fr ?? '').toLowerCase().includes(q)
      || (p.barcode ?? '').includes(q) || (p.plu_code ?? '').includes(q);
    const matchCat = !catFilter || p.category === catFilter;
    return matchSearch && matchCat;
  });

  const uomLabel = (u: string) => (tp.uomLabels as Record<string, string>)[u] ?? u;

  return (
    <div dir={dir} style={{ minHeight: '100vh', background: '#0A2318', fontFamily: 'system-ui, sans-serif' }}>
      <header style={{
        background: '#0F3D2A', borderBottom: '1px solid rgba(255,255,255,0.07)',
        padding: '0 1.5rem', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => router.push('/pos')}
            style={{
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '8px', color: 'rgba(255,255,255,0.6)', padding: '0.4rem 0.8rem',
              cursor: 'pointer', fontSize: '0.82rem',
            }}
          >← POS</button>
          <BrandLockup height={32} alt={t.brand.logoAlt} />
          <h1 style={{ color: '#F0B429', fontWeight: 800, fontSize: '1.1rem', margin: 0 }}>
            🛒 {tp.title}
          </h1>
        </div>
        {mode === 'list' && (
          <button
            onClick={openAdd}
            style={{
              background: '#F0B429', color: '#0A2318', fontWeight: 700, border: 'none',
              borderRadius: '10px', padding: '0.5rem 1.1rem', cursor: 'pointer', fontSize: '0.9rem',
            }}
          >{tp.add}</button>
        )}
      </header>

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem' }}>
        {mode === 'list' && (
          <>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tp.searchProducts}
                style={{
                  flex: 1, minWidth: '180px', padding: '0.6rem 0.9rem',
                  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none',
                }}
              />
              <select
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value)}
                style={{
                  padding: '0.6rem 0.9rem', background: '#0F3D2A',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                  color: catFilter ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: '0.88rem', outline: 'none',
                }}
              >
                <option value="">{tp.allCategories}</option>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              {[
                { label: tp.statsTotal,    value: products.length,                              color: 'rgba(240,180,41,0.8)' },
                { label: tp.statsActive,   value: products.filter((p) => p.is_active).length,  color: 'rgba(16,185,129,0.8)' },
                { label: tp.statsInactive, value: products.filter((p) => !p.is_active).length, color: 'rgba(239,68,68,0.8)' },
              ].map((s) => (
                <div key={s.label} style={{
                  background: '#0F3D2A', borderRadius: '10px', padding: '0.5rem 1rem',
                  border: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', gap: '0.5rem',
                }}>
                  <span style={{ color: s.color, fontWeight: 800, fontSize: '1.1rem' }}>{s.value}</span>
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem' }}>{s.label}</span>
                </div>
              ))}
            </div>

            {loading && <p style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>{tp.loading}</p>}
            {!loading && filtered.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{tp.noProducts}</p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {filtered.map((p) => (
                <div key={p.product_id} style={{
                  background: '#0F3D2A', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '14px', padding: '0.85rem 1.1rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  opacity: p.is_active ? 1 : 0.5,
                }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0,
                    marginInlineEnd: '0.85rem', background: 'rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {p.thumb_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumb_url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '1.1rem' }}>📷</span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                      <span style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{p.name_ar}</span>
                      {p.name_fr && (
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.78rem' }}>{p.name_fr}</span>
                      )}
                      {p.category && (
                        <span style={{
                          background: 'rgba(46,139,87,0.25)', color: 'rgba(110,231,183,0.9)',
                          borderRadius: '999px', padding: '0.1rem 0.55rem', fontSize: '0.7rem',
                        }}>{p.category}</span>
                      )}
                      {!p.is_active && (
                        <span style={{
                          background: 'rgba(239,68,68,0.15)', color: '#FCA5A5',
                          borderRadius: '999px', padding: '0.1rem 0.55rem', fontSize: '0.7rem',
                        }}>{tp.inactiveBadge}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                      <span style={{ color: '#F0B429', fontSize: '0.85rem', fontWeight: 700 }}>
                        {MAD(p.price_cents)} د.م
                      </span>
                      {p.plu_code && (
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem' }}>PLU: {p.plu_code}</span>
                      )}
                      {p.barcode && (
                        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.78rem' }}>📦 {p.barcode}</span>
                      )}
                      {p.track_stock && (
                        <span style={{ color: p.stock_quantity > 0 ? 'rgba(110,231,183,0.8)' : 'rgba(252,165,165,0.8)', fontSize: '0.78rem' }}>
                          {tp.stockLabel}: {p.stock_quantity} {uomLabel(p.uom)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginInlineStart: '0.75rem' }}>
                    <button
                      onClick={() => openEdit(p)}
                      style={{
                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '8px', color: '#fff', padding: '0.35rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem',
                      }}
                    >{tp.edit}</button>
                    {canDelete && (
                      <button
                        onClick={() => void handleDelete(p)}
                        style={{
                          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
                          borderRadius: '8px', color: '#FCA5A5', padding: '0.35rem 0.7rem', cursor: 'pointer', fontSize: '0.8rem',
                        }}
                      >{tp.delete}</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {(mode === 'add' || mode === 'edit') && (
          <div style={{
            background: '#0F3D2A', borderRadius: '20px', padding: '1.75rem',
            border: '1px solid rgba(255,255,255,0.08)', maxWidth: '560px', margin: '0 auto',
          }}>
            <h2 style={{ color: '#F0B429', fontWeight: 700, fontSize: '1.1rem', marginBottom: '1.25rem' }}>
              {mode === 'add' ? tp.addTitle : `${tp.editPrefix}${editing?.name_ar}`}
            </h2>

            {/* Image: 120×120 preview box, click to choose a file */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ position: 'relative', width: '120px', height: '120px', flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageUploading}
                  aria-label={tp.uploadImage}
                  style={{
                    width: '120px', height: '120px', borderRadius: '14px', overflow: 'hidden', padding: 0,
                    cursor: imageUploading ? 'wait' : 'pointer', background: 'rgba(255,255,255,0.05)',
                    border: '2px dashed rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.5)', fontSize: '2rem',
                  }}
                >
                  {(localPreview ?? imageUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={localPreview ?? imageUrl ?? ''}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : '📷'}
                </button>
                {(localPreview || imageUrl) && !imageUploading && (
                  <button
                    type="button"
                    onClick={() => void handleRemoveImage()}
                    aria-label={tp.removeImage}
                    title={tp.removeImage}
                    style={{
                      position: 'absolute', top: '-8px', insetInlineEnd: '-8px', width: '28px', height: '28px',
                      borderRadius: '50%', border: 'none', background: '#DC2626', color: '#fff',
                      cursor: 'pointer', fontWeight: 800, lineHeight: 1,
                    }}
                  >×</button>
                )}
                {imageUploading && (
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '14px', background: 'rgba(10,35,24,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      width: '28px', height: '28px', border: '3px solid rgba(240,180,41,0.25)',
                      borderTop: '3px solid #F0B429', borderRadius: '50%', animation: 'img-spin 0.8s linear infinite',
                    }} />
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => { void handleImageSelected(e.target.files?.[0]); e.target.value = ''; }}
                />
              </div>
              <div>
                <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                  {imageUploading ? tp.imageUploading : tp.uploadImage}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem', margin: '0.2rem 0 0' }}>{tp.imageHint}</p>
                {imageError && (
                  <p style={{ color: '#FCA5A5', fontSize: '0.78rem', margin: '0.35rem 0 0' }}>{imageError}</p>
                )}
              </div>
              <style>{`@keyframes img-spin { to { transform: rotate(360deg) } }`}</style>
            </div>

            {[
              { label: `${tp.nameAr} *`, value: nameAr, set: setNameAr, dir: 'rtl' as const },
              { label: tp.nameFr,        value: nameFr, set: setNameFr, dir: 'ltr' as const },
            ].map((f) => (
              <div key={f.label} style={{ marginBottom: '0.9rem' }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                  {f.label}
                </label>
                <input
                  value={f.value} onChange={(e) => f.set(e.target.value)} dir={f.dir}
                  style={{
                    width: '100%', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                    color: '#fff', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}

            <div style={{ marginBottom: '0.9rem' }}>
              <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                {tp.category}
              </label>
              <select
                value={category} onChange={(e) => setCategory(e.target.value)}
                style={{
                  width: '100%', padding: '0.65rem 0.85rem', background: '#0A2318',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                  color: category ? '#fff' : 'rgba(255,255,255,0.4)', fontSize: '0.88rem', outline: 'none',
                }}
              >
                <option value="">{tp.categoryPlaceholder}</option>
                {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.9rem' }}>
              {[
                { label: tp.barcode, value: barcode, set: setBarcode },
                { label: tp.plu,     value: pluCode, set: setPluCode },
              ].map((f) => (
                <div key={f.label} style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                    {f.label}
                  </label>
                  <input
                    value={f.value} onChange={(e) => f.set(e.target.value)} dir="ltr"
                    style={{
                      width: '100%', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                      color: '#fff', fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: marginPct !== null ? '0.4rem' : '0.9rem' }}>
              {[
                { label: tp.price, value: priceMAD, set: setPriceMAD },
                ...(canSeeCost ? [{ label: tp.cost, value: costMAD, set: setCostMAD }] : []),
              ].map((f) => (
                <div key={f.label} style={{ flex: 1 }}>
                  <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                    {f.label}
                  </label>
                  <input
                    type="number" min="0" step="0.01"
                    value={f.value} onChange={(e) => f.set(e.target.value)} dir="ltr"
                    style={{
                      width: '100%', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                      color: '#fff', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
            </div>

            {marginPct !== null && (
              <p style={{
                margin: '0 0 0.9rem', fontSize: '0.82rem', fontWeight: 600,
                color: marginPct < LOW_MARGIN_PCT ? '#f87171' : '#4ade80',
              }}>
                {tp.margin}: <span dir="ltr">{marginPct.toFixed(1)}%</span>
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.9rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                  {tp.stockQty}
                </label>
                <input
                  type="number" min="0" step="0.001"
                  value={stockQty} onChange={(e) => setStockQty(e.target.value)} dir="ltr"
                  style={{
                    width: '100%', padding: '0.65rem 0.85rem', background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                    color: '#fff', fontSize: '0.92rem', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: 'rgba(255,255,255,0.55)', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
                  {tp.uom}
                </label>
                <select
                  value={uom} onChange={(e) => setUom(e.target.value)}
                  style={{
                    width: '100%', padding: '0.65rem 0.85rem', background: '#0A2318',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px',
                    color: '#fff', fontSize: '0.88rem', outline: 'none',
                  }}
                >
                  {UOM_OPTIONS.map((u) => <option key={u} value={u}>{uomLabel(u)}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.1rem' }}>
              {[
                { label: tp.trackStock,  value: trackStock,  set: setTrackStock  },
                { label: tp.isWeighted,  value: isWeighted,  set: setIsWeighted  },
                ...(mode === 'edit' ? [{ label: tp.isActive, value: isActive, set: setIsActive }] : []),
              ].map((tog) => (
                <label key={tog.label} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                  <div
                    onClick={() => tog.set(!tog.value)}
                    style={{
                      width: '40px', height: '22px', borderRadius: '999px',
                      background: tog.value ? '#2E8B57' : 'rgba(255,255,255,0.15)',
                      position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: '3px',
                      insetInlineStart: tog.value ? '21px' : '3px',
                      width: '16px', height: '16px', borderRadius: '50%',
                      background: '#fff', transition: 'inset-inline-start 0.2s',
                    }} />
                  </div>
                  <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.85rem' }}>{tog.label}</span>
                </label>
              ))}
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '8px', padding: '0.6rem 1rem', color: '#FCA5A5',
                fontSize: '0.85rem', marginBottom: '1rem',
              }}>{error}</div>
            )}
            {success && (
              <div style={{
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)',
                borderRadius: '8px', padding: '0.6rem 1rem', color: '#6EE7B7',
                fontSize: '0.85rem', marginBottom: '1rem',
              }}>{success}</div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => void handleSave()}
                style={{
                  flex: 1, padding: '0.85rem', background: '#F0B429', color: '#0A2318',
                  fontWeight: 700, border: 'none', borderRadius: '12px', cursor: 'pointer', fontSize: '0.95rem',
                }}
              >{mode === 'add' ? tp.addButton : tp.save}</button>
              <button
                onClick={() => setMode('list')}
                style={{
                  padding: '0.85rem 1.25rem', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px',
                  color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.9rem',
                }}
              >{tp.cancel}</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
