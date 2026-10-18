'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatPrice, type ShiftSummary } from '../../lib/cart';
import { useLanguage } from '../../context/LanguageContext';
import ZReport from '../../components/ZReport';
import { apiFetch, clearToken } from '../../lib/api';

const SMALL_VARIANCE_THRESHOLD = 5000; // 50 MAD in piastres

type Stage = 'counting' | 'report';

function ShiftCloseInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  const [shiftId, setShiftId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [closedSummary, setClosedSummary] = useState<ShiftSummary | null>(null);
  const [stage, setStage] = useState<Stage>('counting');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [cashInputMad, setCashInputMad] = useState<string>('');

  // Resolve shiftId on mount
  useEffect(() => {
    const fromQuery = searchParams.get('id');
    const fromSession = typeof window !== 'undefined'
      ? sessionStorage.getItem('greengo_shift_id')
      : null;
    const id = fromQuery ?? fromSession;
    if (!id) {
      router.push('/');
      return;
    }
    setShiftId(id);
  }, [router, searchParams]);

  // Load summary once shiftId is known
  useEffect(() => {
    if (!shiftId) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    apiFetch(`/api/shifts/summary?id=${encodeURIComponent(shiftId)}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error((body as { error?: string }).error ?? 'load failed');
        return body as ShiftSummary;
      })
      .then((data) => {
        if (cancelled) return;
        setSummary(data);
        // If shift is already closed, jump straight to Z-report (read-only)
        if (data.status === 'closed') {
          setClosedSummary(data);
          setStage('report');
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(t.shiftClose.errorLoad);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [shiftId, t.shiftClose.errorLoad]);

  const inputPiastres = useMemo(() => {
    const n = Number(cashInputMad);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  }, [cashInputMad]);

  const expectedCash = useMemo(() => {
    if (!summary) return 0;
    return summary.openingFloatPiastres + summary.cashTotalPiastres;
  }, [summary]);

  const variance = inputPiastres - expectedCash;
  const absVariance = Math.abs(variance);
  const hasInput = cashInputMad.trim() !== '';

  const varianceBadge = useMemo(() => {
    if (!hasInput) return null;
    if (variance === 0) {
      return { label: t.shiftClose.matchBadge, classes: 'bg-green-50 text-green-700 border-green-200' };
    }
    if (absVariance <= SMALL_VARIANCE_THRESHOLD) {
      return { label: t.shiftClose.smallVariance, classes: 'bg-blue-50 text-blue-700 border-blue-200' };
    }
    return { label: t.shiftClose.largeVariance, classes: 'bg-orange-50 text-orange-700 border-orange-200' };
  }, [hasInput, variance, absVariance, t.shiftClose]);

  const handleConfirm = async () => {
    if (!shiftId || !hasInput) return;
    setSubmitting(true);
    setCloseError(null);
    try {
      const res = await apiFetch('/api/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId, closingFloat: inputPiastres }),
      });
      const body = await res.json();
      if (!res.ok) {
        const msg = (body as { error?: string }).error;
        throw new Error(
          msg === 'Shift already closed' ? t.shiftClose.shiftClosed : t.shiftClose.errorClose,
        );
      }
      setClosedSummary(body as ShiftSummary);
      setStage('report');
    } catch (e: unknown) {
      setCloseError(e instanceof Error ? e.message : t.shiftClose.errorClose);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/pos');
  };

  const handleDone = () => {
    clearToken();
    sessionStorage.removeItem('greengo_shift_id');
    sessionStorage.removeItem('greengo_cashier_name');
    sessionStorage.removeItem('greengo_cashier_id');
    router.push('/');
  };

  // ── Render states ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 border-4 border-[#2E8B57] border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  if (loadError || !summary) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
        <div className="bg-white rounded-2xl border border-red-200 p-8 max-w-md text-center">
          <p className="text-red-600 font-semibold mb-4">{loadError ?? t.shiftClose.errorLoad}</p>
          <button
            onClick={() => router.push('/pos')}
            className="px-4 py-2 rounded-lg border border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC]"
          >
            {t.shiftClose.cancel}
          </button>
        </div>
      </main>
    );
  }

  if (stage === 'report' && closedSummary) {
    return <ZReport summary={closedSummary} onDone={handleDone} />;
  }

  // Counting stage
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#F8FAFC] p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.06)] border border-[#E2E8F0] p-8">
        <h1 className="text-2xl font-bold text-[#0F172A] text-center mb-1">{t.shiftClose.title}</h1>
        <p className="text-sm text-[#64748B] text-center mb-6">{t.shiftClose.subtitle}</p>

        {/* Summary preview */}
        <div className="bg-[#F8FAFC] rounded-xl p-4 mb-5 space-y-1.5 text-sm">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-2">
            {t.shiftClose.summaryHeading}
          </p>
          <div className="flex justify-between">
            <span className="text-[#64748B]">{t.shiftClose.totalSales}</span>
            <span className="font-semibold text-[#0F172A] font-mono">
              {formatPrice(summary.totalSalesPiastres)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748B]">{t.shiftClose.transactions}</span>
            <span className="font-semibold text-[#0F172A] font-mono">{summary.txCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#64748B]">{t.shiftClose.cashSales}</span>
            <span className="font-semibold text-[#0F172A] font-mono">
              {formatPrice(summary.cashTotalPiastres)}
            </span>
          </div>
        </div>

        {/* Zero-transactions warning */}
        {summary.txCount === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
            <span className="text-amber-600 text-lg flex-shrink-0">⚠️</span>
            <div>
              <p className="text-sm font-semibold text-amber-800 font-cairo">
                {t.shiftClose.zeroTxWarning}
              </p>
              <p className="text-xs text-amber-600 mt-0.5">
                {t.shiftClose.zeroTxNote}
              </p>
            </div>
          </div>
        )}

        {/* Cash count input */}
        <label className="block text-sm font-semibold text-[#0F172A] mb-2">
          {t.shiftClose.cashCount}
        </label>
        <div className="relative mb-3">
          <input
            type="number"
            min="0"
            step="0.01"
            value={cashInputMad}
            onChange={(e) => setCashInputMad(e.target.value)}
            placeholder="0.00"
            disabled={submitting}
            autoFocus
            className="w-full h-14 px-4 rounded-xl border border-[#E2E8F0] focus:outline-none focus:ring-2 focus:ring-[#2E8B57] focus:border-transparent text-2xl font-mono font-bold"
          />
          <span className="absolute end-4 top-1/2 -translate-y-1/2 text-sm text-[#64748B] pointer-events-none">
            MAD
          </span>
        </div>

        {/* Real-time expected vs variance */}
        <div className="bg-[#F8FAFC] rounded-xl p-4 mb-5 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[#64748B]">{t.shiftClose.expected}</span>
            <span className="font-mono text-[#0F172A]">{formatPrice(expectedCash)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[#64748B]">{t.shiftClose.variance}</span>
            <span
              className={`font-mono font-bold ${
                !hasInput
                  ? 'text-[#94A3B8]'
                  : variance === 0
                  ? 'text-green-600'
                  : absVariance <= SMALL_VARIANCE_THRESHOLD
                  ? 'text-blue-600'
                  : 'text-orange-600'
              }`}
            >
              {hasInput ? `${variance >= 0 ? '+' : '−'}${formatPrice(absVariance)}` : '—'}
            </span>
          </div>
          {varianceBadge && (
            <div
              className={`mt-2 px-3 py-1.5 rounded-lg border text-xs font-medium text-center ${varianceBadge.classes}`}
            >
              {varianceBadge.label}
            </div>
          )}
        </div>

        {closeError && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 text-center">
            {closeError}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleCancel}
            disabled={submitting}
            className="flex-1 border border-[#E2E8F0] text-[#374151] rounded-xl py-3 font-medium hover:bg-[#F8FAFC] transition-colors disabled:opacity-50"
          >
            {t.shiftClose.cancel}
          </button>
          <button
            onClick={handleConfirm}
            disabled={submitting || !hasInput}
            className="flex-1 bg-[#2E8B57] hover:bg-[#1A5C3A] text-white font-semibold rounded-xl py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? t.shiftClose.confirming : t.shiftClose.confirm}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function ShiftClosePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
          <div className="w-8 h-8 border-4 border-[#2E8B57] border-t-transparent rounded-full animate-spin" />
        </main>
      }
    >
      <ShiftCloseInner />
    </Suspense>
  );
}
