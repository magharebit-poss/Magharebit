'use client';

import { useState, useEffect, useRef } from 'react';
import { formatPrice, computeCartTotals } from '../lib/cart';
import type { CartLine, Discount } from '../lib/cart';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../lib/api';
import { getMerchantBranding } from '../lib/branding';
import Receipt, { type ReceiptData } from './Receipt';
import {
  cardInitiatePayment,
  cardPollResult,
  cardCancel,
  type PaymentRequest,
} from '../lib/card-terminal';
import type { CustomerProfile } from './CustomerLookupModal';

// ── Modal states ─────────────────────────────────────────────────────────────

type ModalState =
  | 'IDLE'             // waiting for cashier to initiate
  | 'SENDING'          // Tauri command in-flight to terminal
  | 'WAITING_CUSTOMER' // terminal ready, waiting for card
  | 'PROCESSING'       // card presented, terminal processing
  | 'APPROVED'         // terminal approved, recording transaction
  | 'DECLINED'         // terminal declined
  | 'TIMEOUT'          // no response within timeout window
  | 'ERROR';           // terminal unavailable or command failed

// ── Props ────────────────────────────────────────────────────────────────────

interface CardPaymentModalProps {
  totalPiastres: number;
  cartLines: CartLine[];
  cartDiscount?: Discount;
  shiftId: string;
  customer?: CustomerProfile | null;
  onClose: () => void;   // cancel / close without payment
  onSuccess: () => void; // cart cleared → new sale
  onStampComplete?: (updatedLoyalty: CustomerProfile['loyalty']) => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_SECONDS = 60;

function readTimeoutSeconds(): number {
  if (typeof process === 'undefined') return DEFAULT_TIMEOUT_SECONDS;
  const raw = Number(process.env['NEXT_PUBLIC_CARD_TIMEOUT_SECONDS']);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_SECONDS;
}

function makeRef(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `tref-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ── Component ────────────────────────────────────────────────────────────────

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
      console.warn('[CardPaymentModal] stamp non-ok:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.warn('[CardPaymentModal] stamp failed (non-fatal):', err);
  }
}

export default function CardPaymentModal({
  totalPiastres,
  cartLines,
  cartDiscount,
  shiftId,
  customer,
  onClose,
  onSuccess,
  onStampComplete,
}: CardPaymentModalProps) {
  const { t } = useLanguage();

  const [modalState, setModalState] = useState<ModalState>('IDLE');
  const [approvalCode, setApprovalCode] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(readTimeoutSeconds());
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Per-attempt transaction reference — regenerated on each retry so the
  // CMI implementation can distinguish retried attempts.
  const [transactionRef, setTransactionRef] = useState<string>(makeRef);

  // Guard against stale poll resolving after user cancellation.
  const cancelledRef = useRef(false);

  const timeoutSeconds = readTimeoutSeconds();

  // Countdown ticks only while waiting for the customer.
  useEffect(() => {
    if (modalState !== 'WAITING_CUSTOMER') return;
    setCountdown(timeoutSeconds);
    const interval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [modalState, timeoutSeconds]);

  // ── Transaction recording ─────────────────────────────────────────────────

  const recordTransaction = async (code: string, pan: string | null) => {
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
          paymentMethod: 'card',
          grandTotalPiastres: totalPiastres,
          approvalCode: code,
          maskedPan: pan,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        transactionId?: string;
        receiptNumber?: string;
        serverTimestamp?: string;
        totalPiastres?: number;
        paymentMethod?: 'cash' | 'card' | 'lana';
      };
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const cashierName =
        typeof window !== 'undefined'
          ? (sessionStorage.getItem('greengo_cashier_name') ?? '')
          : '';
      if (customer?.customerId && data.transactionId) {
        void issueStamp(customer.customerId, data.transactionId, onStampComplete);
      }
      const ct = computeCartTotals(cartLines, cartDiscount);
      setReceipt({
        receiptNumber: data.receiptNumber ?? '—',
        timestamp: data.serverTimestamp ?? new Date().toISOString(),
        cashierName,
        lines: cartLines,
        totalDiscountPiastres: ct.totalDiscountPiastres,
        totalPiastres: data.totalPiastres ?? totalPiastres,
        paymentMethod: 'card',
        branding: getMerchantBranding(),
      });
    } catch (err: unknown) {
      console.error('[CardPaymentModal] transaction record failed:', err);
      setErrorMessage(err instanceof Error ? err.message : t.payment.errorGeneric);
      setModalState('ERROR');
    }
  };

  // ── Terminal flow ─────────────────────────────────────────────────────────

  const handleInitiate = async () => {
    cancelledRef.current = false;
    setModalState('SENDING');

    const request: PaymentRequest = {
      amount_piastres: totalPiastres,
      currency: 'MAD',
      transaction_ref: transactionRef,
      cashier_id:
        typeof window !== 'undefined'
          ? (sessionStorage.getItem('greengo_cashier_name') ?? '')
          : '',
      receipt_number: `CARD-${Date.now()}`,
    };

    try {
      await cardInitiatePayment(request);

      if (cancelledRef.current) return;
      setModalState('WAITING_CUSTOMER');

      // Blocks until the terminal responds (or times out).
      const response = await cardPollResult(transactionRef);

      if (cancelledRef.current) return;

      switch (response.status) {
        case 'Approved': {
          const code = response.approval_code;
          const pan = response.masked_pan ?? null;
          setApprovalCode(code);
          setModalState('APPROVED');
          // Show APPROVED screen for 1.5 s, then record the transaction.
          setTimeout(() => {
            void recordTransaction(code, pan);
          }, 1500);
          break;
        }
        case 'Declined':
          setDeclineReason(response.reason_text ?? null);
          setModalState('DECLINED');
          break;
        case 'Cancelled':
          // Terminal-initiated cancel; return to IDLE.
          setModalState('IDLE');
          break;
        case 'Timeout':
          setModalState('TIMEOUT');
          break;
        case 'Error':
          setErrorMessage(response.message);
          setModalState('ERROR');
          break;
      }
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      console.error('[CardPaymentModal] terminal error:', err);
      setErrorMessage(err instanceof Error ? err.message : t.payment.errorGeneric);
      setModalState('ERROR');
    }
  };

  const handleCancelTerminal = async () => {
    cancelledRef.current = true;
    await cardCancel(transactionRef).catch(() => {}); // best-effort
    setModalState('IDLE');
  };

  const handleRetry = () => {
    setTransactionRef(makeRef()); // fresh ref for the new attempt
    setApprovalCode(null);
    setDeclineReason(null);
    setErrorMessage(null);
    setModalState('IDLE');
  };

  // ── After successful transaction, show the receipt ────────────────────────

  if (receipt) {
    return <Receipt data={receipt} onDone={onSuccess} />;
  }

  // ── States that allow explicit close ──────────────────────────────────────

  const canClose =
    modalState === 'IDLE' ||
    modalState === 'DECLINED' ||
    modalState === 'TIMEOUT' ||
    modalState === 'ERROR';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl relative">

        {/* Close × — only in states where the cashier can abort */}
        {canClose && (
          <button
            onClick={onClose}
            className="absolute top-4 end-4 text-[#94A3B8] hover:text-[#0F172A] text-2xl leading-none"
            aria-label={t.card.cancel}
          >
            ×
          </button>
        )}

        {/* Modal title */}
        <h2 className="text-xl font-bold text-[#0F172A] text-center mb-1">
          {t.card.title}
        </h2>

        {/* Amount — shown in all states except APPROVED (receipt is taking over) */}
        <div className="mt-4 mb-6">
          <p className="text-xs text-[#64748B] text-center mb-1">{t.payment.amountDue}</p>
          <p className="text-3xl font-bold text-[#1A5276] text-center">
            {formatPrice(totalPiastres)}
          </p>
        </div>

        {/* ── IDLE ─────────────────────────────────────────────────────── */}
        {modalState === 'IDLE' && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-[#64748B] text-center">
              {t.card.idleInstruction}
            </p>
            <button
              onClick={() => void handleInitiate()}
              className="w-full bg-[#1A5276] hover:bg-[#154360] text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {t.card.initiate}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-[#64748B] hover:text-[#0F172A]"
            >
              {t.card.cancel}
            </button>
          </div>
        )}

        {/* ── SENDING ──────────────────────────────────────────────────── */}
        {modalState === 'SENDING' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="w-10 h-10 border-4 border-[#1A5276] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#64748B]">{t.card.sending}</p>
          </div>
        )}

        {/* ── WAITING_CUSTOMER ─────────────────────────────────────────── */}
        {modalState === 'WAITING_CUSTOMER' && (
          <div className="flex flex-col items-center gap-4">
            {/* Animated card / NFC icon — pure SVG, no external library */}
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-[#1A5276]/10 animate-pulse" />
              <svg
                width="52"
                height="52"
                viewBox="0 0 52 52"
                fill="none"
                aria-hidden="true"
              >
                {/* Card outline */}
                <rect x="2" y="12" width="48" height="30" rx="4" stroke="#1A5276" strokeWidth="2" />
                {/* Magnetic stripe line */}
                <line x1="2" y1="21" x2="50" y2="21" stroke="#1A5276" strokeWidth="2" />
                {/* NFC waves — three concentric arcs */}
                <path
                  d="M22 34 a4 4 0 0 1 8 0"
                  stroke="#2E8B57"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M18 31 a8 8 0 0 1 16 0"
                  stroke="#2E8B57"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  opacity="0.65"
                />
                <path
                  d="M14 28 a12 12 0 0 1 24 0"
                  stroke="#2E8B57"
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity="0.35"
                />
              </svg>
            </div>
            <p className="text-base font-semibold text-[#0F172A] text-center">
              {t.card.presentCard}
            </p>
            <p className="text-sm text-[#64748B]">
              {t.card.timeoutIn.replace('{n}', String(countdown))}
            </p>
            <button
              onClick={() => void handleCancelTerminal()}
              className="w-full border border-[#E2E8F0] text-[#64748B] py-2 rounded-xl text-sm hover:bg-[#F8FAFC] transition-colors"
            >
              {t.card.cancel}
            </button>
          </div>
        )}

        {/* ── PROCESSING ───────────────────────────────────────────────── */}
        {modalState === 'PROCESSING' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="w-10 h-10 border-4 border-[#1A5276] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#64748B]">{t.card.processing}</p>
          </div>
        )}

        {/* ── APPROVED ─────────────────────────────────────────────────── */}
        {modalState === 'APPROVED' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="w-16 h-16 rounded-full bg-[#F0FDF4] flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path
                  d="M6 16 L13 23 L26 9"
                  stroke="#2E8B57"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-lg font-bold text-[#2E8B57]">{t.card.approved}</p>
            {approvalCode && (
              <p className="text-sm text-[#64748B] font-mono">
                {t.card.approvalCode} {approvalCode}
              </p>
            )}
            {/* Spinner while recording transaction */}
            <div className="w-6 h-6 border-2 border-[#2E8B57] border-t-transparent rounded-full animate-spin mt-1" />
          </div>
        )}

        {/* ── DECLINED ─────────────────────────────────────────────────── */}
        {modalState === 'DECLINED' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path
                  d="M8 8 L24 24 M24 8 L8 24"
                  stroke="#EF4444"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-lg font-bold text-red-600">{t.card.declined}</p>
            {declineReason && (
              <p className="text-sm text-[#64748B] text-center">{declineReason}</p>
            )}
            <button
              onClick={handleRetry}
              className="w-full bg-[#1A5276] hover:bg-[#154360] text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {t.card.retry}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-[#64748B] hover:text-[#0F172A]"
            >
              {t.card.cancel}
            </button>
          </div>
        )}

        {/* ── TIMEOUT ──────────────────────────────────────────────────── */}
        {modalState === 'TIMEOUT' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-5xl" role="img" aria-label="timeout">⏱</p>
            <p className="text-lg font-bold text-[#0F172A]">{t.card.timeout}</p>
            <button
              onClick={handleRetry}
              className="w-full bg-[#1A5276] hover:bg-[#154360] text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {t.card.retry}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-[#64748B] hover:text-[#0F172A]"
            >
              {t.card.cancel}
            </button>
          </div>
        )}

        {/* ── ERROR ────────────────────────────────────────────────────── */}
        {modalState === 'ERROR' && (
          <div className="flex flex-col gap-4">
            <p className="text-base font-semibold text-[#0F172A] text-center">
              {t.card.terminalUnavailable}
            </p>
            {/* Developer-facing detail — collapsible so it doesn't alarm cashiers */}
            {errorMessage && (
              <details className="text-xs">
                <summary className="cursor-pointer select-none text-[#94A3B8] hover:text-[#64748B]">
                  {t.card.errorDetail}
                </summary>
                <pre className="mt-1 p-2 bg-[#F8FAFC] rounded text-red-600 whitespace-pre-wrap break-all">
                  {errorMessage}
                </pre>
              </details>
            )}
            <button
              onClick={handleRetry}
              className="w-full bg-[#1A5276] hover:bg-[#154360] text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {t.card.retry}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-[#64748B] hover:text-[#0F172A]"
            >
              {t.card.cancel}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
