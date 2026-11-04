'use client';

// Manager view of stock variances: sales that needed more stock than was on hand. Each row can be
// acknowledged once a manager has looked at it. Dark header, light content, brand tokens only.
// Logical CSS (start/end) throughout so the table mirrors correctly in Arabic.

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLanguage } from '../../context/LanguageContext';
import { BrandLockup } from '../../components/brand/BrandLockup';
import { apiFetch, getToken } from '../../lib/api';
import { pickName } from '../../lib/names';
import { DEFAULT_TIME_ZONE } from '../../lib/printer/receipt-format';
import {
  PAGE_SIZE,
  applyAcknowledged,
  buildVarianceQuery,
  canViewVariances,
  formatQuantity,
  formatVarianceTime,
  pageInfo,
  quantityWithUnit,
  reasonLabel,
  type StatusFilter,
  type StockVariance,
  type VarianceListResponse,
} from '../../lib/variances';

const TIME_ZONE = process.env.NEXT_PUBLIC_TENANT_TIMEZONE || DEFAULT_TIME_ZONE;

const STATUSES: StatusFilter[] = ['open', 'acknowledged', 'all'];

export default function VariancesPage() {
  const router = useRouter();
  const { t, lang, dir } = useLanguage();
  const tv = t.variances;

  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('open');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<StockVariance[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Managers and above only (the server enforces the same rule on every call).
  useEffect(() => {
    const r = sessionStorage.getItem('greengo_cashier_role') ?? '';
    if (!getToken()) { router.replace('/'); return; }
    if (!canViewVariances(r)) { router.replace('/pos'); return; }
    setReady(true);
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/stock-variances${buildVarianceQuery({ status, limit: PAGE_SIZE, offset })}`);
      if (res.status === 403) { setError(tv.errorForbidden); return; }
      if (!res.ok) { setError(tv.errorLoad); return; }
      const data = (await res.json()) as VarianceListResponse;
      // The last row of a later page was just acknowledged away: step back instead of showing an empty page.
      if (data.items.length === 0 && offset > 0 && data.total > 0) {
        setOffset(Math.max(0, offset - PAGE_SIZE));
        return;
      }
      setItems(data.items);
      setTotal(data.total);
      setError('');
    } catch {
      setError(tv.errorLoad);
    } finally {
      setLoading(false);
    }
  }, [status, offset, tv.errorForbidden, tv.errorLoad]);

  useEffect(() => { if (ready) void load(); }, [ready, load]);

  const changeStatus = (s: StatusFilter) => {
    if (s === status) return;
    setStatus(s);
    setOffset(0);
  };

  const acknowledge = async (v: StockVariance) => {
    setBusyId(v.variance_id);
    setError('');
    try {
      const res = await apiFetch(`/api/stock-variances/${v.variance_id}/acknowledge`, { method: 'PATCH' });
      if (!res.ok) { setError(res.status === 403 ? tv.errorForbidden : tv.errorAcknowledge); return; }
      const ack = (await res.json()) as { acknowledged_by: string | null; acknowledged_at: string | null };
      const next = applyAcknowledged(items, total, v.variance_id, ack, status);
      setItems(next.items);
      setTotal(next.total);
      void load();
    } catch {
      setError(tv.errorAcknowledge);
    } finally {
      setBusyId(null);
    }
  };

  if (!ready) return null;

  const info = pageInfo(total, offset, items.length);
  const reasons = tv.reasons;

  return (
    <main dir={dir} className="min-h-screen bg-surface-light text-ink">
      <header className="bg-brand-950 text-white px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push('/pos')}
          className="min-h-12 min-w-12 px-3 rounded text-gold-400 hover:text-gold-500 font-semibold flex items-center gap-2"
        >
          <span aria-hidden="true" className="inline-block rtl:rotate-180">←</span>
          {tv.back}
        </button>
        <BrandLockup height={32} alt={t.brand.logoAlt} />
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-2xl font-extrabold text-ink">{tv.title}</h1>
        <p className="text-ink-muted mt-1 mb-5 max-w-prose">{tv.subtitle}</p>

        <div role="tablist" className="flex flex-wrap gap-2 mb-4">
          {STATUSES.map((s) => {
            const label = s === 'open' ? tv.filterOpen : s === 'acknowledged' ? tv.filterAcknowledged : tv.filterAll;
            const active = s === status;
            return (
              <button
                key={s}
                role="tab"
                aria-selected={active}
                onClick={() => changeStatus(s)}
                className={`min-h-12 px-5 rounded font-semibold border ${
                  active
                    ? 'bg-brand-950 text-white border-brand-950'
                    : 'bg-white text-ink border-ink-muted/30 hover:bg-brand-50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mb-3 text-sm font-semibold text-danger">{error}</p>
        )}

        <div className="bg-white rounded-lg border border-ink-muted/20 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-50 text-ink-muted">
                <th className="text-start font-semibold px-3 py-3">{tv.colProduct}</th>
                <th className="text-end font-semibold px-3 py-3">{tv.colExpected}</th>
                <th className="text-end font-semibold px-3 py-3">{tv.colActual}</th>
                <th className="text-end font-semibold px-3 py-3">{tv.colMissing}</th>
                <th className="text-start font-semibold px-3 py-3">{tv.colReason}</th>
                <th className="text-start font-semibold px-3 py-3">{tv.colRegister}</th>
                <th className="text-start font-semibold px-3 py-3">{tv.colTime}</th>
                <th className="text-start font-semibold px-3 py-3">{tv.colAction}</th>
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-ink-muted">{tv.loading}</td></tr>
              )}
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-ink-muted">{tv.empty}</td></tr>
              )}
              {items.map((v) => {
                const acknowledged = v.acknowledged_at !== null;
                const units = t.products.uomLabels as unknown as Record<string, string>;
                return (
                  <tr key={v.variance_id} className="border-t border-ink-muted/15 align-top">
                    <td className="px-3 py-3 font-semibold text-ink">
                      {pickName(lang, v.product_name_ar, v.product_name_fr)}
                    </td>
                    <td className="px-3 py-3 text-end tabular-nums" dir="ltr">
                      {quantityWithUnit(v.expected_qty, v.uom, units)}
                    </td>
                    <td className="px-3 py-3 text-end tabular-nums" dir="ltr">
                      {formatQuantity(v.actual_qty)}
                    </td>
                    <td className="px-3 py-3 text-end tabular-nums font-bold text-danger" dir="ltr">
                      {formatQuantity(v.missing_qty)}
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-block rounded-full bg-gold-100 text-ink px-3 py-1 text-xs font-medium">
                        {reasonLabel(v.reason, reasons)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-ink">{v.register_name ?? '—'}</td>
                    <td className="px-3 py-3 text-ink" dir="ltr">{formatVarianceTime(v.detected_at, TIME_ZONE)}</td>
                    <td className="px-3 py-3">
                      {acknowledged ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-block self-start rounded-full bg-brand-100 text-brand-700 px-3 py-1 text-xs font-semibold">
                            ✓ {tv.acknowledgedLabel}
                          </span>
                          <span className="text-xs text-ink-muted">
                            {pickName(lang, v.acknowledged_by_name_ar, v.acknowledged_by_name_fr)}
                            {v.acknowledged_at ? ` · ${formatVarianceTime(v.acknowledged_at, TIME_ZONE)}` : ''}
                          </span>
                        </div>
                      ) : (
                        <button
                          onClick={() => void acknowledge(v)}
                          disabled={busyId === v.variance_id}
                          className="min-h-12 px-4 rounded bg-gold-400 hover:bg-gold-500 disabled:opacity-50 text-brand-950 font-semibold"
                        >
                          {busyId === v.variance_id ? tv.acknowledging : tv.acknowledge}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 mt-4">
          <button
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={!info.hasPrev}
            className="min-h-12 px-5 rounded bg-white border border-ink-muted/30 text-ink font-semibold disabled:opacity-40"
          >
            {tv.prev}
          </button>
          <span className="text-sm text-ink-muted" dir="ltr">
            {tv.range.replace('{from}', String(info.from)).replace('{to}', String(info.to)).replace('{total}', String(info.total))}
          </span>
          <button
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={!info.hasNext}
            className="min-h-12 px-5 rounded bg-white border border-ink-muted/30 text-ink font-semibold disabled:opacity-40"
          >
            {tv.next}
          </button>
        </div>
      </div>
    </main>
  );
}
