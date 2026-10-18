'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../context/LanguageContext';
import { apiFetch } from '../../lib/api';
import { formatPrice } from '../../lib/cart';
import type { Product } from '../../lib/cart';
import type { Lang, Translations } from '../../lib/i18n';
import { formatMoney } from '../../lib/format';
import { pickName } from '../../lib/names';

// Invoice OCR scan button is opt-in — shown only when the backend OCR provider
// is configured and this flag is set.
const OCR_ENABLED = process.env['NEXT_PUBLIC_OCR_ENABLED'] === 'true';

// One line as returned by POST /api/invoices/ocr.
interface OcrLineResult {
  rawText: string;
  productId: string | null;
  productNameAr: string;
  productNameFr: string;
  productNameExtracted: string;
  matched: boolean;
  matchScore: number;
  quantityGuess: number | null;
  unitCostPiastres: number | null;
  confidence: number;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  supplier_id: string;
  name: string;
  name_ar: string | null;
  name_fr: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  balance: number | string | null;
  created_at: string;
}

interface PoLine {
  productId: string;
  productLabel: string;
  quantityReceived: number;
  unitCostPiastres: number | '';
  notes: string;
}

interface PoSummaryRow {
  po_id: string;
  received_at: string;
  status: 'draft' | 'received' | 'cancelled';
  total_cost_piastres: number;
  notes: string | null;
  supplier_name: string | null;
  line_count: number;
}

type Tab = 'suppliers' | 'receiving' | 'ledger';

interface ReorderSuggestion {
  productId: string;
  predictedUnits7d: number;
  suggestedReorderQty: number;
  trainedOn: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function localeOf(lang: string): string {
  return lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-GB';
}

function formatDate(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(localeOf(lang), {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

// Date-only values ('YYYY-MM-DD') parse as UTC midnight; render them in UTC so the day never shifts.
function formatDay(iso: string, lang: string) {
  return new Date(iso).toLocaleDateString(localeOf(lang), {
    year: 'numeric', month: 'short', day: 'numeric',
    ...(iso.length === 10 ? { timeZone: 'UTC' } : {}),
  });
}

function supplierLabel(s: Supplier, lang: string): string {
  return pickName(lang, s.name_ar, s.name_fr) || s.name;
}

// ─── Supplier List Tab ───────────────────────────────────────────────────────

interface SupplierListProps {
  suppliers: Supplier[];
  onRefresh: () => void;
  lang: string;
  t: Translations['suppliers'];
}

function SupplierList({ suppliers, onRefresh, lang, t }: SupplierListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', address: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => { setForm({ name: '', phone: '', address: '', notes: '' }); setError(''); };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError(t.errorNameRequired); return; }
    setSaving(true);
    try {
      const res = await apiFetch(
        editId ? `/api/suppliers/${editId}` : '/api/suppliers',
        {
          method: editId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name.trim(),
            phone: form.phone || null,
            address: form.address || null,
            notes: form.notes || null,
          }),
        },
      );
      if (!res.ok) { const d = await res.json() as { error: string }; setError(d.error); return; }
      resetForm();
      setShowForm(false);
      setEditId(null);
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  const startEdit = (s: Supplier) => {
    setEditId(s.supplier_id);
    setForm({ name: s.name, phone: s.phone ?? '', address: s.address ?? '', notes: s.notes ?? '' });
    setShowForm(true);
    setError('');
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          onClick={() => { resetForm(); setEditId(null); setShowForm(true); }}
          className="px-4 py-2 bg-[#2E8B57] text-white text-sm font-medium rounded-xl hover:bg-[#1A5C3A] transition-colors"
        >
          + {t.add}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3">
          <h3 className="font-semibold text-sm text-[#0F172A]">{editId ? t.name : t.add}</h3>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={t.name + ' *'}
            className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57]"
          />
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            placeholder={t.phone}
            dir="ltr"
            className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57]"
          />
          <input
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder={t.address}
            className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57]"
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            placeholder={t.notes}
            rows={2}
            className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#2E8B57]"
          />
          <div className="flex gap-2">
            <button
              onClick={() => void handleSubmit()}
              disabled={saving}
              className="flex-1 py-2 bg-[#2E8B57] text-white text-sm font-medium rounded-xl disabled:opacity-50"
            >
              {saving ? '…' : '✓'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditId(null); resetForm(); }}
              className="flex-1 py-2 border border-[#E2E8F0] text-sm rounded-xl"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {suppliers.length === 0 ? (
        <p className="text-center text-[#94A3B8] py-12 text-sm">{t.noSuppliers}</p>
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <div key={s.supplier_id} className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[#0F172A]">{supplierLabel(s, lang)}</p>
                  {s.phone && <p className="text-xs text-[#64748B] mt-0.5"><span dir="ltr">{s.phone}</span></p>}
                  {s.address && <p className="text-xs text-[#94A3B8] truncate">{s.address}</p>}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    onClick={() => startEdit(s)}
                    className="text-xs px-2 py-1 border border-[#E2E8F0] rounded-lg text-[#64748B] hover:bg-[#F1F5F9]"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => void handleDelete(s.supplier_id)}
                    className="text-xs px-2 py-1 border border-red-200 rounded-lg text-red-500 hover:bg-red-50"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Receiving Tab ────────────────────────────────────────────────────────────

interface ReceivingTabProps {
  suppliers: Supplier[];
  products: Product[];
  lang: string;
  rt: Translations['suppliers']['receiving'];
}

interface DemandForecastSuggestion {
  suggestedReorderQty: number;
  insufficientData: boolean;
}

function ReceivingTab({ suppliers, products, lang, rt }: ReceivingTabProps) {
  const [subView, setSubView] = useState<'new' | 'history'>('new');
  const [supplierId, setSupplierId] = useState('');
  const [receivingNotes, setReceivingNotes] = useState('');
  const [lines, setLines] = useState<PoLine[]>([
    { productId: '', productLabel: '', quantityReceived: 1, unitCostPiastres: '', notes: '' },
  ]);
  const [demandSuggestions, setDemandSuggestions] = useState<Record<string, DemandForecastSuggestion | null>>({});
  const [history, setHistory] = useState<PoSummaryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    updatedProducts: string[];
    lineCount: number;
    totalCost: number;
  } | null>(null);
  const [formError, setFormError] = useState('');
  // OCR scan state (only used when OCR_ENABLED).
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState('');
  const [ocrBanner, setOcrBanner] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleInvoiceScan = async (file: File) => {
    setOcrError('');
    setOcrBanner(null);
    setImagePreview(URL.createObjectURL(file));
    setOcrLoading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('language', 'ar+fr');
      const res = await apiFetch('/api/invoices/ocr', { method: 'POST', body: fd });
      if (res.status === 422) {
        setOcrError(rt.ocrNotConfigured);
        return;
      }
      if (!res.ok) {
        setOcrError(rt.ocrError);
        return;
      }
      const data = (await res.json()) as {
        lines: OcrLineResult[];
        matchedCount: number;
        lineCount: number;
      };
      const usable = data.lines.filter((l) => l.confidence >= 0.3);
      if (usable.length === 0) {
        setOcrError(rt.ocrError);
        return;
      }
      setLines(
        usable.map((l) => ({
          productId: l.productId ?? '',
          productLabel: l.matched
            ? pickName(lang, l.productNameAr, l.productNameFr)
            : l.productNameExtracted,
          quantityReceived: l.quantityGuess ?? 1,
          unitCostPiastres: l.unitCostPiastres ?? '',
          notes: l.matched ? '' : `OCR: ${l.productNameExtracted}`,
        })),
      );
      setOcrBanner(
        rt.ocrSuccess
          .replace('{n}', String(usable.length))
          .replace('{m}', String(data.matchedCount)),
      );
    } catch {
      setOcrError(rt.ocrError);
    } finally {
      setOcrLoading(false);
    }
  };

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await apiFetch('/api/purchase-orders?limit=30');
      if (res.ok) setHistory((await res.json()) as PoSummaryRow[]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (subView === 'history') void loadHistory();
  }, [subView, loadHistory]);

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { productId: '', productLabel: '', quantityReceived: 1, unitCostPiastres: '', notes: '' },
    ]);

  const removeLine = (idx: number) =>
    setLines((prev) => prev.filter((_, i) => i !== idx));

  const updateLine = (idx: number, patch: Partial<PoLine>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));

  const selectProduct = (idx: number, productId: string) => {
    const p = products.find((x) => x.product_id === productId);
    updateLine(idx, {
      productId,
      productLabel: p ? pickName(lang, p.name_ar, p.name_fr) : '',
    });
    // Fetch demand forecast suggestion when a product is selected
    if (productId) {
      setDemandSuggestions((prev) => ({ ...prev, [productId]: null }));
      void apiFetch(`/api/ml/demand-forecast/${productId}`)
        .then(async (res) => {
          if (!res.ok) return;
          const data = (await res.json()) as {
            suggestedReorderQty: number;
            forecasts: Array<{ horizonDays: number; insufficientData: boolean }>;
          };
          const sevenDay = data.forecasts.find((f) => f.horizonDays === 7);
          setDemandSuggestions((prev) => ({
            ...prev,
            [productId]: {
              suggestedReorderQty: data.suggestedReorderQty,
              insufficientData: sevenDay?.insufficientData ?? true,
            },
          }));
        })
        .catch(() => { /* forecast is non-critical — ignore errors */ });
    }
  };

  const lineTotal = (line: PoLine): number | null => {
    if (line.unitCostPiastres === '' || line.unitCostPiastres == null) return null;
    return Number(line.unitCostPiastres) * line.quantityReceived;
  };

  const grandTotal = lines.reduce((sum, l) => {
    const t = lineTotal(l);
    return t != null ? sum + t : sum;
  }, 0);

  const handleConfirm = async () => {
    setFormError('');
    const validLines = lines.filter((l) => l.productId && l.quantityReceived > 0);
    if (validLines.length === 0) {
      setFormError(rt.errorNoProducts);
      return;
    }
    setSubmitting(true);
    try {
      // Create draft PO
      const createRes = await apiFetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierId || undefined,
          notes: receivingNotes || undefined,
          lines: validLines.map((l) => ({
            productId: l.productId,
            quantityReceived: l.quantityReceived,
            unitCostPiastres: l.unitCostPiastres !== '' ? Number(l.unitCostPiastres) : undefined,
            notes: l.notes || undefined,
          })),
        }),
      });
      if (!createRes.ok) {
        const d = await createRes.json() as { error: string };
        setFormError(d.error);
        return;
      }
      const { po_id } = await createRes.json() as { po_id: string };

      // Confirm PO — atomic stock + lot update
      const confirmRes = await apiFetch(`/api/purchase-orders/${po_id}/confirm`, {
        method: 'POST',
      });
      if (!confirmRes.ok) {
        const d = await confirmRes.json() as { error: string };
        setFormError(d.error);
        return;
      }
      const result = await confirmRes.json() as {
        updated_products: string[];
        line_count: number;
        total_cost_piastres: number;
      };
      setSuccessResult({
        updatedProducts: result.updated_products,
        lineCount: result.line_count,
        totalCost: result.total_cost_piastres,
      });
      // Reset form
      setLines([{ productId: '', productLabel: '', quantityReceived: 1, unitCostPiastres: '', notes: '' }]);
      setSupplierId('');
      setReceivingNotes('');
    } finally {
      setSubmitting(false);
    }
  };

  if (successResult) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 px-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-bold text-[#0F172A]">{rt.confirmed}</h2>
        <div className="bg-white border border-[#E2E8F0] rounded-2xl p-5 w-full max-w-sm space-y-2 text-sm text-[#475569]">
          <p>
            <span className="font-semibold text-[#0F172A]">{successResult.lineCount}</span>{' '}
            {rt.productsUpdated}
          </p>
          {successResult.updatedProducts.length > 0 && (
            <p className="text-xs text-[#64748B]">{successResult.updatedProducts.join(', ')}</p>
          )}
          {successResult.totalCost > 0 && (
            <p>
              {rt.totalCost}:{' '}
              <span className="font-semibold text-[#0F172A]">
                {formatPrice(successResult.totalCost)}
              </span>
            </p>
          )}
          <div className="mt-3 pt-3 border-t border-[#E2E8F0] text-xs text-[#2E8B57] font-medium">
            ⏱ {rt.markdownClockReset}
          </div>
        </div>
        <button
          onClick={() => setSuccessResult(null)}
          className="mt-4 px-6 py-2 bg-[#2E8B57] text-white text-sm font-medium rounded-xl hover:bg-[#1A5C3A]"
        >
          {rt.newDelivery}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Sub-view tabs */}
      <div className="flex gap-1 bg-[#F1F5F9] p-1 rounded-xl">
        <button
          onClick={() => setSubView('new')}
          className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-colors ${
            subView === 'new' ? 'bg-white shadow-sm text-[#0F172A]' : 'text-[#64748B]'
          }`}
        >
          + {rt.newDelivery}
        </button>
        <button
          onClick={() => setSubView('history')}
          className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-colors ${
            subView === 'history' ? 'bg-white shadow-sm text-[#0F172A]' : 'text-[#64748B]'
          }`}
        >
          {rt.history}
        </button>
      </div>

      {subView === 'new' ? (
        <div className="space-y-4">
          {/* Supplier + notes */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3">
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">{rt.supplier}</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57] bg-white"
              >
                <option value="">— {rt.supplier} —</option>
                {suppliers.map((s) => (
                  <option key={s.supplier_id} value={s.supplier_id}>{supplierLabel(s, lang)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-[#64748B] block mb-1">{rt.notes}</label>
              <input
                value={receivingNotes}
                onChange={(e) => setReceivingNotes(e.target.value)}
                className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57]"
              />
            </div>
          </div>

          {/* Invoice OCR scan — additive; manual entry always remains available */}
          {OCR_ENABLED && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleInvoiceScan(f);
                  e.target.value = ''; // allow re-selecting the same file
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={ocrLoading}
                className="w-full py-2.5 rounded-xl border border-[#2E8B57] text-[#2E8B57] text-sm font-semibold hover:bg-[#F0FDF4] transition-colors disabled:opacity-50"
              >
                {ocrLoading ? rt.ocrScanning : rt.ocrScan}
              </button>
              {imagePreview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="invoice" className="w-full max-h-48 object-contain rounded-xl border border-[#E2E8F0]" />
              )}
              {ocrBanner && (
                <div className="text-sm text-[#2E8B57] bg-[#F0FDF4] border border-[#2E8B57]/30 rounded-xl px-3 py-2">
                  {ocrBanner}
                </div>
              )}
              {ocrError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {ocrError}
                </div>
              )}
            </div>
          )}

          {/* Product lines */}
          <div className="space-y-2">
            {lines.map((line, idx) => (
              <div key={idx} className="bg-white border border-[#E2E8F0] rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#64748B]">{rt.product} {idx + 1}</span>
                  {lines.length > 1 && (
                    <button
                      onClick={() => removeLine(idx)}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <select
                  value={line.productId}
                  onChange={(e) => selectProduct(idx, e.target.value)}
                  className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57] bg-white ${
                    !line.productId && line.productLabel
                      ? 'border-amber-400'
                      : 'border-[#E2E8F0]'
                  }`}
                >
                  <option value="">— {rt.product} —</option>
                  {products.map((p) => (
                    <option key={p.product_id} value={p.product_id}>
                      {pickName(lang, p.name_ar, p.name_fr)}
                      {p.plu_code ? ` (${p.plu_code})` : ''}
                    </option>
                  ))}
                </select>
                {/* ML demand forecast suggestion */}
                {line.productId && demandSuggestions[line.productId] && !demandSuggestions[line.productId]!.insufficientData && demandSuggestions[line.productId]!.suggestedReorderQty > 0 && (
                  <p className="text-xs text-[#2E8B57] bg-[#F0FDF4] rounded-lg px-2 py-1">
                    {rt.forecastSuggestion.replace('{n}', String(demandSuggestions[line.productId]!.suggestedReorderQty))}
                  </p>
                )}
                {/* Unmatched OCR line: name detected but no product resolved */}
                {!line.productId && line.productLabel && (
                  <p className="text-xs text-amber-600">
                    {rt.ocrUnmatched}
                    <span className="text-[#94A3B8]"> · “{line.productLabel}”</span>
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-[#94A3B8] block mb-0.5">{rt.quantity}</label>
                    <input
                      type="number"
                      dir="ltr"
                      min={1}
                      value={line.quantityReceived}
                      onChange={(e) => updateLine(idx, { quantityReceived: Math.max(1, parseInt(e.target.value) || 1) })}
                      className="w-full border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#2E8B57]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-[#94A3B8] block mb-0.5">{rt.unitCostPiastres}</label>
                    <input
                      type="number"
                      dir="ltr"
                      min={0}
                      value={line.unitCostPiastres}
                      onChange={(e) => updateLine(idx, { unitCostPiastres: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
                      placeholder={rt.optional}
                      className="w-full border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#2E8B57]"
                    />
                  </div>
                </div>
                {lineTotal(line) != null && (
                  <p className="text-xs text-[#2E8B57] font-medium text-end">
                    {rt.totalCost}: {formatPrice(lineTotal(line)!)}
                  </p>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={addLine}
            className="w-full py-2 border-2 border-dashed border-[#E2E8F0] text-sm text-[#94A3B8] rounded-xl hover:border-[#2E8B57] hover:text-[#2E8B57] transition-colors"
          >
            + {rt.addLine}
          </button>

          {grandTotal > 0 && (
            <div className="bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-4 py-2 flex justify-between items-center">
              <span className="text-sm font-medium text-[#166534]">{rt.totalCost}</span>
              <span className="text-sm font-bold text-[#166534]">{formatPrice(grandTotal)}</span>
            </div>
          )}

          {formError && <p className="text-sm text-red-500 text-center">{formError}</p>}

          <button
            onClick={() => void handleConfirm()}
            disabled={submitting || lines.every((l) => !l.productId)}
            className="w-full py-3 bg-[#2E8B57] text-white font-semibold rounded-2xl hover:bg-[#1A5C3A] disabled:opacity-50 transition-colors"
          >
            {submitting ? '…' : `✓ ${rt.confirm}`}
          </button>
        </div>
      ) : (
        /* History sub-view */
        <div className="space-y-2">
          {historyLoading ? (
            <p className="text-center text-[#94A3B8] text-sm py-8">…</p>
          ) : history.length === 0 ? (
            <p className="text-center text-[#94A3B8] text-sm py-8">{rt.history}</p>
          ) : (
            history.map((po) => (
              <div key={po.po_id} className="bg-white border border-[#E2E8F0] rounded-2xl p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-[#0F172A]">
                      {po.supplier_name ?? '—'}
                    </p>
                    <p className="text-xs text-[#64748B] mt-0.5">{formatDate(po.received_at, lang)}</p>
                    <p className="text-xs text-[#94A3B8]">
                      {po.line_count} {rt.productsCount}
                      {po.total_cost_piastres > 0 && ` · ${formatPrice(po.total_cost_piastres)}`}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${
                    po.status === 'received'
                      ? 'bg-green-100 text-green-800'
                      : po.status === 'cancelled'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {rt[po.status]}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ledger Tab ───────────────────────────────────────────────────────────────

interface InvoiceLine {
  line_id: string;
  description_ar: string;
  description_fr: string | null;
  quantity: number | string;
  unit: string;
  unit_cost_mad: number | string;
  line_total_mad: number | string;
}

interface Invoice {
  invoice_id: string;
  invoice_ref: string | null;
  invoice_date: string;
  due_date: string | null;
  status: 'unpaid' | 'partial' | 'paid' | 'cancelled';
  total_mad: number | string;
  paid_mad: number | string;
  remaining_mad: number | string;
  lines?: InvoiceLine[];
}

interface Payment {
  payment_id: string;
  amount_mad: number | string;
  method: string;
  payment_date: string;
  reference: string | null;
}

// Returned by POST /suppliers/:id/invoices (Cost Shield). Money is in cents.
interface CostAlert {
  product_id: string;
  name_ar: string;
  name_fr: string;
  previous_cost_cents: number | null;
  new_cost_cents: number;
  increase_pct: number | null;
  price_cents: number;
  margin_before_pct: number | null;
  margin_after_pct: number | null;
  reason: 'price_increase' | 'below_cost';
}

// `search` is the product-picker text; it is never sent to the backend.
const newInvLine = () => ({
  description_ar: '', description_fr: '', quantity: '1', unit: 'unit',
  unit_cost_mad: '', product_id: '', search: '',
});

const PICKER_MAX_RESULTS = 6;

interface LedgerTabProps {
  suppliers: Supplier[];
  products: Product[];
  lang: Lang;
  lt: Translations['suppliers']['ledger'];
}

function LedgerTab({ suppliers, products, lang, lt }: LedgerTabProps) {
  const [selectedId, setSelectedId]     = useState<string>('');
  const [subView, setSubView]           = useState<'invoices' | 'payments'>('invoices');
  const [invoices, setInvoices]         = useState<Invoice[]>([]);
  const [payments, setPayments]         = useState<Payment[]>([]);
  const [expandedInv, setExpandedInv]   = useState<string | null>(null);
  const [loadingInv, setLoadingInv]     = useState(false);
  const [showInvForm, setShowInvForm]   = useState(false);
  const [showPayForm, setShowPayForm]   = useState(false);
  const [saving, setSaving]             = useState(false);
  const [formError, setFormError]       = useState('');
  const [costAlerts, setCostAlerts]     = useState<CostAlert[]>([]);

  const [invForm, setInvForm] = useState({
    invoice_ref: '', invoice_date: '', due_date: '', tax_mad: '', notes: '',
    lines: [newInvLine()],
  });

  const [payForm, setPayForm] = useState({
    amount_mad: '', method: 'cash', reference: '', payment_date: '', notes: '', invoice_id: '',
  });

  const selectedSupplier = suppliers.find((s) => s.supplier_id === selectedId);

  const loadStatement = useCallback(async (id: string) => {
    if (!id) return;
    setLoadingInv(true);
    try {
      const res = await apiFetch(`/api/suppliers/${id}/statement`);
      if (res.ok) {
        const data = await res.json() as { invoices: Invoice[]; payments: Payment[] };
        setInvoices(data.invoices ?? []);
        setPayments(data.payments ?? []);
      }
    } finally {
      setLoadingInv(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadStatement(selectedId);
  }, [selectedId, loadStatement]);

  const statusBadgeClass = (s: Invoice['status']) => {
    if (s === 'paid')      return 'bg-green-100 text-green-800';
    if (s === 'partial')   return 'bg-amber-100 text-amber-800';
    if (s === 'cancelled') return 'bg-gray-100 text-gray-500';
    return 'bg-red-100 text-red-700';
  };

  const statusLabel = (s: Invoice['status']) => {
    const map: Record<Invoice['status'], string> = {
      unpaid: lt.statusUnpaid, partial: lt.statusPartial,
      paid: lt.statusPaid, cancelled: lt.statusCancelled,
    };
    return map[s] ?? s;
  };

  const handleSaveInvoice = async () => {
    if (!selectedId) return;
    const lines = invForm.lines.filter((l) => l.description_ar.trim() && Number(l.quantity) > 0 && Number(l.unit_cost_mad) > 0);
    if (!lines.length) { setFormError(lt.errorNoLines); return; }
    setSaving(true); setFormError('');
    try {
      const res = await apiFetch(`/api/suppliers/${selectedId}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_ref: invForm.invoice_ref || undefined,
          invoice_date: invForm.invoice_date || undefined,
          due_date: invForm.due_date || undefined,
          tax_mad: invForm.tax_mad ? Number(invForm.tax_mad) : undefined,
          notes: invForm.notes || undefined,
          lines: lines.map((l) => ({
            description_ar: l.description_ar,
            description_fr: l.description_fr || undefined,
            quantity: Number(l.quantity),
            unit: l.unit,
            unit_cost_mad: Number(l.unit_cost_mad),
            product_id: l.product_id || undefined,
          })),
        }),
      });
      if (!res.ok) { const d = await res.json() as { error: string }; setFormError(d.error); return; }
      const saved = await res.json().catch(() => ({})) as { cost_alerts?: CostAlert[] };
      setCostAlerts(saved.cost_alerts ?? []);
      setShowInvForm(false);
      setInvForm({ invoice_ref: '', invoice_date: '', due_date: '', tax_mad: '', notes: '', lines: [newInvLine()] });
      void loadStatement(selectedId);
    } finally { setSaving(false); }
  };

  const handleSavePayment = async () => {
    if (!selectedId || !payForm.amount_mad) { setFormError(lt.errorAmountRequired); return; }
    setSaving(true); setFormError('');
    try {
      const res = await apiFetch(`/api/suppliers/${selectedId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_mad: Number(payForm.amount_mad),
          method: payForm.method,
          reference: payForm.reference || undefined,
          payment_date: payForm.payment_date || undefined,
          notes: payForm.notes || undefined,
          invoice_id: payForm.invoice_id || undefined,
        }),
      });
      if (!res.ok) { const d = await res.json() as { error: string }; setFormError(d.error); return; }
      setShowPayForm(false);
      setPayForm({ amount_mad: '', method: 'cash', reference: '', payment_date: '', notes: '', invoice_id: '' });
      void loadStatement(selectedId);
    } finally { setSaving(false); }
  };

  const addInvLine = () => setInvForm((f) => ({
    ...f,
    lines: [...f.lines, newInvLine()],
  }));

  const pickProduct = (i: number, p: Product) =>
    updateInvLine(i, { product_id: p.product_id, search: '', description_ar: p.name_ar, description_fr: p.name_fr });

  const matchProducts = (term: string): Product[] => {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) =>
        p.name_ar.toLowerCase().includes(q) || p.name_fr.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q) || (p.plu_code ?? '').toLowerCase().includes(q))
      .slice(0, PICKER_MAX_RESULTS);
  };

  const updateInvLine = (i: number, patch: Partial<typeof invForm.lines[0]>) =>
    setInvForm((f) => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, ...patch } : l) }));

  const removeInvLine = (i: number) =>
    setInvForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));

  const balanceNum = parseFloat(String(selectedSupplier?.balance ?? '0'));
  const methodLabel = (m: string) => (lt.paymentMethods as Record<string, string>)[m] ?? m;

  return (
    <div className="space-y-4">
      {/* Supplier selector */}
      <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4">
        <label className="text-xs font-medium text-[#64748B] block mb-1">{lt.selectSupplier}</label>
        <select
          value={selectedId}
          onChange={(e) => { setSelectedId(e.target.value); setShowInvForm(false); setShowPayForm(false); setFormError(''); setCostAlerts([]); }}
          className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#2E8B57]"
        >
          <option value="">—</option>
          {suppliers.map((s) => (
            <option key={s.supplier_id} value={s.supplier_id}>
              {supplierLabel(s, lang)}
              {parseFloat(String(s.balance ?? '0')) > 0
                ? ` · ${parseFloat(String(s.balance)).toFixed(2)} ${lt.currency}`
                : ''}
            </option>
          ))}
        </select>
        {selectedSupplier && (
          <div className={`mt-2 text-sm font-semibold rounded-lg px-3 py-1.5 inline-block ${
            balanceNum > 0 ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'
          }`}>
            {lt.balance}: {balanceNum.toFixed(2)} {lt.currency}
          </div>
        )}
      </div>

      {selectedId && (
        <>
          {/* Sub-tabs */}
          <div className="flex gap-1 bg-[#F1F5F9] p-1 rounded-xl">
            {(['invoices', 'payments'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setSubView(v)}
                className={`flex-1 text-sm py-1.5 rounded-lg font-medium transition-colors ${
                  subView === v ? 'bg-white shadow-sm text-[#0F172A]' : 'text-[#64748B]'
                }`}
              >
                {v === 'invoices' ? lt.invoices : lt.payments}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => { setShowInvForm(!showInvForm); setShowPayForm(false); setFormError(''); }}
              className="flex-1 py-2 text-sm font-medium rounded-xl border border-[#2E8B57] text-[#2E8B57] hover:bg-[#F0FDF4]"
            >
              + {lt.newInvoice}
            </button>
            <button
              onClick={() => { setShowPayForm(!showPayForm); setShowInvForm(false); setFormError(''); }}
              className="flex-1 py-2 text-sm font-medium rounded-xl border border-[#FF9800] text-[#FF9800] hover:bg-orange-50"
            >
              ✓ {lt.recordPayment}
            </button>
          </div>

          {formError && <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">{formError}</p>}

          {/* Cost Shield: information only, no price is changed automatically */}
          {costAlerts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-amber-900">{lt.costAlertsTitle}</h3>
                  <p className="text-xs text-amber-800 mt-0.5">{lt.costAlertsHint}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setCostAlerts([])}
                  className="text-xs text-amber-900 border border-amber-300 rounded-lg px-2 py-1 shrink-0 min-h-[32px]"
                >
                  {lt.dismiss}
                </button>
              </div>
              {costAlerts.map((a, idx) => (
                <div key={`${a.product_id}-${idx}`} className="bg-white border border-amber-200 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-[#0F172A]">{pickName(lang, a.name_ar, a.name_fr)}</span>
                    {a.reason === 'below_cost' && (
                      <span className="text-xs font-semibold bg-red-100 text-red-700 rounded-full px-2 py-0.5 shrink-0">
                        {lt.belowCost}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-[#475569]">
                    <span>{lt.costOld}: {a.previous_cost_cents !== null ? formatMoney(a.previous_cost_cents / 100, lang) : '—'}</span>
                    <span>{lt.costNew}: {formatMoney(a.new_cost_cents / 100, lang)}</span>
                    <span>
                      {lt.costIncrease}: <span dir="ltr">{a.increase_pct !== null ? `${a.increase_pct > 0 ? '+' : ''}${a.increase_pct.toFixed(1)}%` : '—'}</span>
                    </span>
                    <span />
                    <span>{lt.marginBefore}: <span dir="ltr">{a.margin_before_pct !== null ? `${a.margin_before_pct.toFixed(1)}%` : '—'}</span></span>
                    <span className={a.margin_after_pct !== null && a.margin_after_pct < 0 ? 'text-red-600 font-medium' : ''}>
                      {lt.marginAfter}: <span dir="ltr">{a.margin_after_pct !== null ? `${a.margin_after_pct.toFixed(1)}%` : '—'}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* New invoice form */}
          {showInvForm && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#0F172A]">{lt.newInvoice}</h3>
              <div className="grid grid-cols-2 gap-2">
                <input dir="ltr" value={invForm.invoice_ref} onChange={(e) => setInvForm((f) => ({ ...f, invoice_ref: e.target.value }))}
                  placeholder={lt.invoiceRef} className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57]" />
                <input type="date" value={invForm.invoice_date} onChange={(e) => setInvForm((f) => ({ ...f, invoice_date: e.target.value }))}
                  placeholder={lt.invoiceDate} className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57]" />
                <input type="date" value={invForm.due_date} onChange={(e) => setInvForm((f) => ({ ...f, due_date: e.target.value }))}
                  placeholder={lt.dueDate} className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57]" />
                <input type="number" dir="ltr" min={0} value={invForm.tax_mad} onChange={(e) => setInvForm((f) => ({ ...f, tax_mad: e.target.value }))}
                  placeholder={`${lt.tax} (${lt.currency})`} className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57]" />
              </div>
              {invForm.lines.map((line, i) => (
                <div key={i} className="border border-[#E2E8F0] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#64748B]">{lt.description} {i + 1}</span>
                    {invForm.lines.length > 1 && (
                      <button onClick={() => removeInvLine(i)} className="text-xs text-red-400">✕</button>
                    )}
                  </div>
                  {line.product_id ? (
                    <div className="flex items-center justify-between gap-2 bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-3 py-1.5">
                      <span className="text-sm text-[#166534] truncate">
                        {(() => {
                          const p = products.find((x) => x.product_id === line.product_id);
                          return p ? pickName(lang, p.name_ar, p.name_fr) : line.description_ar;
                        })()}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateInvLine(i, { product_id: '' })}
                        className="text-xs text-[#64748B] shrink-0"
                      >
                        {lt.clearProduct}
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        value={line.search}
                        onChange={(e) => updateInvLine(i, { search: e.target.value })}
                        placeholder={`${lt.product} — ${lt.searchProduct}`}
                        className="w-full border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#2E8B57]"
                      />
                      {line.search.trim() !== '' && (
                        <div className="absolute z-10 start-0 end-0 mt-1 bg-white border border-[#E2E8F0] rounded-xl shadow-md overflow-hidden">
                          {matchProducts(line.search).length === 0 ? (
                            <p className="px-3 py-2 text-xs text-[#94A3B8]">{lt.noProductMatch}</p>
                          ) : matchProducts(line.search).map((p) => (
                            <button
                              key={p.product_id}
                              type="button"
                              onClick={() => pickProduct(i, p)}
                              className="block w-full text-start px-3 py-2 text-sm hover:bg-[#F0FDF4]"
                            >
                              {pickName(lang, p.name_ar, p.name_fr)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <input value={line.description_ar} onChange={(e) => updateInvLine(i, { description_ar: e.target.value })}
                    placeholder={lt.description + ' *'} className="w-full border border-[#E2E8F0] rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:border-[#2E8B57]" />
                  <div className="grid grid-cols-3 gap-2">
                    <input type="number" dir="ltr" min={0.001} step={0.001} value={line.quantity} onChange={(e) => updateInvLine(i, { quantity: e.target.value })}
                      placeholder={lt.quantity} className="border border-[#E2E8F0] rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:border-[#2E8B57]" />
                    <input value={line.unit} onChange={(e) => updateInvLine(i, { unit: e.target.value })}
                      placeholder={lt.unit} className="border border-[#E2E8F0] rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:border-[#2E8B57]" />
                    <input type="number" dir="ltr" min={0} step={0.01} value={line.unit_cost_mad} onChange={(e) => updateInvLine(i, { unit_cost_mad: e.target.value })}
                      placeholder={lt.unitCost} className="border border-[#E2E8F0] rounded-xl px-2 py-1.5 text-sm focus:outline-none focus:border-[#2E8B57]" />
                  </div>
                  {line.quantity && line.unit_cost_mad && (
                    <p className="text-xs text-[#2E8B57] font-medium text-end">
                      = {(Number(line.quantity) * Number(line.unit_cost_mad)).toFixed(2)} {lt.currency}
                    </p>
                  )}
                </div>
              ))}
              <button onClick={addInvLine} className="w-full py-1.5 border-2 border-dashed border-[#E2E8F0] text-xs text-[#94A3B8] rounded-xl hover:border-[#2E8B57] hover:text-[#2E8B57]">
                + {lt.addLine}
              </button>
              <div className="flex gap-2">
                <button onClick={() => void handleSaveInvoice()} disabled={saving}
                  className="flex-1 py-2 bg-[#2E8B57] text-white text-sm font-medium rounded-xl disabled:opacity-50">
                  {saving ? '…' : lt.save}
                </button>
                <button onClick={() => setShowInvForm(false)} className="flex-1 py-2 border border-[#E2E8F0] text-sm rounded-xl">
                  {lt.cancel}
                </button>
              </div>
            </div>
          )}

          {/* Record payment form */}
          {showPayForm && (
            <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-[#0F172A]">{lt.recordPayment}</h3>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" dir="ltr" min={0.01} step={0.01} value={payForm.amount_mad} onChange={(e) => setPayForm((f) => ({ ...f, amount_mad: e.target.value }))}
                  placeholder={`${lt.total} (${lt.currency}) *`} className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57]" />
                <select value={payForm.method} onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}
                  className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#2E8B57]">
                  {['cash', 'bank_transfer', 'cheque', 'mobile', 'other'].map((m) => (
                    <option key={m} value={m}>{methodLabel(m)}</option>
                  ))}
                </select>
                <input dir="ltr" value={payForm.reference} onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
                  placeholder={lt.payReference} className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57]" />
                <input type="date" value={payForm.payment_date} onChange={(e) => setPayForm((f) => ({ ...f, payment_date: e.target.value }))}
                  className="border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#2E8B57]" />
              </div>
              {invoices.filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled').length > 0 && (
                <div>
                  <label className="text-xs text-[#64748B] block mb-1">{lt.invoices}</label>
                  <select value={payForm.invoice_id} onChange={(e) => setPayForm((f) => ({ ...f, invoice_id: e.target.value }))}
                    className="w-full border border-[#E2E8F0] rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-[#2E8B57]">
                    <option value="">— {lt.invoices} ({lt.optional}) —</option>
                    {invoices.filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled').map((inv) => (
                      <option key={inv.invoice_id} value={inv.invoice_id}>
                        {inv.invoice_ref ?? inv.invoice_id.slice(0, 8)} · {parseFloat(String(inv.remaining_mad)).toFixed(2)} {lt.currency}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => void handleSavePayment()} disabled={saving}
                  className="flex-1 py-2 bg-[#FF9800] text-white text-sm font-medium rounded-xl disabled:opacity-50">
                  {saving ? '…' : lt.save}
                </button>
                <button onClick={() => setShowPayForm(false)} className="flex-1 py-2 border border-[#E2E8F0] text-sm rounded-xl">
                  {lt.cancel}
                </button>
              </div>
            </div>
          )}

          {/* List */}
          {loadingInv ? (
            <p className="text-center text-[#94A3B8] text-sm py-8">…</p>
          ) : subView === 'invoices' ? (
            invoices.length === 0 ? (
              <p className="text-center text-[#94A3B8] text-sm py-8">{lt.noInvoices}</p>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv) => (
                  <div key={inv.invoice_id} className="bg-white border border-[#E2E8F0] rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setExpandedInv(expandedInv === inv.invoice_id ? null : inv.invoice_id)}
                      className="w-full p-3 flex items-start gap-3 text-start"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#0F172A]">
                            {inv.invoice_ref ?? inv.invoice_id.slice(0, 8)}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClass(inv.status)}`}>
                            {statusLabel(inv.status)}
                          </span>
                        </div>
                        <p className="text-xs text-[#64748B] mt-0.5">{formatDay(inv.invoice_date, lang)}</p>
                        <div className="flex gap-3 mt-1 text-xs text-[#475569]">
                          <span>{lt.total}: <b>{parseFloat(String(inv.total_mad)).toFixed(2)}</b></span>
                          {parseFloat(String(inv.remaining_mad)) > 0 && (
                            <span className="text-amber-700">{lt.remaining}: {parseFloat(String(inv.remaining_mad)).toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[#94A3B8] text-xs">{expandedInv === inv.invoice_id ? '▲' : '▼'}</span>
                    </button>
                    {expandedInv === inv.invoice_id && inv.lines && inv.lines.length > 0 && (
                      <div className="border-t border-[#F1F5F9] px-3 py-2 space-y-1">
                        {inv.lines.map((line) => (
                          <div key={line.line_id} className="flex justify-between items-baseline text-xs text-[#475569]">
                            <span className="flex-1 truncate">{line.description_ar}</span>
                            <span className="shrink-0 ms-2">{line.quantity} × {parseFloat(String(line.unit_cost_mad)).toFixed(2)} = {parseFloat(String(line.line_total_mad)).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : (
            payments.length === 0 ? (
              <p className="text-center text-[#94A3B8] text-sm py-8">{lt.noPayments}</p>
            ) : (
              <div className="space-y-2">
                {payments.map((p) => (
                  <div key={p.payment_id} className="bg-white border border-[#E2E8F0] rounded-2xl p-3 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold text-[#0F172A]">{parseFloat(String(p.amount_mad)).toFixed(2)} {lt.currency}</p>
                      <p className="text-xs text-[#64748B]">{methodLabel(p.method)} · {formatDay(p.payment_date, lang)}</p>
                      {p.reference && <p className="text-xs text-[#94A3B8]">{p.reference}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const router = useRouter();
  const { t, lang, dir } = useLanguage();
  const st = t.suppliers;
  const rt = t.suppliers.receiving;
  const lt = t.suppliers.ledger;

  // Role guard mirrors analytics/page.tsx exactly: read role from sessionStorage
  // on mount (client-only), show an access-denied screen for non-managers.
  // The real security boundary is the backend — every /suppliers and
  // /purchase-orders route is gated with allowedRoles ['MANAGER','SUPERVISOR']
  // + JWT, so an unauthorized client sees no data even if it reaches this shell.
  const [role, setRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('suppliers');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Reorder alerts from ML demand forecasts
  const [reorderAlerts, setReorderAlerts] = useState<ReorderSuggestion[]>([]);
  const [showReorder, setShowReorder] = useState(false);

  useEffect(() => {
    setRole(sessionStorage.getItem('greengo_cashier_role'));
  }, []);

  // Fetch data only once an authorized role is confirmed.
  useEffect(() => {
    if (role !== 'MANAGER' && role !== 'SUPERVISOR') return;

    void apiFetch('/api/suppliers')
      .then((res) => res.ok ? res.json() as Promise<Supplier[]> : [])
      .then(setSuppliers);

    void apiFetch('/api/products')
      .then((res) => res.ok ? res.json() as Promise<Product[]> : [])
      .then(setProducts);

    void apiFetch('/api/ml/reorder-suggestions')
      .then((res) => res.ok ? res.json() as Promise<ReorderSuggestion[]> : [])
      .then((data) => setReorderAlerts(data.slice(0, 10)))
      .catch(() => {/* ML service unavailable — silent */});
  }, [role]);

  const reloadSuppliers = useCallback(() => {
    void apiFetch('/api/suppliers')
      .then((res) => res.ok ? res.json() as Promise<Supplier[]> : [])
      .then(setSuppliers);
  }, []);

  // Access denied — same pattern as analytics/page.tsx.
  if (role !== null && role !== 'MANAGER' && role !== 'SUPERVISOR') {
    return (
      <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] p-8 max-w-md text-center shadow-sm">
          <p className="text-4xl mb-4">🔒</p>
          <p className="text-lg font-bold text-[#0F172A]">{t.analytics.accessDenied}</p>
          <button
            onClick={() => router.push('/pos')}
            className="mt-6 px-6 py-2 rounded-xl bg-[#2E8B57] text-white font-medium hover:bg-[#1A5C3A] transition-colors"
          >
            ← {t.analytics.backToPos}
          </button>
        </div>
      </main>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'suppliers', label: st.title },
    { key: 'receiving', label: rt.title },
    { key: 'ledger', label: lt.title },
  ];

  return (
    <main className="min-h-screen bg-[#F8FAFC]" dir={dir}>
      {/* Header */}
      <div className="bg-white border-b border-[#E2E8F0] px-4 py-4 flex items-center gap-3">
        <button
          onClick={() => router.push('/pos')}
          className="text-[#64748B] hover:text-[#0F172A] text-sm font-medium"
        >
          ← POS
        </button>
        <h1 className="text-lg font-bold text-[#0F172A]">{st.title}</h1>
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-[#E2E8F0] px-4">
        <div className="flex gap-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-[#2E8B57] text-[#2E8B57]'
                  : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Reorder Alerts — ML demand forecast summary */}
      {reorderAlerts.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="bg-white rounded-xl border border-[#E0E0E0] overflow-hidden">
            <button
              onClick={() => setShowReorder((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-[#1A1A1A] hover:bg-[#F5F5F0] transition-colors"
            >
              <span>⚠️ {t.forecast.reorderTitle} ({reorderAlerts.length})</span>
              <span className="text-[#757575] text-xs">{showReorder ? '▲' : '▼'}</span>
            </button>
            {showReorder && (
              <div className="divide-y divide-[#E0E0E0]">
                {reorderAlerts.map((alert) => {
                  const prod = products.find((p) => p.product_id === alert.productId);
                  const name = (prod && pickName(lang, prod.name_ar, prod.name_fr)) || alert.productId;
                  const stock = prod?.stock_quantity ?? null;
                  const isOut  = stock === 0;
                  const isLow  = stock !== null && !isOut && stock < (prod?.low_stock_threshold ?? 5);
                  return (
                    <div
                      key={alert.productId}
                      className="flex items-center justify-between px-4 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: isOut ? '#D32F2F' : isLow ? '#F0B429' : '#2E8B57' }}
                        />
                        <span className="text-[#1A1A1A] font-medium">{name}</span>
                      </div>
                      <div className="text-[#757575] text-xs text-end">
                        {stock !== null && (
                          <span
                            className="font-semibold"
                            style={{ color: isOut ? '#D32F2F' : isLow ? '#F0B429' : '#757575' }}
                          >
                            {t.products.stockLabel}: {stock}
                          </span>
                        )}
                        <span className="ms-2">
                          {st.suggestedQty}: {alert.suggestedReorderQty}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-2xl mx-auto p-4">
        {activeTab === 'suppliers' ? (
          <SupplierList suppliers={suppliers} onRefresh={reloadSuppliers} lang={lang} t={st} />
        ) : activeTab === 'receiving' ? (
          <ReceivingTab suppliers={suppliers} products={products} lang={lang} rt={rt} />
        ) : (
          <LedgerTab suppliers={suppliers} products={products} lang={lang} lt={lt} />
        )}
      </div>
    </main>
  );
}
