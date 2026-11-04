'use client';

// Sales queued offline that the server refused for good (409 id conflict, 400 invalid). They live in the
// local SQLite queue of the Tauri shell, so this panel exists only there: in a browser (and on Android,
// which has no local queue in this app) it renders nothing. Nothing is ever deleted from here.

import { useCallback, useEffect, useState } from 'react';
import { useLanguage } from '../context/LanguageContext';
import { formatPrice } from '../lib/cart';
import { isTauri, listRejectedTransactions } from '../lib/offline-queue';
import {
  canViewVariances,
  formatVarianceTime,
  rejectedExportFileName,
  rejectedReasonKey,
  rejectedToCsv,
  summarizeRejected,
  type RejectedSummary,
} from '../lib/variances';

interface Props {
  tenantId: string;
  timeZone: string;
  role: string;
}

export default function RejectedSalesPanel({ tenantId, timeZone, role }: Props) {
  const { t } = useLanguage();
  const tv = t.variances;
  const [native, setNative] = useState(false);
  const [rows, setRows] = useState<RejectedSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  // Decided after mount so server and client render the same markup first.
  useEffect(() => { setNative(isTauri()); }, []);

  const load = useCallback(async () => {
    try {
      const raw = await listRejectedTransactions(tenantId);
      setRows(raw.map(summarizeRejected));
      setError('');
    } catch {
      setError(tv.rejectedErrorLoad);
    } finally {
      setLoaded(true);
    }
  }, [tenantId, tv.rejectedErrorLoad]);

  useEffect(() => { if (native) void load(); }, [native, load]);

  if (!native) return null;

  const exportCsv = () => {
    if (!canViewVariances(role) || rows.length === 0) return; // manager and above only
    try {
      const blob = new Blob([rejectedToCsv(rows)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = rejectedExportFileName(new Date());
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError(tv.rejectedExportError);
    }
  };

  const methodLabel = (m: string | null): string =>
    m !== null && m in tv.methods ? tv.methods[m as keyof typeof tv.methods] : '—';

  return (
    <section className="mt-8 bg-white rounded-lg border border-ink-muted/20">
      <div className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h2 className="text-lg font-extrabold text-ink">{tv.rejectedTitle}</h2>
          <p className="text-sm text-ink-muted mt-1 max-w-prose">{tv.rejectedHelp}</p>
        </div>
        <button
          onClick={exportCsv}
          disabled={rows.length === 0}
          className="min-h-12 px-4 rounded bg-gold-400 hover:bg-gold-500 disabled:opacity-50 text-brand-950 font-semibold"
        >
          {tv.rejectedExport}
        </button>
      </div>

      {error && (
        <p role="alert" className="mx-4 mb-3 text-sm font-semibold text-danger">{error}</p>
      )}

      {loaded && rows.length === 0 && !error && (
        <p className="px-4 pb-4 text-sm text-ink-muted">{tv.rejectedEmpty}</p>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-50 text-ink-muted">
                <th className="text-start font-semibold px-3 py-3">{tv.rejectedColReceipt}</th>
                <th className="text-start font-semibold px-3 py-3">{tv.rejectedColQueued}</th>
                <th className="text-end font-semibold px-3 py-3">{tv.rejectedColTotal}</th>
                <th className="text-start font-semibold px-3 py-3">{tv.rejectedColMethod}</th>
                <th className="text-start font-semibold px-3 py-3">{tv.rejectedColReason}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.localId} className="border-t border-ink-muted/15">
                  <td className="px-3 py-3 font-mono text-ink" dir="ltr">{r.localReceiptRef ?? r.localId.slice(0, 8)}</td>
                  <td className="px-3 py-3 text-ink" dir="ltr">{r.createdAt ? formatVarianceTime(r.createdAt, timeZone) : '—'}</td>
                  <td className="px-3 py-3 text-end tabular-nums text-ink" dir="ltr">
                    {r.totalPiastres === null ? '—' : formatPrice(r.totalPiastres)}
                  </td>
                  <td className="px-3 py-3 text-ink">{methodLabel(r.paymentMethod)}</td>
                  <td className="px-3 py-3">
                    <span className="inline-block rounded-full bg-gold-100 text-ink px-3 py-1 text-xs font-medium">
                      {tv.rejectedReasons[rejectedReasonKey(r.reason)]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
