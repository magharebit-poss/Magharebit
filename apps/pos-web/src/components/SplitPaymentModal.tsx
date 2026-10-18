'use client';

import { useState, useEffect } from 'react';
import { formatPrice } from '../lib/cart';
import type { CartLine, Discount } from '../lib/cart';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../lib/api';

interface PaymentMethodConfig {
  method: string;
  label_ar: string;
  label_fr: string;
  label_en?: string | null;
  sort_order: number;
}

interface TenderEntry {
  method: string;
  labelAr: string;
  labelFr: string;
  amountMad: string;
}

interface SplitPaymentModalProps {
  totalPiastres: number;
  cartLines: CartLine[];
  cartDiscount?: Discount;
  shiftId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function piastresToMad(p: number): string {
  return (p / 100).toFixed(2);
}

function madToPiastres(s: string): number {
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100);
}

export default function SplitPaymentModal({
  totalPiastres,
  cartLines,
  cartDiscount,
  shiftId,
  onClose,
  onSuccess,
}: SplitPaymentModalProps) {
  const { t, lang } = useLanguage();
  const [methods, setMethods] = useState<PaymentMethodConfig[]>([]);
  const [tenders, setTenders] = useState<TenderEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch('/api/payment-methods')
      .then((r) => r.json())
      .then((data: PaymentMethodConfig[]) => {
        setMethods(data);
        if (data.length > 0) {
          setTenders([
            {
              method: data[0]!.method,
              labelAr: data[0]!.label_ar,
              labelFr: data[0]!.label_fr,
              amountMad: piastresToMad(totalPiastres),
            },
          ]);
        }
      })
      .catch(() => setError(t.split.errorLoadMethods));
  }, [totalPiastres]);

  const allocatedPiastres = tenders.reduce((s, te) => s + madToPiastres(te.amountMad), 0);
  const remainingPiastres = totalPiastres - allocatedPiastres;
  const balanced = Math.abs(remainingPiastres) <= 2;

  function addTender() {
    const unused = methods.find((m) => !tenders.some((te) => te.method === m.method));
    if (!unused) return;
    setTenders([
      ...tenders,
      { method: unused.method, labelAr: unused.label_ar, labelFr: unused.label_fr, amountMad: piastresToMad(Math.max(0, remainingPiastres)) },
    ]);
  }

  function removeTender(idx: number) {
    setTenders(tenders.filter((_, i) => i !== idx));
  }

  function setMethod(idx: number, method: string) {
    const cfg = methods.find((m) => m.method === method);
    if (!cfg) return;
    setTenders(tenders.map((te, i) =>
      i === idx ? { ...te, method: cfg.method, labelAr: cfg.label_ar, labelFr: cfg.label_fr } : te,
    ));
  }

  function setAmount(idx: number, value: string) {
    setTenders(tenders.map((te, i) => (i === idx ? { ...te, amountMad: value } : te)));
  }

  function fillRemaining(idx: number) {
    const others = tenders.reduce((s, te, i) => (i !== idx ? s + madToPiastres(te.amountMad) : s), 0);
    const fill = Math.max(0, totalPiastres - others);
    setTenders(tenders.map((te, i) => (i === idx ? { ...te, amountMad: piastresToMad(fill) } : te)));
  }

  async function handleConfirm() {
    if (!balanced || tenders.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shiftId,
          soldAt: new Date().toISOString(),
          lines: cartLines.map((l) => ({
            productId: l.product.product_id,
            quantity: l.quantity,
            unitPricePiastres: l.unitPricePiastres,
            lineTotalPiastres: l.lineTotalPiastres,
            taxRate: l.taxRate,
            taxAmountPiastres: l.taxAmountPiastres,
            discount: l.discount ?? null,
          })),
          cartDiscount: cartDiscount ?? null,
          grandTotalPiastres: totalPiastres,
          tenders: tenders.map((te) => ({
            method: te.method,
            amountPiastres: madToPiastres(te.amountMad),
          })),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setError(data.error ?? t.split.errorStatus.replace('{n}', String(res.status)));
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.payment.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#E0E0E0]">
          <h2 className="text-lg font-bold text-[#1A1A1A]">{t.zReport.splitPayment}</h2>
          <button
            onClick={onClose}
            className="text-[#757575] hover:text-[#1A1A1A] text-2xl leading-none"
            aria-label={t.payment.close}
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Total */}
          <div className="flex justify-between text-sm font-semibold">
            <span className="text-[#757575]">{t.split.total}</span>
            <span className="text-[#1A1A1A]">{formatPrice(totalPiastres)}</span>
          </div>

          {/* Tender rows */}
          <div className="space-y-3">
            {tenders.map((te, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={te.method}
                  onChange={(e) => setMethod(idx, e.target.value)}
                  className="flex-1 border border-[#E0E0E0] rounded-[4px] px-2 py-2 text-sm text-[#1A1A1A] bg-white"
                >
                  {methods.map((m) => (
                    <option
                      key={m.method}
                      value={m.method}
                      disabled={m.method !== te.method && tenders.some((x) => x.method === m.method)}
                    >
                      {lang === 'ar' ? m.label_ar : lang === 'fr' ? m.label_fr : (m.label_en ?? m.label_fr)}
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={te.amountMad}
                    onChange={(e) => setAmount(idx, e.target.value)}
                    className="w-24 border border-[#E0E0E0] rounded-[4px] px-2 py-2 text-sm text-end"
                    placeholder="0.00"
                    dir="ltr"
                  />
                  <span className="text-xs text-[#757575]">{t.split.currencySuffix}</span>
                  {remainingPiastres > 0 && (
                    <button
                      onClick={() => fillRemaining(idx)}
                      className="text-[#2E8B57] text-xs underline whitespace-nowrap"
                      title={t.split.fillRemaining}
                    >
                      ↑
                    </button>
                  )}
                </div>
                {tenders.length > 1 && (
                  <button
                    onClick={() => removeTender(idx)}
                    className="text-[#D32F2F] text-lg leading-none"
                  >
                    −
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add tender */}
          {tenders.length < methods.length && (
            <button
              onClick={addTender}
              className="w-full border border-dashed border-[#2E8B57] text-[#2E8B57] rounded-lg py-2 text-sm font-medium hover:bg-[#2E8B57]/5 transition-colors"
            >
              {t.split.addTender}
            </button>
          )}

          {/* Balance indicator */}
          <div className={`text-sm text-end font-semibold ${balanced ? 'text-green-600' : 'text-[#D32F2F]'}`}>
            {balanced
              ? `✓ ${t.split.balanced}`
              : remainingPiastres > 0
              ? t.split.remaining.replace('{n}', formatPrice(remainingPiastres))
              : t.split.overpaid.replace('{n}', formatPrice(Math.abs(remainingPiastres)))}
          </div>

          {error && <p className="text-[#D32F2F] text-sm text-center">{error}</p>}
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-[#E0E0E0]">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 border border-[#E0E0E0] text-[#374151] rounded-lg py-3 font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {t.payment.cancel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!balanced || tenders.length === 0 || submitting}
            className="flex-1 bg-[#2E8B57] hover:bg-[#1A5C3A] text-white rounded-lg py-3 font-semibold transition-colors disabled:opacity-50"
          >
            {submitting ? t.payment.processing : t.payment.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
