'use client';

import { useState } from 'react';
import { useAdmin } from './AdminShell';
import { BTN, type Lang } from './adminUi';

type Format = 'xlsx' | 'csv';

const COPY: Record<Lang, {
  excel: string; csv: string; busy: string; label: string; viewer: string; forbidden: string; limited: string;
  audit: string; range: string; failed: string; truncated: (n: number) => string; done: (n: number) => string;
}> = {
  ar: {
    excel: 'Excel', csv: 'CSV', busy: 'جارٍ التصدير…', label: 'تصدير', viewer: 'التصدير متاح للمالك والمشغّل فقط',
    forbidden: 'ليست لديك صلاحية التصدير', limited: 'تصديرات كثيرة، حاول بعد دقائق', audit: 'تعذّر التسجيل في سجل التدقيق، لم يتم التصدير',
    range: 'نطاق التواريخ غير صالح', failed: 'تعذّر التصدير',
    truncated: (n) => `تم تصدير أول ${n} سطر فقط. ضيّق التصفية للحصول على الباقي.`, done: (n) => `تم تصدير ${n} سطر`,
  },
  fr: {
    excel: 'Excel', csv: 'CSV', busy: 'Export…', label: 'Exporter', viewer: 'Export réservé aux propriétaires et opérateurs',
    forbidden: 'Vous n’avez pas le droit d’exporter', limited: 'Trop d’exports, réessayez dans quelques minutes', audit: 'Journal d’audit indisponible : export annulé',
    range: 'Période invalide', failed: 'Export impossible',
    truncated: (n) => `Seules les ${n} premières lignes ont été exportées. Affinez le filtre pour le reste.`, done: (n) => `${n} lignes exportées`,
  },
  en: {
    excel: 'Excel', csv: 'CSV', busy: 'Exporting…', label: 'Export', viewer: 'Export is limited to owners and operators',
    forbidden: 'You are not allowed to export', limited: 'Too many exports, try again in a few minutes', audit: 'Audit log unavailable: export cancelled',
    range: 'Invalid date range', failed: 'Export failed',
    truncated: (n) => `Only the first ${n} rows were exported. Narrow the filter for the rest.`, done: (n) => `${n} rows exported`,
  },
};

/** Downloads the current view of a dataset as .xlsx or .csv (owner/operator). Filters = the screen's applied filters. */
export default function ExportButton({ dataset, filters = {} }: { dataset: 'commission-rates' | 'leads' | 'sales'; filters?: Record<string, string> }) {
  const { lang, locale, actor } = useAdmin();
  const c = COPY[lang];
  const allowed = actor.role !== 'viewer';
  const [busy, setBusy] = useState<Format | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function run(format: Format) {
    setBusy(format);
    setMsg(null);
    try {
      const p = new URLSearchParams({ format, locale });
      for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
      const r = await fetch(`/api/admin/export/${dataset}?${p}`);
      if (!r.ok) {
        const err = ((await r.json().catch(() => ({}))) as { error?: string }).error;
        setMsg({ kind: 'err', text: r.status === 403 ? c.forbidden : r.status === 429 ? c.limited : err === 'audit_unavailable' ? c.audit : err === 'invalid_range' ? c.range : c.failed });
        return;
      }
      const rows = Number(r.headers.get('X-Export-Rows') ?? 0);
      const name = /filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') ?? '')?.[1] ?? `export.${format}`;
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setMsg(r.headers.get('X-Export-Truncated') === '1' ? { kind: 'err', text: c.truncated(rows) } : { kind: 'ok', text: c.done(rows) });
    } catch {
      setMsg({ kind: 'err', text: c.failed });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div role="group" aria-label={c.label} className="flex items-center gap-2">
        {(['xlsx', 'csv'] as const).map((f) => (
          <button
            key={f} type="button" onClick={() => void run(f)} disabled={!allowed || busy !== null}
            title={allowed ? undefined : c.viewer} data-export={f}
            className={BTN}
          >
            {busy === f ? c.busy : `${c.label} ${f === 'xlsx' ? c.excel : c.csv}`}
          </button>
        ))}
      </div>
      {!allowed && <span className="text-xs text-[var(--adm-muted)]">{c.viewer}</span>}
      {msg && <span role={msg.kind === 'err' ? 'alert' : 'status'} className={`text-xs ${msg.kind === 'err' ? 'text-[var(--adm-error)]' : 'text-[var(--adm-muted)]'}`}>{msg.text}</span>}
    </div>
  );
}
