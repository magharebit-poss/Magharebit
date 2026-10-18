'use client';

import { useState } from 'react';
import { formatPrice, computeCartTotals } from '../lib/cart';
import type { CartLine, Discount, TaxSummaryLine } from '../lib/cart';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch, getToken } from '../lib/api';
import { getMerchantBranding } from '../lib/branding';
import Receipt, { type ReceiptData } from './Receipt';
import { isTauri, isBackendReachable, queueTransactionLocally } from '../lib/offline-queue';
import type { CustomerProfile } from './CustomerLookupModal';

const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';
const TENANT_ID = process.env['NEXT_PUBLIC_TENANT_ID'] ?? '';

interface CashPaymentModalProps {
  totalPiastres: number;
  cartLines: CartLine[];
  cartDiscount?: Discount;
  shiftId: string;
  customer?: CustomerProfile | null;
  onClose: () => void;
  onSuccess: () => void;
  onStampComplete?: (updatedLoyalty: CustomerProfile['loyalty']) => void;
}

async function issueStamp(
  customerId: string,
  transactionId: string,
  onStampComplete?: (loyalty: CustomerProfile['loyalty']) => void,
): Promise<void> {
  try {
    const res = await apiFetch(`/api/customers/${customerId}/stamp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId }),
    });
    if (res.ok) {
      const data = (await res.json().catch(() => null)) as { loyalty?: CustomerProfile['loyalty'] } | null;
      if (data?.loyalty && onStampComplete) onStampComplete(data.loyalty);
    } else {
      console.warn('[CashPaymentModal] stamp non-ok:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.warn('[CashPaymentModal] stamp failed (non-fatal):', err);
  }
}

export default function CashPaymentModal({
  totalPiastres,
  cartLines,
  cartDiscount,
  shiftId,
  customer,
  onClose,
  onSuccess,
  onStampComplete,
}: CashPaymentModalProps) {
  const { t } = useLanguage();
  const [paidMad, setPaidMad] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [savedTransactionId, setSavedTransactionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Invoice generation state — separate from the receipt so the receipt can
  // re-render in invoice mode without remounting.
  const [invoiceGenerating, setInvoiceGenerating] = useState(false);
  const [invoiceError, setInvoiceError] = useState<string | null>(null);

  const paidPiastres = paidMad ? Math.round(Number(paidMad) * 100) : 0;
  const change = paidPiastres - totalPiastres;
  const canPay = paidPiastres >= totalPiastres && totalPiastres > 0;

  const handleConfirm = async () => {
    if (!canPay) return;
    setSubmitting(true);
    setError(null);
    try {
      // ── Offline-first intercept ─────────────────────────────────────────────
      const inTauri = isTauri();
      const reachable = await isBackendReachable(BACKEND_URL);
      if (!reachable) {
        if (!inTauri) {
          throw new Error(
            'Backend unreachable — online mode required in browser',
          );
        }
        // Tauri + offline: queue locally and show a provisional receipt.
        const localId = crypto.randomUUID();
        const tokenSnapshot = getToken() ?? '';
        // Capture sale time at the moment of queuing so offline sales retain
        // their real timestamp when synced later.
        const soldAt = new Date().toISOString();
        const txPayload = {
          shiftId,
          soldAt,
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
          paymentMethod: 'cash',
          grandTotalPiastres: totalPiastres,
          cashPaidPiastres: paidPiastres,
        };
        await queueTransactionLocally(localId, TENANT_ID, shiftId, txPayload, tokenSnapshot);
        const cashierName =
          typeof window !== 'undefined'
            ? sessionStorage.getItem('greengo_cashier_name') ?? ''
            : '';
        const ct = computeCartTotals(cartLines, cartDiscount);
        setReceipt({
          receiptNumber: `LOCAL-${localId.slice(0, 8).toUpperCase()}`,
          timestamp: new Date().toISOString(),
          cashierName,
          lines: cartLines,
          totalDiscountPiastres: ct.totalDiscountPiastres,
          totalPiastres,
          paymentMethod: 'cash',
          branding: getMerchantBranding(),
          isOfflineQueued: true,
        });
        return;
      }
      // ── Online path (normal) ────────────────────────────────────────────────
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
          paymentMethod: 'cash',
          grandTotalPiastres: totalPiastres,
          cashPaidPiastres: paidPiastres,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        transactionId?: string;
        ok?: boolean;
        receiptNumber?: string;
        serverTimestamp?: string;
        totalPiastres?: number;
        paymentMethod?: 'cash' | 'card' | 'lana';
      };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      if (!data.transactionId) {
        throw new Error('No transactionId in response — transaction may not have saved');
      }
      // Persist transactionId so the invoice flow can reference it after this
      // function returns (invoice generation is a separate user action).
      setSavedTransactionId(data.transactionId);
      // Issue loyalty stamp non-fatally (customer may not be set).
      if (customer?.customerId) {
        void issueStamp(customer.customerId, data.transactionId, onStampComplete);
      }
      // Show the customer receipt rendered from the server-authoritative
      // receipt number + timestamp. The cart is cleared when the cashier taps
      // "New sale" (onSuccess), not on payment success.
      const cashierName =
        typeof window !== 'undefined'
          ? sessionStorage.getItem('greengo_cashier_name') ?? ''
          : '';
      const ct = computeCartTotals(cartLines, cartDiscount);
      setReceipt({
        receiptNumber: data.receiptNumber ?? '—',
        timestamp: data.serverTimestamp ?? new Date().toISOString(),
        cashierName,
        lines: cartLines,
        totalDiscountPiastres: ct.totalDiscountPiastres,
        totalPiastres: data.totalPiastres ?? totalPiastres,
        paymentMethod: data.paymentMethod ?? 'cash',
        branding: getMerchantBranding(),
      });
    } catch (err: unknown) {
      console.error('[CashPaymentModal] transaction failed:', err);
      setError(err instanceof Error ? err.message : t.payment.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateInvoice = async () => {
    if (!savedTransactionId) return;
    setInvoiceGenerating(true);
    setInvoiceError(null);
    try {
      const res = await apiFetch('/api/invoices/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: savedTransactionId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        invoiceNumber?: string;
        taxSummary?: TaxSummaryLine[];
      };
      if (!res.ok) {
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      // Update the receipt in-place to invoice mode. The component re-renders
      // showing fiscal fields + TVA breakdown without closing/reopening.
      setReceipt((r) =>
        r
          ? {
              ...r,
              isInvoice: true,
              invoiceNumber: body.invoiceNumber ?? null,
              taxSummary: body.taxSummary ?? [],
            }
          : r,
      );
    } catch (err: unknown) {
      console.error('[CashPaymentModal] invoice generation failed:', err);
      setInvoiceError(err instanceof Error ? err.message : t.payment.errorGeneric);
    } finally {
      setInvoiceGenerating(false);
    }
  };

  const handleQuickAmount = (amount: number) => {
    setPaidMad(amount.toFixed(2));
  };

  const handleExactAmount = () => {
    setPaidMad(Math.ceil(totalPiastres / 100).toFixed(2));
  };

  // After a successful sale, show the customer receipt. "New sale" (onSuccess)
  // clears the cart and closes the payment flow. The "Generate invoice" button
  // is present until the cashier generates one (idempotent after that).
  if (receipt) {
    return (
      <Receipt
        data={receipt}
        onDone={onSuccess}
        onGenerateInvoice={handleGenerateInvoice}
        invoiceGenerating={invoiceGenerating}
        invoiceError={invoiceError}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl relative">
        <>
            <h2 className="text-xl font-bold text-[#0F172A] text-center mb-1">{t.payment.cashTitle}</h2>
            <button
              onClick={onClose}
              className="absolute top-4 end-4 text-[#94A3B8] hover:text-[#0F172A] text-2xl leading-none"
              aria-label={t.payment.close}
            >
              ×
            </button>

            <div className="mt-6 mb-4">
              <p className="text-xs text-[#64748B] text-center mb-1">{t.payment.amountDue}</p>
              <p className="text-3xl font-bold text-[#2E8B57] text-center">
                {formatPrice(totalPiastres)}
              </p>
            </div>

            <label className="block text-xs font-semibold text-[#64748B] mb-1.5">{t.payment.amountPaid}</label>
            <div className="relative mb-3">
              <input
                type="number"
                min="0"
                step="0.01"
                value={paidMad}
                onChange={(e) => setPaidMad(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="w-full h-12 px-4 rounded-xl border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2E8B57] text-lg font-mono"
              />
              <span className="absolute end-4 top-1/2 -translate-y-1/2 text-sm text-[#64748B]">MAD</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {([
                { amt: 20,  bg: 'rgba(120,80,180,0.15)',  border: 'rgba(120,80,180,0.25)' },
                { amt: 50,  bg: 'rgba(46,139,87,0.15)',   border: 'rgba(46,139,87,0.25)'  },
                { amt: 100, bg: 'rgba(240,180,41,0.15)',  border: 'rgba(240,180,41,0.25)' },
                { amt: 200, bg: 'rgba(30,120,200,0.15)',  border: 'rgba(30,120,200,0.25)' },
              ] as const).map(({ amt, bg, border }) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleQuickAmount(amt)}
                  style={{
                    flex: 1,
                    padding: '0.6rem 0',
                    borderRadius: '10px',
                    border: `1px solid ${border}`,
                    background: bg,
                    color: '#1A1A1A',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    transition: 'opacity 0.15s',
                  }}
                >
                  {amt}
                </button>
              ))}
              <button
                type="button"
                onClick={handleExactAmount}
                style={{
                  flex: 1,
                  padding: '0.6rem 0',
                  borderRadius: '10px',
                  border: '1px solid rgba(240,180,41,0.3)',
                  background: 'rgba(240,180,41,0.15)',
                  color: '#1A1A1A',
                  fontWeight: 600,
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
              >
                {t.payment.exactAmount}
              </button>
            </div>

            <div className="flex justify-between items-center p-3 rounded-xl bg-[#F8FAFC] mb-4">
              <span className="text-sm text-[#64748B]">{t.payment.change}</span>
              <span className={`text-lg font-bold ${change >= 0 ? 'text-[#2E8B57]' : 'text-red-500'}`}>
                {formatPrice(Math.max(0, change))}
              </span>
            </div>

            {error && (
              <div className="mb-3 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 text-center">
                {error}
              </div>
            )}

            <button
              onClick={handleConfirm}
              disabled={!canPay || submitting}
              className="w-full bg-[#2E8B57] hover:bg-[#1A5C3A] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {submitting ? t.payment.processing : t.payment.confirm}
            </button>
            <button
              onClick={onClose}
              className="w-full mt-2 py-2 text-sm text-[#64748B] hover:text-[#0F172A]"
            >
              {t.payment.cancel}
            </button>
        </>
      </div>
    </div>
  );
}
