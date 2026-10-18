'use client';

import { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { formatPrice, computeCartTotals } from '../lib/cart';
import type { CartLine, Discount } from '../lib/cart';
import { useLanguage } from '../context/LanguageContext';
import { apiFetch } from '../lib/api';
import { getMerchantBranding } from '../lib/branding';
import Receipt, { type ReceiptData } from './Receipt';
import type { CustomerProfile } from './CustomerLookupModal';

// ── Modal states ─────────────────────────────────────────────────────────────

type ModalState =
  | 'IDLE'        // cashier about to initiate
  | 'GENERATING'  // POST /payments/lana/initiate in flight
  | 'QR_DISPLAY'  // QR shown; polling every 2s; countdown running
  | 'PAID'        // poll detected status=paid; recording transaction
  | 'SUCCESS'     // transaction recorded → receipt rendered
  | 'EXPIRED'     // QR timed out — cashier can regenerate
  | 'ERROR';      // unrecoverable error

// ── Props ────────────────────────────────────────────────────────────────────

interface LanaPaymentModalProps {
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

const DEFAULT_TIMEOUT_SECONDS = 180;

function readTimeoutSeconds(): number {
  if (typeof process === 'undefined') return DEFAULT_TIMEOUT_SECONDS;
  const raw = Number(process.env['NEXT_PUBLIC_LANA_TIMEOUT_SECONDS']);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_SECONDS;
}

function makeRef(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `lana-${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
      console.warn('[LanaPaymentModal] stamp non-ok:', res.status, await res.text().catch(() => ''));
    }
  } catch (err) {
    console.warn('[LanaPaymentModal] stamp failed (non-fatal):', err);
  }
}

export default function LanaPaymentModal({
  totalPiastres,
  cartLines,
  cartDiscount,
  shiftId,
  customer,
  onClose,
  onSuccess,
  onStampComplete,
}: LanaPaymentModalProps) {
  const { t } = useLanguage();

  const [modalState, setModalState] = useState<ModalState>('IDLE');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(readTimeoutSeconds());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  // Stable transaction ref — does NOT change on retry (each session is new).
  const transactionRef = useRef<string>(makeRef()).current;

  const timeoutSeconds = readTimeoutSeconds();

  // Track consecutive poll failures to avoid thrashing on transient network errors.
  const consecutiveFailuresRef = useRef(0);

  // ── Record transaction after Lana confirms payment ────────────────────────

  const recordTransaction = async (sid: string) => {
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
          paymentMethod: 'lana',
          grandTotalPiastres: totalPiastres,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        transactionId?: string;
        receiptNumber?: string;
        serverTimestamp?: string;
        totalPiastres?: number;
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
        paymentMethod: 'lana',
        branding: getMerchantBranding(),
      });
    } catch (err: unknown) {
      console.error('[LanaPaymentModal] transaction record failed:', err);
      // Payment was received by Lana but DB write failed.
      // Show session ID so the manager can reconcile manually.
      setErrorMessage(`${t.lana.errorRecovery} (session: ${sid})`);
      setModalState('ERROR');
    }
  };

  // ── Polling + countdown while QR is displayed ─────────────────────────────

  useEffect(() => {
    if (modalState !== 'QR_DISPLAY' || !sessionId) return;

    consecutiveFailuresRef.current = 0;
    setCountdown(timeoutSeconds);

    // Countdown ticks every second.
    const countdownInterval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    // Poll status every 2 seconds.
    const pollInterval = setInterval(() => {
      void (async () => {
        try {
          const res = await apiFetch(
            `/api/payments/lana/status/${sessionId}`,
            { cache: 'no-store' } as RequestInit
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);

          const data = (await res.json()) as { status: string };
          consecutiveFailuresRef.current = 0;

          if (data.status === 'paid') {
            clearInterval(pollInterval);
            clearInterval(countdownInterval);
            setModalState('PAID');
            void recordTransaction(sessionId);
          } else if (data.status === 'expired') {
            clearInterval(pollInterval);
            clearInterval(countdownInterval);
            setModalState('EXPIRED');
          }
        } catch {
          consecutiveFailuresRef.current += 1;
          if (consecutiveFailuresRef.current >= 3) {
            clearInterval(pollInterval);
            clearInterval(countdownInterval);
            setErrorMessage(t.payment.errorGeneric);
            setModalState('ERROR');
          }
        }
      })();
    }, 2000);

    // MANDATORY cleanup — prevents stale intervals after unmount or state change.
    return () => {
      clearInterval(pollInterval);
      clearInterval(countdownInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalState, sessionId]);

  // ── Initiate Lana payment ─────────────────────────────────────────────────

  const handleInitiate = async () => {
    setModalState('GENERATING');
    setErrorMessage(null);
    setQrDataUrl(null);
    setSessionId(null);

    try {
      const registerId =
        typeof window !== 'undefined'
          ? (sessionStorage.getItem('greengo_register_id') ?? '00000000-0000-0000-0000-000000000000')
          : '00000000-0000-0000-0000-000000000000';

      const res = await apiFetch('/api/payments/lana/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalPiastres,
          transactionRef,
          registerId,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        qrCodeData?: string;
        sessionId?: string;
        expiresAt?: string;
      };

      if (!res.ok || !data.qrCodeData || !data.sessionId) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      // Render QR image client-side — no external image CDN needed.
      const dataUrl = await QRCode.toDataURL(data.qrCodeData, {
        width: 200,
        margin: 1,
        color: { dark: '#0F172A', light: '#FFFFFF' },
      });

      setQrDataUrl(dataUrl);
      setSessionId(data.sessionId);
      setModalState('QR_DISPLAY');
    } catch (err: unknown) {
      console.error('[LanaPaymentModal] initiate failed:', err);
      setErrorMessage(err instanceof Error ? err.message : t.payment.errorGeneric);
      setModalState('ERROR');
    }
  };

  // ── After successful transaction, show the receipt ────────────────────────

  if (receipt) {
    return <Receipt data={receipt} onDone={onSuccess} />;
  }

  // ── States that allow explicit close ──────────────────────────────────────

  const canClose =
    modalState === 'IDLE' ||
    modalState === 'EXPIRED' ||
    modalState === 'ERROR';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl relative">

        {/* Close × — only in states where the cashier can safely abort */}
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
          {t.lana.title}
        </h2>

        {/* Amount — shown in all states */}
        <div className="mt-4 mb-6">
          <p className="text-xs text-[#64748B] text-center mb-1">{t.payment.amountDue}</p>
          <p className="text-3xl font-bold text-emerald-700 text-center">
            {formatPrice(totalPiastres)}
          </p>
        </div>

        {/* ── IDLE ────────────────────────────────────────────────────── */}
        {modalState === 'IDLE' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => void handleInitiate()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {t.lana.generate}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-[#64748B] hover:text-[#0F172A]"
            >
              {t.card.cancel}
            </button>
          </div>
        )}

        {/* ── GENERATING ─────────────────────────────────────────────── */}
        {modalState === 'GENERATING' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#64748B]">{t.lana.generating}</p>
          </div>
        )}

        {/* ── QR_DISPLAY ─────────────────────────────────────────────── */}
        {modalState === 'QR_DISPLAY' && qrDataUrl && (
          <div className="flex flex-col items-center gap-4">
            <img
              src={qrDataUrl}
              alt="Lana Cash QR code"
              width={200}
              height={200}
              className="rounded-xl border border-[#E2E8F0] shadow-sm"
            />
            <p className="text-sm text-[#64748B] text-center leading-snug">
              {t.lana.scanInstruction}
            </p>
            <p className="text-xs font-mono text-[#94A3B8]">
              {t.lana.timeoutIn.replace('{n}', String(countdown))}
            </p>
            {/* Subtle polling indicator */}
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin opacity-60" />
          </div>
        )}

        {/* ── PAID — brief confirmation while transaction is recorded ── */}
        {modalState === 'PAID' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="w-16 h-16 rounded-full bg-[#F0FDF4] flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
                <path
                  d="M6 16 L13 23 L26 9"
                  stroke="#059669"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="text-lg font-bold text-emerald-600">{t.lana.paid}</p>
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mt-1" />
            <p className="text-xs text-[#94A3B8]">{t.lana.recording}</p>
          </div>
        )}

        {/* ── EXPIRED ────────────────────────────────────────────────── */}
        {modalState === 'EXPIRED' && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-5xl" role="img" aria-label="expired">⏱</p>
            <p className="text-lg font-bold text-[#0F172A]">{t.lana.expired}</p>
            <button
              onClick={() => void handleInitiate()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {t.lana.generate}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2 text-sm text-[#64748B] hover:text-[#0F172A]"
            >
              {t.card.cancel}
            </button>
          </div>
        )}

        {/* ── ERROR ──────────────────────────────────────────────────── */}
        {modalState === 'ERROR' && (
          <div className="flex flex-col gap-4">
            <p className="text-base font-semibold text-[#0F172A] text-center">
              {t.payment.errorGeneric}
            </p>
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
              onClick={() => void handleInitiate()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {t.lana.generate}
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
