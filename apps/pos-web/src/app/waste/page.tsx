'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  WASTE_THRESHOLDS,
  findProductByCode,
  type Product,
  type WasteRecord,
  type WasteReasonCode,
} from '../../lib/cart';
import { useLanguage } from '../../context/LanguageContext';
import ManagerPinModal from '../../components/ManagerPinModal';
import BarcodeScanner from '../../components/BarcodeScanner';
import { apiFetch } from '../../lib/api';
import { pickName } from '../../lib/names';

const REASONS: WasteReasonCode[] = ['SPOILED', 'EXPIRED', 'PREP_DAMAGE', 'OTHER'];

const REASON_BADGE: Record<WasteReasonCode, string> = {
  SPOILED: 'bg-red-50 text-red-700 border-red-200',
  EXPIRED: 'bg-orange-50 text-orange-700 border-orange-200',
  PREP_DAMAGE: 'bg-amber-50 text-amber-700 border-amber-200',
  OTHER: 'bg-gray-50 text-gray-600 border-gray-200',
};

function timeAgo(iso: string, lang: 'ar' | 'fr' | 'en'): string {
  const locale = lang === 'ar' ? 'ar-MA' : lang === 'fr' ? 'fr-MA' : 'en-GB';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 60) return rtf.format(-mins, 'minute');
  return rtf.format(-Math.floor(mins / 60), 'hour');
}

export default function WastePage() {
  const router = useRouter();
  const { t, lang } = useLanguage();
  const [shiftId, setShiftId] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [recentRecords, setRecentRecords] = useState<WasteRecord[]>([]);
  const [lastHash, setLastHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantityInput, setQuantityInput] = useState('');
  const [reasonCode, setReasonCode] = useState<WasteReasonCode | null>(null);
  const [notes, setNotes] = useState('');

  const [showManagerModal, setShowManagerModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Initial load ────────────────────────────────────────────────────────
  useEffect(() => {
    const sid = sessionStorage.getItem('greengo_shift_id');
    const cashier = sessionStorage.getItem('greengo_cashier_id');
    if (!sid) {
      router.push('/');
      return;
    }
    setShiftId(sid);
    setStaffId(cashier);

    void Promise.all([
      apiFetch('/api/products').then(async (r) => (r.ok ? ((await r.json()) as Product[]) : [])),
      apiFetch(`/api/waste?shiftId=${encodeURIComponent(sid)}`).then(async (r) =>
        r.ok ? ((await r.json()) as WasteRecord[]) : [],
      ),
      apiFetch(`/api/waste/last-hash?shiftId=${encodeURIComponent(sid)}`).then(async (r) =>
        r.ok ? ((await r.json()) as { lastHash: string | null }) : { lastHash: null },
      ),
    ])
      .then(([prods, records, hash]) => {
        setProducts(prods);
        setRecentRecords(records);
        setLastHash(hash.lastHash);
      })
      .finally(() => setLoading(false));
  }, [router]);

  // ── Derived state ───────────────────────────────────────────────────────
  const isWeighted = selectedProduct?.is_weighted ?? false;
  const rawQty = parseFloat(quantityInput);
  const validQty = Number.isFinite(rawQty) && rawQty > 0;

  // Convert to grams: weighted = grams directly, units = pcs × 100g
  const quantityGrams = useMemo(() => {
    if (!validQty) return 0;
    return isWeighted ? Math.round(rawQty) : Math.round(rawQty * 100);
  }, [validQty, rawQty, isWeighted]);

  const requiresApproval = useMemo(() => {
    if (!validQty || !selectedProduct) return false;
    return isWeighted
      ? quantityGrams > WASTE_THRESHOLDS.weightedGrams
      : rawQty > WASTE_THRESHOLDS.unitCount;
  }, [validQty, selectedProduct, isWeighted, quantityGrams, rawQty]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products.slice(0, 30);
    return products
      .filter(
        (p) =>
          p.name_ar.toLowerCase().includes(term) ||
          p.name_fr.toLowerCase().includes(term) ||
          (p.barcode ?? '').includes(term) ||
          (p.plu_code ?? '').toLowerCase().includes(term),
      )
      .slice(0, 30);
  }, [products, search]);

  const productDisplayName = (p: Product): string => pickName(lang, p.name_ar, p.name_fr);

  const canSubmit = !!selectedProduct && validQty && !!reasonCode && !submitting && !!shiftId && !!staffId;

  // ── Submit handler ──────────────────────────────────────────────────────
  const submitWaste = async (approvedByManagerId: string | null) => {
    if (!shiftId || !staffId || !selectedProduct || !reasonCode) return;
    setSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await apiFetch('/api/waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId,
          productId: selectedProduct.product_id,
          quantityGrams,
          reasonCode,
          notes: notes.trim() ? notes.trim() : undefined,
          approvedByManagerId: approvedByManagerId ?? undefined,
          recordedByStaffId: staffId,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        wasteRecordId?: string;
        chainHash?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
      }

      // Reset form
      setSelectedProduct(null);
      setQuantityInput('');
      setReasonCode(null);
      setNotes('');
      setSearch('');
      setSuccessMessage(t.waste.success);
      setTimeout(() => setSuccessMessage(null), 2000);

      // Refresh recent + chain head
      const [recordsRes, hashRes] = await Promise.all([
        apiFetch(`/api/waste?shiftId=${encodeURIComponent(shiftId)}`),
        apiFetch(`/api/waste/last-hash?shiftId=${encodeURIComponent(shiftId)}`),
      ]);
      if (recordsRes.ok) setRecentRecords((await recordsRes.json()) as WasteRecord[]);
      if (hashRes.ok) {
        const h = (await hashRes.json()) as { lastHash: string | null };
        setLastHash(h.lastHash);
      }
    } catch (err: unknown) {
      console.error('[waste] submit failed:', err);
      setErrorMessage(err instanceof Error ? err.message : t.waste.errorSubmit);
    } finally {
      setSubmitting(false);
    }
  };

  const handleWasteBarcodeScanned = (code: string) => {
    const product = findProductByCode(code, products);
    if (product) {
      setSelectedProduct(product);
      setSearch('');
    } else {
      setSearch(code);
    }
  };

  const handleSubmitClick = () => {
    if (!canSubmit) return;
    setErrorMessage(null);
    if (requiresApproval) {
      setShowManagerModal(true);
      return;
    }
    void submitWaste(null);
  };

  // Render quantity for a stored record (reverse the conversion for unit products)
  const formatRecordQty = (record: WasteRecord): string => {
    // We don't have is_weighted from the record itself; look it up by productId
    const product = products.find((p) => p.product_id === record.productId);
    if (product?.is_weighted) {
      return `${record.quantityGrams.toFixed(0)} ${t.waste.unitGrams}`;
    }
    return `${(record.quantityGrams / 100).toFixed(0)} ${t.waste.unitPieces}`;
  };

  return (
    <main className="min-h-screen bg-[#F8FAFC] py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <button
              onClick={() => router.push('/pos')}
              className="text-sm text-[#64748B] hover:text-[#0F172A] mb-2"
            >
              ← {t.waste.backToPos}
            </button>
            <h1 className="text-2xl font-bold text-[#0F172A]">{t.waste.title}</h1>
            <p className="text-sm text-[#64748B] mt-1">{t.waste.subtitle}</p>
          </div>
          {lastHash && (
            <div
              className="text-xs text-[#94A3B8] font-mono bg-white border border-[#E2E8F0] rounded-lg px-3 py-2"
              title={t.waste.chainTooltip}
            >
              🔗 {t.waste.chainHashLabel}: {lastHash.slice(-8)}
            </div>
          )}
        </div>

        {successMessage && (
          <div className="mb-4 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700 text-center font-semibold">
            {successMessage}
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LEFT — form */}
          <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
            {/* Product selector */}
            <label className="block text-sm font-semibold text-[#0F172A] mb-2">
              {t.waste.selectProduct}
            </label>
            {!selectedProduct ? (
              <>
                <div className="flex gap-2 mb-3">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t.waste.searchProduct}
                    className="flex-1 h-11 px-3 rounded-xl border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2E8B57] focus:border-transparent text-sm"
                  />
                  <button
                    onClick={() => setShowScanner(true)}
                    className="p-2.5 rounded-xl border border-[#E2E8F0] bg-white hover:bg-[#F0FDF4] hover:border-[#2E8B57] transition-colors flex-shrink-0"
                    title={t.waste.scanBarcode}
                  >
                    📷
                  </button>
                </div>
                {loading && <p className="text-center text-[#94A3B8] text-sm py-4">…</p>}
                {!loading && (
                  <div className="max-h-56 overflow-y-auto border border-[#F1F5F9] rounded-xl divide-y divide-[#F1F5F9]">
                    {filteredProducts.map((p) => (
                      <button
                        key={p.product_id}
                        onClick={() => {
                          setSelectedProduct(p);
                          setSearch('');
                        }}
                        className="w-full text-start px-3 py-2.5 hover:bg-[#F8FAFC] flex items-center justify-between"
                      >
                        <span className="text-sm text-[#0F172A]">{productDisplayName(p)}</span>
                        <span className="text-[10px] text-[#94A3B8] uppercase">
                          {p.is_weighted ? t.waste.unitGrams : t.waste.unitPieces}
                        </span>
                      </button>
                    ))}
                    {filteredProducts.length === 0 && (
                      <p className="px-3 py-4 text-center text-sm text-[#94A3B8]">—</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-between bg-[#F0FDF4] border border-[#BBF7D0] rounded-xl px-3 py-2.5 mb-4">
                <div>
                  <p className="text-sm font-semibold text-[#0F172A]">
                    {productDisplayName(selectedProduct)}
                  </p>
                  <p className="text-[10px] text-[#94A3B8] uppercase">
                    {selectedProduct.is_weighted ? t.waste.unitGrams : t.waste.unitPieces}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setQuantityInput('');
                  }}
                  className="text-[#64748B] hover:text-red-600 text-lg leading-none px-1"
                  aria-label="✕"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Quantity (shown when product selected) */}
            {selectedProduct && (
              <>
                <label className="block text-sm font-semibold text-[#0F172A] mb-2 mt-4">
                  {t.waste.quantity}
                </label>
                <div className="relative mb-3">
                  <input
                    type="number"
                    min="1"
                    step={isWeighted ? '1' : '1'}
                    value={quantityInput}
                    onChange={(e) => setQuantityInput(e.target.value)}
                    placeholder="0"
                    className="w-full h-12 px-4 rounded-xl border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2E8B57] focus:border-transparent text-lg font-mono"
                  />
                  <span className="absolute end-4 top-1/2 -translate-y-1/2 text-sm text-[#64748B] pointer-events-none">
                    {isWeighted ? t.waste.unitGrams : t.waste.unitPieces}
                  </span>
                </div>

                {/* Threshold notice */}
                {requiresApproval && (
                  <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center gap-2">
                    <span>👔</span>
                    <span className="font-medium">{t.waste.thresholdNotice}</span>
                  </div>
                )}
              </>
            )}

            {/* Reason */}
            <label className="block text-sm font-semibold text-[#0F172A] mb-2 mt-4">
              {t.waste.reasonHeading}
            </label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setReasonCode(r)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    reasonCode === r
                      ? 'bg-[#2E8B57] text-white'
                      : 'bg-white border border-[#E2E8F0] text-[#64748B] hover:border-[#2E8B57]'
                  }`}
                >
                  {t.waste.reason[r]}
                </button>
              ))}
            </div>

            {/* Notes */}
            <label className="block text-sm font-semibold text-[#0F172A] mb-2 mt-4">
              {t.waste.notes}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 200))}
              placeholder={t.waste.notesPlaceholder}
              maxLength={200}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2E8B57] focus:border-transparent text-sm resize-none"
            />
            <p className="text-[10px] text-[#94A3B8] mt-1 text-end">
              {200 - notes.length} {t.waste.charactersRemaining}
            </p>

            {errorMessage && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 text-center">
                {errorMessage}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmitClick}
              disabled={!canSubmit}
              className="w-full mt-6 bg-[#2E8B57] hover:bg-[#1A5C3A] text-white font-semibold py-3 rounded-xl text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? t.waste.submitting : t.waste.submit}
            </button>
          </div>

          {/* RIGHT — recent records */}
          <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#0F172A]">{t.waste.recentHeading}</h2>
              {recentRecords.length > 0 && (
                <span className="bg-[#F0FDF4] text-[#2E8B57] text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  {recentRecords.length}
                </span>
              )}
            </div>

            {recentRecords.length === 0 ? (
              <p className="text-center text-sm text-[#94A3B8] py-12">{t.waste.recentEmpty}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-[#94A3B8] uppercase tracking-wide">
                      <th className="text-start pb-2 font-semibold w-8">#</th>
                      <th className="text-start pb-2 font-semibold">{t.waste.colProduct}</th>
                      <th className="text-end pb-2 font-semibold">{t.waste.colQty}</th>
                      <th className="text-start pb-2 font-semibold">{t.waste.colReason}</th>
                      <th className="text-end pb-2 font-semibold">{t.waste.colTime}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F1F5F9]">
                    {recentRecords.map((r, i) => (
                      <tr key={r.wasteRecordId}>
                        <td className="py-2.5 text-[#94A3B8] text-xs font-mono">{i + 1}</td>
                        <td className="py-2.5 text-[#0F172A]">
                          <div>{r.productNameAr ?? '—'}</div>
                          {r.approvedByManagerId && (
                            <span className="inline-block mt-0.5 text-[9px] font-medium bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full">
                              ✓ {t.waste.approvedBy}
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 text-end font-mono text-xs text-[#0F172A]">
                          {formatRecordQty(r)}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border ${REASON_BADGE[r.reasonCode]}`}
                          >
                            {t.waste.reason[r.reasonCode]}
                          </span>
                        </td>
                        <td className="py-2.5 text-end text-[10px] text-[#94A3B8]">
                          {timeAgo(r.recordedAt, lang)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manager PIN modal */}
      {showManagerModal && (
        <ManagerPinModal
          action="waste_over_threshold"
          note={t.waste.thresholdNotice}
          onAuthorized={(result) => {
            setShowManagerModal(false);
            void submitWaste(result.manager_id);
          }}
          onCancel={() => setShowManagerModal(false)}
        />
      )}

      {/* Barcode scanner */}
      {showScanner && (
        <BarcodeScanner
          title={t.waste.scanProductTitle}
          onDetected={(code) => {
            setShowScanner(false);
            handleWasteBarcodeScanned(code);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </main>
  );
}
