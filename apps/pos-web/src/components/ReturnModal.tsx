'use client';

import { useState, useMemo, useCallback } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../lib/api';
import { formatPrice } from '../lib/cart';

// ── Modal state machine ──────────────────────────────────────────────────────
type ModalState =
  | 'LOOKUP'          // enter receipt number or choose freeform
  | 'LOADING'         // fetching transaction from API
  | 'SELECT_ITEMS'    // choose quantities + disposition (receipt-based)
  | 'FREEFORM_ENTRY'  // manual item list (no receipt)
  | 'MANAGER_PIN'     // manager staff-ID + PIN collection
  | 'CONFIRM'         // summary + refund method selection
  | 'PROCESSING'      // POST /api/returns in-flight
  | 'SUCCESS'         // return number + total displayed
  | 'ERROR';          // error with retry option

type Disposition = 'restock' | 'damaged' | 'discard';
type RefundMethod = 'cash' | 'card' | 'store_credit';

// ── Data shapes ──────────────────────────────────────────────────────────────
interface OriginalItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPricePiastres: number;
  alreadyReturnedQty: number;
}

interface OriginalTransaction {
  transactionId: string;
  receiptNumber: string;
  totalPiastres: number;
  paymentMethod: string;
  createdAt: string;
  items: OriginalItem[];
}

interface SelectedItem {
  productId: string;
  productName: string;
  maxQty: number;
  returnQty: number;
  unitPricePiastres: number;
  disposition: Disposition;
}

interface FreeformItem {
  id: string;
  productName: string;
  quantity: number;
  madInput: string;          // raw text input value in MAD (e.g. "15.50")
  unitPricePiastres: number; // derived: round(parseFloat(madInput) * 100)
  disposition: Disposition;
}

interface ReturnItem {
  productId?: string;
  productName: string;
  quantity: number;
  unitPricePiastres: number;
  disposition: Disposition;
}

// ── Props ────────────────────────────────────────────────────────────────────
interface ReturnModalProps {
  cashierId: string;
  shiftId: string;
  onDone: () => void;
}

// ── Threshold (env-driven, matches backend RETURN_THRESHOLD_PIASTRES) ────────
const RETURN_THRESHOLD = parseInt(
  process.env['NEXT_PUBLIC_RETURN_THRESHOLD_PIASTRES'] ?? '5000',
  10,
);

function makeId(): string {
  return Math.random().toString(36).slice(2);
}

// ── Component ────────────────────────────────────────────────────────────────
export default function ReturnModal({ cashierId, shiftId, onDone }: ReturnModalProps) {
  const { t } = useLanguage();
  const tr = t.returns;

  // Modal state
  const [modalState, setModalState] = useState<ModalState>('LOOKUP');

  // LOOKUP
  const [receiptInput, setReceiptInput] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Receipt-based flow
  const [isFreeform, setIsFreeform] = useState(false);
  const [originalTx, setOriginalTx] = useState<OriginalTransaction | null>(null);
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

  // Freeform flow
  const [freeformItems, setFreeformItems] = useState<FreeformItem[]>([
    { id: makeId(), productName: '', quantity: 1, madInput: '', unitPricePiastres: 0, disposition: 'restock' },
  ]);

  // Manager PIN
  const [managerStaffId, setManagerStaffId] = useState('');
  const [managerPin, setManagerPin] = useState('');
  // Where MANAGER_PIN should proceed after successful collection
  const [pinNextState, setPinNextState] = useState<'FREEFORM_ENTRY' | 'CONFIRM'>('CONFIRM');

  // CONFIRM
  const [refundMethod, setRefundMethod] = useState<RefundMethod>('cash');

  // SUCCESS / ERROR
  const [returnResult, setReturnResult] = useState<{ returnNumber: string; totalPiastres: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Derived: items list going into CONFIRM ──────────────────────────────
  const confirmItems = useMemo((): ReturnItem[] => {
    if (isFreeform) {
      return freeformItems
        .filter((fi) => fi.productName.trim() && fi.quantity > 0 && fi.unitPricePiastres > 0)
        .map((fi) => ({
          productName: fi.productName.trim(),
          quantity: fi.quantity,
          unitPricePiastres: fi.unitPricePiastres,
          disposition: fi.disposition,
        }));
    }
    return selectedItems
      .filter((si) => si.returnQty > 0)
      .map((si) => ({
        productId: si.productId,
        productName: si.productName,
        quantity: si.returnQty,
        unitPricePiastres: si.unitPricePiastres,
        disposition: si.disposition,
      }));
  }, [isFreeform, freeformItems, selectedItems]);

  const confirmTotal = useMemo(
    () => confirmItems.reduce((s, i) => s + i.quantity * i.unitPricePiastres, 0),
    [confirmItems],
  );

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleLookup = useCallback(async () => {
    const rn = receiptInput.trim().toUpperCase();
    if (!rn) return;
    setLookupError(null);
    setModalState('LOADING');
    try {
      const res = await apiFetch(
        `/api/transactions/by-receipt/${encodeURIComponent(rn)}`,
      );
      if (res.status === 404) {
        setLookupError(tr.receiptNotFound);
        setModalState('LOOKUP');
        return;
      }
      if (res.status === 422) {
        setLookupError(tr.fullyReturned);
        setModalState('LOOKUP');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = (await res.json()) as OriginalTransaction;
      setOriginalTx(data);
      const items: SelectedItem[] = data.items
        .filter((it) => it.alreadyReturnedQty < it.quantity)
        .map((it) => ({
          productId: it.productId,
          productName: it.productName || it.productId,
          maxQty: it.quantity - it.alreadyReturnedQty,
          returnQty: 0,
          unitPricePiastres: it.unitPricePiastres,
          disposition: 'restock',
        }));
      setSelectedItems(items);
      setModalState('SELECT_ITEMS');
    } catch {
      setLookupError(tr.error);
      setModalState('LOOKUP');
    }
  }, [receiptInput, tr]);

  const handleFreeformStart = () => {
    setIsFreeform(true);
    setPinNextState('FREEFORM_ENTRY');
    setModalState('MANAGER_PIN');
  };

  const handleSelectItemsContinue = () => {
    const hasItems = selectedItems.some((si) => si.returnQty > 0);
    if (!hasItems) return;
    const total = selectedItems.reduce(
      (s, si) => s + si.returnQty * si.unitPricePiastres, 0,
    );
    if (total > RETURN_THRESHOLD) {
      setPinNextState('CONFIRM');
      setModalState('MANAGER_PIN');
    } else {
      // Clear any stale manager PIN data if under threshold
      setManagerStaffId('');
      setManagerPin('');
      setModalState('CONFIRM');
    }
  };

  const handleFreeformContinue = () => {
    const valid = freeformItems.some(
      (fi) => fi.productName.trim() && fi.quantity > 0 && fi.unitPricePiastres > 0,
    );
    if (!valid) return;
    setModalState('CONFIRM');
  };

  const handleManagerPinApprove = () => {
    if (!managerStaffId.trim() || managerPin.length !== 4) return;
    setModalState(pinNextState);
  };

  const handleCancelFromManagerPin = () => {
    setIsFreeform(false);
    setManagerStaffId('');
    setManagerPin('');
    setModalState('LOOKUP');
  };

  const handleConfirm = useCallback(async () => {
    if (confirmItems.length === 0) return;
    setModalState('PROCESSING');
    setError(null);

    const needsManagerPin = isFreeform || confirmTotal > RETURN_THRESHOLD;

    try {
      const res = await apiFetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalReceiptNumber: originalTx?.receiptNumber ?? null,
          originalTransactionId: originalTx?.transactionId ?? null,
          isFreeform,
          items: confirmItems,
          refundMethod,
          approvingManagerId: needsManagerPin ? (managerStaffId || null) : null,
          approvalPin: needsManagerPin ? (managerPin || null) : null,
          shiftId,
          cashierId,
          clientTotalPiastres: confirmTotal,
        }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          detail?: string;
        };
        // Surface the most specific message available:
        // - detail: raw DB / internal error text (500 responses)
        // - message: human-readable description (403 responses)
        // - error: short error code
        throw new Error(errData.detail ?? errData.message ?? errData.error ?? `HTTP ${res.status}`);
      }

      const result = (await res.json()) as { returnNumber: string; totalPiastres: number };
      setReturnResult(result);
      setModalState('SUCCESS');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setModalState('ERROR');
    }
  }, [
    confirmItems, confirmTotal, isFreeform, managerPin, managerStaffId,
    originalTx, refundMethod, shiftId, cashierId,
  ]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const dispositionButton = (
    current: Disposition,
    value: Disposition,
    onSelect: (d: Disposition) => void,
  ) => {
    const label = value === 'restock' ? tr.restock : value === 'damaged' ? tr.damaged : tr.discard;
    const active = {
      restock: 'bg-green-100 border-green-300 text-green-700',
      damaged: 'bg-amber-100 border-amber-300 text-amber-700',
      discard: 'bg-red-100 border-red-300 text-red-600',
    }[value];
    return (
      <button
        key={value}
        onClick={() => onSelect(value)}
        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
          current === value ? active : 'bg-white border-[#E2E8F0] text-[#94A3B8]'
        }`}
      >
        {label}
      </button>
    );
  };

  const dispositionBadge = (d: Disposition) => {
    const classes = {
      restock: 'bg-green-100 text-green-700',
      damaged: 'bg-amber-100 text-amber-700',
      discard: 'bg-red-100 text-red-600',
    }[d];
    const label = d === 'restock' ? tr.restock : d === 'damaged' ? tr.damaged : tr.discard;
    return (
      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${classes}`}>
        {label}
      </span>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2E8F0] flex-shrink-0">
          <h2 className="text-lg font-bold text-[#0F172A]">{tr.title}</h2>
          {modalState !== 'PROCESSING' && modalState !== 'SUCCESS' && (
            <button
              onClick={onDone}
              className="text-[#94A3B8] hover:text-[#0F172A] text-2xl leading-none"
              aria-label={tr.cancel}
            >
              ×
            </button>
          )}
        </div>

        {/* ── Scrollable body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ════════════════════ LOOKUP ══════════════════════════════════ */}
          {modalState === 'LOOKUP' && (
            <div className="space-y-4">
              <input
                type="text"
                value={receiptInput}
                onChange={(e) => setReceiptInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleLookup(); }}
                placeholder={tr.lookupPlaceholder}
                className="w-full h-12 px-4 rounded-xl border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-orange-400 text-base font-mono"
              />
              {lookupError && (
                <p className="text-sm text-red-500">{lookupError}</p>
              )}
              <button
                onClick={() => void handleLookup()}
                disabled={!receiptInput.trim()}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors"
              >
                {tr.lookup}
              </button>
              <div className="relative flex items-center">
                <div className="flex-1 h-px bg-[#E2E8F0]" />
                <span className="mx-3 text-xs text-[#94A3B8]">—</span>
                <div className="flex-1 h-px bg-[#E2E8F0]" />
              </div>
              <button
                onClick={handleFreeformStart}
                className="w-full border border-[#E2E8F0] text-[#64748B] py-2.5 rounded-xl text-sm font-medium hover:bg-[#F8FAFC] transition-colors"
              >
                {tr.noReceipt}
              </button>
            </div>
          )}

          {/* ════════════════════ LOADING ════════════════════════════════ */}
          {modalState === 'LOADING' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
              <p className="text-sm text-[#64748B]">{tr.loading}</p>
            </div>
          )}

          {/* ════════════════════ SELECT_ITEMS ═══════════════════════════ */}
          {modalState === 'SELECT_ITEMS' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-[#0F172A]">{tr.selectItems}</p>
              <div className="space-y-3">
                {selectedItems.map((si, idx) => (
                  <div
                    key={si.productId}
                    className="border border-[#E2E8F0] rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-[#0F172A] truncate flex-1">
                        {si.productName}
                      </p>
                      <p className="text-xs text-[#94A3B8] font-mono flex-shrink-0">
                        {formatPrice(si.unitPricePiastres)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-[#64748B]">{tr.qty}:</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setSelectedItems((s) =>
                              s.map((x, i) =>
                                i === idx ? { ...x, returnQty: Math.max(0, x.returnQty - 1) } : x,
                              ),
                            )
                          }
                          className="w-7 h-7 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] font-bold text-sm"
                        >
                          −
                        </button>
                        <span className="min-w-[2ch] text-center font-semibold text-sm">
                          {si.returnQty}
                        </span>
                        <button
                          onClick={() =>
                            setSelectedItems((s) =>
                              s.map((x, i) =>
                                i === idx
                                  ? { ...x, returnQty: Math.min(x.maxQty, x.returnQty + 1) }
                                  : x,
                              ),
                            )
                          }
                          disabled={si.returnQty >= si.maxQty}
                          className="w-7 h-7 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] font-bold text-sm disabled:opacity-40"
                        >
                          +
                        </button>
                        <span className="text-xs text-[#94A3B8]">
                          {tr.maxQty.replace('{n}', String(si.maxQty))}
                        </span>
                      </div>
                    </div>
                    {si.returnQty > 0 && (
                      <div className="flex gap-2">
                        {(['restock', 'damaged', 'discard'] as Disposition[]).map((d) =>
                          dispositionButton(si.disposition, d, (newD) =>
                            setSelectedItems((s) =>
                              s.map((x, i) => (i === idx ? { ...x, disposition: newD } : x)),
                            ),
                          ),
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Running total */}
              <div className="flex justify-between items-center pt-2 border-t border-[#F1F5F9]">
                <span className="text-sm font-bold text-[#0F172A]">{tr.total}:</span>
                <span className="font-bold text-lg text-orange-600 font-mono">
                  {formatPrice(
                    selectedItems.reduce((s, si) => s + si.returnQty * si.unitPricePiastres, 0),
                  )}
                </span>
              </div>
              <button
                onClick={handleSelectItemsContinue}
                disabled={!selectedItems.some((si) => si.returnQty > 0)}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors"
              >
                {tr.confirm}
              </button>
            </div>
          )}

          {/* ════════════════════ FREEFORM_ENTRY ═════════════════════════ */}
          {modalState === 'FREEFORM_ENTRY' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-[#0F172A]">{tr.freeformTitle}</p>
              <div className="space-y-3">
                {freeformItems.map((fi, idx) => (
                  <div key={fi.id} className="border border-[#E2E8F0] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={fi.productName}
                        onChange={(e) =>
                          setFreeformItems((s) =>
                            s.map((x, i) =>
                              i === idx ? { ...x, productName: e.target.value } : x,
                            ),
                          )
                        }
                        placeholder={tr.itemName}
                        className="flex-1 h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                      {freeformItems.length > 1 && (
                        <button
                          onClick={() =>
                            setFreeformItems((s) => s.filter((_, i) => i !== idx))
                          }
                          className="text-red-400 hover:text-red-600 text-xl leading-none px-1 flex-shrink-0"
                          aria-label={tr.discard}
                        >
                          ×
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() =>
                            setFreeformItems((s) =>
                              s.map((x, i) =>
                                i === idx ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x,
                              ),
                            )
                          }
                          className="w-7 h-7 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] font-bold text-sm"
                        >
                          −
                        </button>
                        <span className="min-w-[2ch] text-center font-semibold text-sm">
                          {fi.quantity}
                        </span>
                        <button
                          onClick={() =>
                            setFreeformItems((s) =>
                              s.map((x, i) =>
                                i === idx ? { ...x, quantity: x.quantity + 1 } : x,
                              ),
                            )
                          }
                          className="w-7 h-7 rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] font-bold text-sm"
                        >
                          +
                        </button>
                      </div>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={fi.madInput}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const parsed = parseFloat(raw);
                          const piastres = isNaN(parsed) ? 0 : Math.round(parsed * 100);
                          setFreeformItems((s) =>
                            s.map((x, i) =>
                              i === idx
                                ? { ...x, madInput: raw, unitPricePiastres: piastres }
                                : x,
                            ),
                          );
                        }}
                        placeholder={tr.unitPrice}
                        className="w-32 h-9 px-3 rounded-lg border border-[#E2E8F0] text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
                      />
                      {fi.unitPricePiastres > 0 && (
                        <span className="text-xs text-[#94A3B8] font-mono">
                          = {formatPrice(fi.quantity * fi.unitPricePiastres)}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {(['restock', 'damaged', 'discard'] as Disposition[]).map((d) =>
                        dispositionButton(fi.disposition, d, (newD) =>
                          setFreeformItems((s) =>
                            s.map((x, i) => (i === idx ? { ...x, disposition: newD } : x)),
                          ),
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() =>
                  setFreeformItems((s) => [
                    ...s,
                    {
                      id: makeId(),
                      productName: '',
                      quantity: 1,
                      madInput: '',
                      unitPricePiastres: 0,
                      disposition: 'restock',
                    },
                  ])
                }
                className="w-full border border-dashed border-[#E2E8F0] text-[#64748B] py-2 rounded-xl text-sm hover:bg-[#F8FAFC] transition-colors"
              >
                + {tr.addItem}
              </button>
              <div className="flex justify-between items-center pt-2 border-t border-[#F1F5F9]">
                <span className="text-sm font-bold text-[#0F172A]">{tr.total}:</span>
                <span className="font-bold text-lg text-orange-600 font-mono">
                  {formatPrice(
                    freeformItems.reduce((s, fi) => s + fi.quantity * fi.unitPricePiastres, 0),
                  )}
                </span>
              </div>
              <button
                onClick={handleFreeformContinue}
                disabled={
                  !freeformItems.some(
                    (fi) => fi.productName.trim() && fi.quantity > 0 && fi.unitPricePiastres > 0,
                  )
                }
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors"
              >
                {tr.confirm}
              </button>
            </div>
          )}

          {/* ════════════════════ MANAGER_PIN ════════════════════════════ */}
          {modalState === 'MANAGER_PIN' && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-[#0F172A]">{tr.managerPinTitle}</p>
              <p className="text-xs text-[#64748B]">
                {isFreeform && pinNextState === 'FREEFORM_ENTRY'
                  ? tr.managerPinFreeform
                  : tr.managerPinReason}
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">
                    {tr.managerId}
                  </label>
                  <input
                    type="text"
                    value={managerStaffId}
                    onChange={(e) => setManagerStaffId(e.target.value.trim())}
                    placeholder="..."
                    className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64748B] mb-1">
                    {tr.managerPin}
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={managerPin}
                    onChange={(e) =>
                      setManagerPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                    }
                    placeholder="••••"
                    className="w-full h-10 px-3 rounded-xl border border-[#E2E8F0] text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 tracking-widest text-center text-xl"
                  />
                </div>
              </div>
              <button
                onClick={handleManagerPinApprove}
                disabled={!managerStaffId.trim() || managerPin.length !== 4}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-semibold transition-colors"
              >
                {tr.confirm}
              </button>
              <button
                onClick={handleCancelFromManagerPin}
                className="w-full border border-[#E2E8F0] text-[#64748B] py-2 rounded-xl text-sm hover:bg-[#F8FAFC] transition-colors"
              >
                {tr.cancel}
              </button>
            </div>
          )}

          {/* ════════════════════ CONFIRM ════════════════════════════════ */}
          {modalState === 'CONFIRM' && (
            <div className="space-y-4">
              {/* Items summary */}
              <div className="space-y-1">
                {confirmItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-2 py-2 border-b border-[#F1F5F9] last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A] truncate">
                        {item.productName}
                      </p>
                      <p className="text-xs text-[#94A3B8] font-mono">
                        {formatPrice(item.unitPricePiastres)} × {item.quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {dispositionBadge(item.disposition)}
                      <span className="text-sm font-bold text-[#0F172A] font-mono">
                        {formatPrice(item.quantity * item.unitPricePiastres)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {/* Grand total */}
              <div className="flex justify-between items-center pt-1 border-t-2 border-[#0F172A]">
                <span className="font-bold text-[#0F172A]">{tr.total}</span>
                <span className="font-bold text-xl text-orange-600 font-mono">
                  {formatPrice(confirmTotal)}
                </span>
              </div>

              {/* Refund method */}
              <div>
                <p className="text-xs font-medium text-[#64748B] mb-2">{tr.refundMethod}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'card', 'store_credit'] as RefundMethod[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setRefundMethod(m)}
                      className={`py-2 rounded-xl text-sm font-semibold border transition-colors ${
                        refundMethod === m
                          ? 'bg-orange-600 border-orange-600 text-white'
                          : 'bg-white border-[#E2E8F0] text-[#64748B] hover:border-orange-300'
                      }`}
                    >
                      {m === 'cash' ? tr.cash : m === 'card' ? tr.card : tr.storeCredit}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => void handleConfirm()}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                {tr.confirm}
              </button>
              <button
                onClick={() =>
                  setModalState(isFreeform ? 'FREEFORM_ENTRY' : 'SELECT_ITEMS')
                }
                className="w-full border border-[#E2E8F0] text-[#64748B] py-2 rounded-xl text-sm hover:bg-[#F8FAFC] transition-colors"
              >
                ← {tr.cancel}
              </button>
            </div>
          )}

          {/* ════════════════════ PROCESSING ═════════════════════════════ */}
          {modalState === 'PROCESSING' && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-8 h-8 border-4 border-orange-200 border-t-orange-600 rounded-full animate-spin" />
              <p className="text-sm text-[#64748B]">{tr.processing}</p>
            </div>
          )}

          {/* ════════════════════ SUCCESS ════════════════════════════════ */}
          {modalState === 'SUCCESS' && returnResult && (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-[#0F172A]">{tr.successTitle}</p>
                <p className="text-sm font-mono text-orange-600">
                  {tr.returnNumber.replace('{n}', returnResult.returnNumber)}
                </p>
                <p className="text-2xl font-bold text-[#0F172A] font-mono mt-2">
                  {formatPrice(returnResult.totalPiastres)}
                </p>
                <p className="text-sm text-[#64748B]">
                  {refundMethod === 'cash'
                    ? tr.cash
                    : refundMethod === 'card'
                    ? tr.card
                    : tr.storeCredit}
                </p>
              </div>
              <button
                onClick={onDone}
                className="w-full max-w-xs bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-semibold transition-colors"
              >
                {tr.done}
              </button>
            </div>
          )}

          {/* ════════════════════ ERROR ══════════════════════════════════ */}
          {modalState === 'ERROR' && (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="text-base font-semibold text-[#0F172A]">{tr.error}</p>
                {error && <p className="text-xs text-[#94A3B8] mt-1">{error}</p>}
              </div>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setModalState('CONFIRM')}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-xl font-semibold text-sm transition-colors"
                >
                  {tr.retry}
                </button>
                <button
                  onClick={onDone}
                  className="flex-1 border border-[#E2E8F0] text-[#64748B] py-2.5 rounded-xl text-sm hover:bg-[#F8FAFC] transition-colors"
                >
                  {tr.cancel}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
