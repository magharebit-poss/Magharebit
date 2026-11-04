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
import { buildPrintInfo, type ReceiptPrintInfo } from '../lib/printer/receipt-format';
import type { SaleResponse } from '../lib/sale-identity';
import type { HeldSale } from '../lib/card-approval';
import { useHeldPayment } from '../hooks/useHeldPayment';
import HeldPaymentPanel from './HeldPaymentPanel';
import ManagerPinModal from './ManagerPinModal';
import {
  canGenerateNewQr,
  interpretPoll,
  reduceCancel,
  type CancelStep,
  type LanaScreen,
  type PollReading,
} from '../lib/lana-poll';

// ── Modal states ─────────────────────────────────────────────────────────────
// IDLE · GENERATING (initiate in flight) · QR_DISPLAY (polling, countdown) ·
// STATUS_UNKNOWN (status checks keep failing: the customer may have paid, no new QR) ·
// PAID (recording) · PAID_UNSAVED (money taken, sale not saved) · SUCCESS ·
// EXPIRED (the SERVER confirmed expiry: a new QR is safe) · ERROR (initiate failed: no QR was shown)

type ModalState = LanaScreen;

// ── Props ────────────────────────────────────────────────────────────────────

interface LanaPaymentModalProps {
  totalPiastres: number;
  cartLines: CartLine[];
  cartDiscount?: Discount;
  shiftId: string;
  /** One id per sale, created by the page and reused on every retry of this sale. */
  clientTxId: string;
  customer?: CustomerProfile | null;
  onClose: () => void;   // cancel / close without payment
  onSuccess: (info?: ReceiptPrintInfo) => void; // cart cleared → new sale; info feeds the thermal receipt
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
  clientTxId,
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
  const [printInfo, setPrintInfo] = useState<ReceiptPrintInfo | null>(null);

  // Stable transaction ref — does NOT change on retry (each session is new).
  const transactionRef = useRef<string>(makeRef()).current;

  const timeoutSeconds = readTimeoutSeconds();

  // Consecutive failed status checks (see lib/lana-poll): from the third, the screen says "cannot confirm".
  const consecutiveFailuresRef = useRef(0);
  // Cancelling while the payment status is unknown needs a manager PIN (none -> pin -> authorized).
  const [cancelStep, setCancelStep] = useState<CancelStep>('none');
  const cancelStepRef = useRef<CancelStep>('none');
  cancelStepRef.current = cancelStep;
  const [checking, setChecking] = useState(false);
  const [stillUnreachable, setStillUnreachable] = useState(false);
  // A paid session records its sale once, whichever check sees "paid" first.
  const recordStartedRef = useRef(false);

  // ── Record transaction after Lana confirms payment ────────────────────────

  const showSavedReceipt = (data: SaleResponse) => {
    const cashierName =
      typeof window !== 'undefined'
        ? (sessionStorage.getItem('greengo_cashier_name') ?? '')
        : '';
    if (customer?.customerId && data.transactionId) {
      void issueStamp(customer.customerId, data.transactionId, onStampComplete);
    }
    const ct = computeCartTotals(cartLines, cartDiscount);
    setPrintInfo(buildPrintInfo({
      serverReceiptNumber: data.receiptNumber,
      serverSoldAt: data.soldAt ?? data.serverTimestamp,
      localId: data.transactionId ?? crypto.randomUUID(),
      nowIso: new Date().toISOString(),
    }));
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
  };

  // Lana already took the money, so a failed save keeps the payment on screen (PAID_UNSAVED) with a
  // retry that re-posts the same sale and never calls Lana again. Shared with the card modal.
  const held = useHeldPayment(showSavedReceipt);

  const recordTransaction = async (sid: string) => {
    const sale: HeldSale = {
      clientTxId,
      // The Lana session id is the reference a manager needs to refund the payment.
      approval: { code: sid, maskedPan: null, amountPiastres: totalPiastres },
      body: {
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
      },
    };
    held.hold(sale);
    await saveHeld();
  };

  const saveHeld = async () => {
    if ((await held.trySave()) === 'unsaved') setModalState('PAID_UNSAVED');
  };

  // ── Polling + countdown while a QR is on screen ───────────────────────────

  // One status check. A failed check never ends the session and never offers a new QR: the customer
  // may have paid, so "no answer" is not "not paid". Returns whether the server answered.
  const pollOnce = async (sid: string): Promise<boolean> => {
    let reading: PollReading;
    try {
      const res = await apiFetch(`/api/payments/lana/status/${sid}`, { cache: 'no-store' } as RequestInit);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { status: string };
      reading = { ok: true, status: data.status };
    } catch {
      reading = { ok: false };
    }
    const step = interpretPoll(consecutiveFailuresRef.current, reading);
    consecutiveFailuresRef.current = step.failures;

    if (step.screen === 'paid') {
      // Money received: always record the sale, and only once, even if a manager started to cancel.
      if (!recordStartedRef.current) {
        recordStartedRef.current = true;
        setCancelStep('none');
        setModalState('PAID');
        void recordTransaction(sid);
      }
      return reading.ok;
    }
    if (cancelStepRef.current === 'authorized') return reading.ok; // a manager already decided to cancel
    if (step.screen === 'expired') {
      setModalState((s) => (s === 'QR_DISPLAY' || s === 'STATUS_UNKNOWN' ? 'EXPIRED' : s));
    } else if (step.screen === 'waiting') {
      setModalState((s) => (s === 'STATUS_UNKNOWN' ? 'QR_DISPLAY' : s));
    } else if (step.screen === 'unknown') {
      setModalState((s) => (s === 'QR_DISPLAY' ? 'STATUS_UNKNOWN' : s));
    }
    return reading.ok;
  };

  // Polling continues in STATUS_UNKNOWN, and the effect does not restart when the screen switches
  // between QR_DISPLAY and STATUS_UNKNOWN (so the failure count and countdown are kept).
  const polling =
    sessionId !== null &&
    (modalState === 'QR_DISPLAY' || modalState === 'STATUS_UNKNOWN') &&
    cancelStep !== 'authorized';

  useEffect(() => {
    if (!polling || !sessionId) return;

    consecutiveFailuresRef.current = 0;
    setCountdown(timeoutSeconds);

    // Countdown ticks every second.
    const countdownInterval = setInterval(() => {
      setCountdown((c) => Math.max(0, c - 1));
    }, 1000);

    // Poll status every 2 seconds.
    const pollInterval = setInterval(() => {
      void pollOnce(sessionId);
    }, 2000);

    // MANDATORY cleanup — prevents stale intervals after unmount or state change.
    return () => {
      clearInterval(pollInterval);
      clearInterval(countdownInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, sessionId]);

  const handleCheckStatus = async () => {
    if (!sessionId) return;
    setChecking(true);
    setStillUnreachable(false);
    const answered = await pollOnce(sessionId);
    setChecking(false);
    setStillUnreachable(!answered);
  };

  // An unconfirmed payment must not be dropped silently by closing the browser.
  const holdingUnknown = modalState === 'STATUS_UNKNOWN' && cancelStep !== 'authorized';
  useEffect(() => {
    if (!holdingUnknown) return;
    const warn = (ev: BeforeUnloadEvent) => { ev.preventDefault(); ev.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [holdingUnknown]);

  // ── Initiate Lana payment ─────────────────────────────────────────────────

  const handleInitiate = async () => {
    // Never replace a QR code the customer may still pay: only before the first one, after the server
    // confirmed expiry, or after an initiate that produced no QR.
    if (!canGenerateNewQr(modalState, sessionId !== null && modalState !== 'EXPIRED')) return;
    recordStartedRef.current = false;
    consecutiveFailuresRef.current = 0;
    setCancelStep('none');
    setStillUnreachable(false);
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
    return <Receipt data={receipt} onDone={() => onSuccess(printInfo ?? undefined)} />;
  }

  // ── States that allow explicit close ──────────────────────────────────────

  const canClose =
    modalState === 'IDLE' ||
    modalState === 'EXPIRED' ||
    modalState === 'ERROR';

  // With a taken-but-unsaved payment on hold, closing is not allowed until a manager authorises the void.
  const showCloseButton =
    canClose ||
    (modalState === 'PAID_UNSAVED' && held.state?.step !== 'pin' && !held.saving) ||
    (modalState === 'STATUS_UNKNOWN' && cancelStep !== 'pin' && !checking);
  const handleCloseClick = () => {
    if (modalState === 'STATUS_UNKNOWN') {
      // Leaving with an unconfirmed payment needs a manager PIN first.
      if (cancelStep === 'authorized') onClose();
      else setCancelStep((s) => reduceCancel(s, 'REQUEST'));
      return;
    }
    if (modalState !== 'PAID_UNSAVED' || held.state?.step === 'void_authorized') {
      onClose();
      return;
    }
    held.dispatch({ type: 'REQUEST_CLOSE' });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl relative">

        {/* Close × — only in states where the cashier can safely abort (manager PIN first if a payment is held) */}
        {showCloseButton && (
          <button
            onClick={handleCloseClick}
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

        {/* ── STATUS_UNKNOWN: checks keep failing, the customer may have paid. No new QR. ── */}
        {modalState === 'STATUS_UNKNOWN' && sessionId && cancelStep !== 'authorized' && (
          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-[#FFF8E1] border border-[#F0B429] p-3 text-center">
              <p className="text-base font-bold text-[#8A5A00]">{t.lana.unknownTitle}</p>
              <p className="text-sm text-[#8A5A00] mt-1">{t.lana.unknownBody}</p>
            </div>
            <p className="text-sm text-[#0F172A] text-center font-mono" dir="ltr">
              {t.lana.sessionLabel} {sessionId}
            </p>
            {stillUnreachable && (
              <p
                role="alert"
                className="text-sm font-semibold text-[#D32F2F] bg-red-50 border border-red-200 rounded-lg p-3 text-center"
              >
                {t.lana.unknownStillUnreachable}
              </p>
            )}
            <button
              onClick={() => void handleCheckStatus()}
              disabled={checking || cancelStep === 'pin'}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {checking ? t.payment.processing : t.lana.checkStatus}
            </button>
            <button
              onClick={() => setCancelStep((s) => reduceCancel(s, 'REQUEST'))}
              disabled={checking || cancelStep === 'pin'}
              className="w-full py-2 text-sm font-medium text-[#D32F2F] hover:underline disabled:opacity-50"
            >
              {t.lana.cancelWithPin}
            </button>
            {cancelStep === 'pin' && (
              <ManagerPinModal
                action="lana_status_unknown_cancel"
                referenceId={clientTxId}
                note="lana payment status unknown: manager authorised cancel"
                onAuthorized={() => setCancelStep((s) => reduceCancel(s, 'AUTHORIZED'))}
                onCancel={() => setCancelStep((s) => reduceCancel(s, 'CANCELLED'))}
              />
            )}
          </div>
        )}

        {/* After the manager PIN: the cart stays; the payment must be checked in Lana by hand. */}
        {modalState === 'STATUS_UNKNOWN' && sessionId && cancelStep === 'authorized' && (
          <div className="flex flex-col gap-4">
            <p className="text-base font-bold text-[#0F172A] text-center">{t.lana.unknownVoidTitle}</p>
            <p className="text-sm text-[#0F172A] text-center">
              {t.lana.unknownVoidBody
                .replace('{ref}', sessionId)
                .replace('{amount}', formatPrice(totalPiastres))}
            </p>
            <p className="text-2xl text-[#0F172A] text-center font-mono font-bold" dir="ltr">{sessionId}</p>
            <button
              onClick={() => { setCancelStep((s) => reduceCancel(s, 'DONE')); onClose(); }}
              className="w-full bg-[#1A5276] hover:bg-[#154360] text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {t.lana.voidDone}
            </button>
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

        {/* ── PAID_UNSAVED: Lana took the money, the sale was not saved ─────────── */}
        {modalState === 'PAID_UNSAVED' && held.state && (
          <HeldPaymentPanel
            state={held.state}
            saving={held.saving}
            labels={t.lana}
            referenceLabel={t.lana.sessionLabel}
            processingLabel={t.payment.processing}
            voidAction="lana_payment_void"
            voidNote="lana payment not saved: manager authorised close"
            clientTxId={clientTxId}
            onRetry={() => void saveHeld()}
            dispatch={held.dispatch}
            onClose={onClose}
          />
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
            {canGenerateNewQr(modalState, sessionId !== null) ? (
              <button
                onClick={() => void handleInitiate()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {t.lana.generate}
              </button>
            ) : (
              // A QR was shown and its outcome is not confirmed: check it, never replace it.
              <button
                onClick={() => setModalState('STATUS_UNKNOWN')}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition-colors"
              >
                {t.lana.checkStatus}
              </button>
            )}
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
