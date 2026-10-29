'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './AdminShell';
import { BTN, BTN_PRIMARY, DURATIONS, FIELD, PLAN_STYLE, STATUS_LABEL, daysLeft, fmtDate, initialQuery, type Lang } from './adminUi';

type LicStatus = 'active' | 'expired' | 'revoked';
interface Terminal { machineId: string; firstSeenAt: string; lastSeenAt: string }
interface License {
  id: string;
  key: string;
  merchantId: string;
  storeName: string;
  plan: string;
  durationMonths: number;
  durationDays?: number;
  isTrial?: boolean;
  issuedAt: string;
  expiresAt: string;
  status: LicStatus;
  terminals?: Terminal[];
  maxRegisters: number;
  revokedAt?: string;
  revokedBy?: string;
}

const LIMIT = 25;
const STATUS_STYLE: Record<LicStatus, string> = {
  active: 'bg-[#DCFCE7] text-[#166534]',
  expired: 'bg-[#FEE2E2] text-[#991B1B]',
  revoked: 'bg-[#E5E7EB] text-[#374151]',
};

const COPY: Record<Lang, {
  title: string; subtitle: string; search: string; status: string; allStatuses: string; apply: string; refresh: string;
  key: string; store: string; plan: string; expires: string; terminals: string; empty: string; loading: string; error: string; unavailable: string;
  total: string; prev: string; next: string; page: string; statuses: Record<LicStatus, string>; trial: string; days: (n: number) => string;
  details: string; close: string; copy: string; copied: string; issued: string; noTerminals: string; release: string; lastSeen: string;
  extend: string; extendHelp: string; byMonths: string; byDays: string; amount: string; reason: string; extendBtn: string; revoke: string; revokeHelp: string; revokeBtn: string; confirmRevoke: string;
  done: string; auditOk: string; auditFail: string; failed: string; forbidden: string; revokedCannot: string; readOnly: string; months: (n: number) => string; merchant: string;
}> = {
  ar: {
    title: 'التراخيص', subtitle: 'مفاتيح الترخيص، الأجهزة المسجّلة، التمديد والإلغاء', search: 'بحث بالمفتاح أو المتجر', status: 'الحالة', allStatuses: 'كل الحالات', apply: 'تطبيق', refresh: 'تحديث',
    key: 'المفتاح', store: 'المتجر', plan: 'الباقة', expires: 'ينتهي', terminals: 'الأجهزة', empty: 'لا توجد تراخيص مطابقة', loading: 'جارٍ التحميل…', error: 'تعذّر تحميل التراخيص', unavailable: 'قاعدة البيانات غير متاحة',
    total: 'ترخيص', prev: 'السابق', next: 'التالي', page: 'صفحة', statuses: STATUS_LABEL.ar.license as Record<LicStatus, string>, trial: 'تجريبي', days: (n) => `${n} يوم`,
    details: 'تفاصيل الترخيص', close: 'إغلاق', copy: 'نسخ المفتاح', copied: 'تم النسخ', issued: 'أُصدر', noTerminals: 'لا توجد أجهزة مسجّلة', release: 'تحرير', lastSeen: 'آخر ظهور',
    extend: 'تمديد الاشتراك', extendHelp: 'يُضاف من تاريخ الانتهاء الحالي (أو من اليوم إن انتهى).', byMonths: 'بالأشهر', byDays: 'بالأيام', amount: 'المقدار', reason: 'السبب (اختياري)', extendBtn: 'تمديد',
    revoke: 'إلغاء الترخيص', revokeHelp: 'نهائي: لا يمكن التراجع. التاجر وتراخيصه الأخرى لا تتأثر.', revokeBtn: 'إلغاء هذا الترخيص', confirmRevoke: 'أؤكد إلغاء هذا الترخيص نهائياً',
    done: 'تم', auditOk: 'سُجّل الإجراء في سجل التدقيق', auditFail: 'تحذير: لم يُسجَّل الإجراء في سجل التدقيق', failed: 'تعذّر تنفيذ الإجراء', forbidden: 'ليست لديك صلاحية التعديل', revokedCannot: 'الترخيص ملغى', readOnly: 'حسابك للقراءة فقط',
    months: (n) => (n === 1 ? 'شهر' : n === 12 ? 'سنة' : n === 24 ? 'سنتان' : `${n} أشهر`), merchant: 'التاجر',
  },
  fr: {
    title: 'Licences', subtitle: 'Clés de licence, terminaux enregistrés, prolongation et révocation', search: 'Rechercher clé ou commerce', status: 'Statut', allStatuses: 'Tous les statuts', apply: 'Appliquer', refresh: 'Actualiser',
    key: 'Clé', store: 'Commerce', plan: 'Formule', expires: 'Expire', terminals: 'Terminaux', empty: 'Aucune licence correspondante', loading: 'Chargement…', error: 'Impossible de charger les licences', unavailable: 'Base de données indisponible',
    total: 'licences', prev: 'Précédent', next: 'Suivant', page: 'Page', statuses: STATUS_LABEL.fr.license as Record<LicStatus, string>, trial: 'Essai', days: (n) => `${n} j`,
    details: 'Détail de la licence', close: 'Fermer', copy: 'Copier la clé', copied: 'Copié', issued: 'Émise', noTerminals: 'Aucun terminal enregistré', release: 'Libérer', lastSeen: 'Vu le',
    extend: 'Prolonger l’abonnement', extendHelp: 'Ajouté à partir de l’échéance actuelle (ou d’aujourd’hui si expirée).', byMonths: 'En mois', byDays: 'En jours', amount: 'Quantité', reason: 'Motif (facultatif)', extendBtn: 'Prolonger',
    revoke: 'Révoquer la licence', revokeHelp: 'Définitif. Le commerçant et ses autres licences ne sont pas touchés.', revokeBtn: 'Révoquer cette licence', confirmRevoke: 'Je confirme la révocation définitive de cette licence',
    done: 'Fait', auditOk: 'Action inscrite au journal d’audit', auditFail: 'Attention : action non inscrite au journal d’audit', failed: 'Action impossible', forbidden: 'Vous n’avez pas le droit de modifier', revokedCannot: 'Licence révoquée', readOnly: 'Votre compte est en lecture seule',
    months: (n) => (n === 1 ? '1 mois' : n === 12 ? '1 an' : n === 24 ? '2 ans' : `${n} mois`), merchant: 'Commerçant',
  },
  en: {
    title: 'Licenses', subtitle: 'License keys, registered terminals, extend and revoke', search: 'Search key or shop', status: 'Status', allStatuses: 'All statuses', apply: 'Apply', refresh: 'Refresh',
    key: 'Key', store: 'Shop', plan: 'Plan', expires: 'Expires', terminals: 'Terminals', empty: 'No matching licenses', loading: 'Loading…', error: 'Could not load licenses', unavailable: 'Database unavailable',
    total: 'licenses', prev: 'Previous', next: 'Next', page: 'Page', statuses: STATUS_LABEL.en.license as Record<LicStatus, string>, trial: 'Trial', days: (n) => `${n} d`,
    details: 'License details', close: 'Close', copy: 'Copy key', copied: 'Copied', issued: 'Issued', noTerminals: 'No terminals registered', release: 'Release', lastSeen: 'Last seen',
    extend: 'Extend subscription', extendHelp: 'Added from the current expiry (or from today if expired).', byMonths: 'In months', byDays: 'In days', amount: 'Amount', reason: 'Reason (optional)', extendBtn: 'Extend',
    revoke: 'Revoke license', revokeHelp: 'Permanent. The merchant and its other licenses are not affected.', revokeBtn: 'Revoke this license', confirmRevoke: 'I confirm the permanent revocation of this license',
    done: 'Done', auditOk: 'Action recorded in the audit log', auditFail: 'Warning: action was not recorded in the audit log', failed: 'Action failed', forbidden: 'You are not allowed to edit', revokedCannot: 'License is revoked', readOnly: 'Your account is read-only',
    months: (n) => (n === 1 ? '1 month' : n === 12 ? '1 year' : n === 24 ? '2 years' : `${n} months`), merchant: 'Merchant',
  },
};

export default function LicensesTable() {
  const { lang, actor, isRTL } = useAdmin();
  const c = COPY[lang];
  const canWrite = actor.role !== 'viewer';

  const [rows, setRows] = useState<License[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(() => ({ q: initialQuery(), status: '' }));
  const [applied, setApplied] = useState(form);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unavailable'>('loading');

  const [selId, setSelId] = useState<string | null>(null);
  const sel = rows.find((l) => l.id === selId) ?? null;
  const [mode, setMode] = useState<'months' | 'days'>('months');
  const [amount, setAmount] = useState<number>(1);
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err' | 'warn'; lines: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (applied.q) q.set('q', applied.q);
    if (applied.status) q.set('status', applied.status);
    type Result = { state: 'ok'; licenses: License[]; total: number } | { state: 'error' | 'unavailable' };
    fetch(`/api/licenses?${q}`)
      .then(async (r): Promise<Result> => {
        if (r.status === 503) return { state: 'unavailable' };
        if (!r.ok) return { state: 'error' };
        const d = (await r.json()) as { licenses: License[]; total: number };
        return { state: 'ok', licenses: d.licenses, total: d.total };
      })
      .catch((): Result => ({ state: 'error' }))
      .then((res) => {
        if (cancelled) return;
        if (res.state === 'ok') { setRows(res.licenses); setTotal(res.total); }
        setState(res.state);
      });
    return () => { cancelled = true; };
  }, [page, applied, tick]);

  function reload(nextPage = page, nextApplied = applied) {
    setState('loading');
    setPage(nextPage);
    setApplied(nextApplied);
    setTick((t) => t + 1);
  }

  function open(l: License) {
    setSelId(l.id);
    setNotice(null);
    setConfirm(false);
    setReason('');
    setCopied(false);
  }

  async function act(path: string, body: unknown): Promise<boolean> {
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = (await r.json().catch(() => ({}))) as { auditRecorded?: boolean };
      if (r.ok) {
        setNotice({ kind: d.auditRecorded === false ? 'warn' : 'ok', lines: [c.done, d.auditRecorded === false ? c.auditFail : c.auditOk] });
        setTick((t) => t + 1);
        return true;
      }
      setNotice({ kind: 'err', lines: [r.status === 403 ? c.forbidden : r.status === 409 ? c.revokedCannot : c.failed] });
      return false;
    } catch {
      setNotice({ kind: 'err', lines: [c.failed] });
      return false;
    } finally {
      setBusy(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const dl = (l: License) => daysLeft(l.expiresAt);

  return (
    <section aria-labelledby="licenses-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="licenses-title" className="text-2xl font-bold text-[var(--adm-text)]">{c.title}</h1>
          <p className="text-sm text-[var(--adm-muted)]">{c.subtitle}</p>
        </div>
        <button type="button" onClick={() => reload()} className={BTN}>{c.refresh}</button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); reload(1, { ...form, q: form.q.trim() }); }}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3"
      >
        <label className="flex min-w-0 flex-1 basis-[200px] flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">
          {c.search}
          <input className={FIELD} value={form.q} onChange={(e) => setForm({ ...form, q: e.target.value })} />
        </label>
        <label className="flex w-full flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)] sm:w-auto">
          {c.status}
          <select className={FIELD} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="">{c.allStatuses}</option>
            {(['active', 'expired', 'revoked'] as LicStatus[]).map((s) => <option key={s} value={s}>{c.statuses[s]}</option>)}
          </select>
        </label>
        <button type="submit" className={BTN_PRIMARY}>{c.apply}</button>
      </form>

      {state === 'error' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.error}</p>}
      {state === 'unavailable' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.unavailable}</p>}

      <div className="overflow-x-auto rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <caption className="sr-only">{c.title}</caption>
          <thead>
            <tr className="bg-[var(--adm-head)] text-xs uppercase tracking-wide text-[var(--adm-muted)]">
              {[c.key, c.store, c.plan, c.status, c.expires, c.terminals].map((h) => <th key={h} scope="col" className="px-3 py-3 text-start font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.loading}</td></tr>}
            {state === 'ok' && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.empty}</td></tr>}
            {state === 'ok' && rows.map((l) => (
              <tr key={l.id} className="border-t border-[var(--adm-border)] hover:bg-[var(--adm-head)]">
                <td className="px-3 py-3">
                  <button type="button" onClick={() => open(l)} className="min-h-[44px] text-start font-mono text-xs font-semibold text-[var(--adm-text)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]" dir="ltr">
                    {l.key}
                  </button>
                </td>
                <td className="px-3 py-3 text-[var(--adm-text)]">{l.storeName}<div className="text-xs text-[var(--adm-muted)]" dir="ltr">{l.merchantId}</div></td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${PLAN_STYLE[l.plan] ?? ''}`}>{l.plan}</span>
                  {l.isTrial && <span className="ms-1 rounded-full border border-[var(--adm-border)] px-2 py-0.5 text-xs text-[var(--adm-muted)]">{c.trial}</span>}
                </td>
                <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[l.status]}`}>{c.statuses[l.status]}</span></td>
                <td className="whitespace-nowrap px-3 py-3 text-[var(--adm-muted)]" dir="ltr">{fmtDate(l.expiresAt, lang)} <span className="text-xs">({c.days(Math.max(0, dl(l) ?? 0))})</span></td>
                <td className="px-3 py-3 text-[var(--adm-muted)]" dir="ltr">{(l.terminals ?? []).length} / {l.maxRegisters}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-[var(--adm-muted)]">
        <span>{total} {c.total}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => reload(page - 1)} className={BTN}>{isRTL ? '›' : '‹'} {c.prev}</button>
          <span>{c.page} {page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => reload(page + 1)} className={BTN}>{c.next} {isRTL ? '‹' : '›'}</button>
        </div>
      </div>

      {sel && (
        <div className="fixed inset-0 z-40" role="presentation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelId(null)} aria-hidden="true" />
          <aside role="dialog" aria-modal="true" aria-label={c.details} className="absolute inset-y-0 end-0 w-[420px] max-w-[95vw] overflow-y-auto border-s border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold text-[var(--adm-text)]">{sel.storeName}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${PLAN_STYLE[sel.plan] ?? ''}`}>{sel.plan}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[sel.status]}`}>{c.statuses[sel.status]}</span>
                  {sel.isTrial && <span className="rounded-full border border-[var(--adm-border)] px-2 py-0.5 text-xs text-[var(--adm-muted)]">{c.trial}</span>}
                </div>
              </div>
              <button type="button" onClick={() => setSelId(null)} aria-label={c.close} className="min-h-[44px] min-w-[44px] rounded-[4px] border border-[var(--adm-border)] text-lg text-[var(--adm-text)]">×</button>
            </div>

            <code className="mb-2 block break-all rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-field)] p-3 text-sm text-[var(--adm-text)]" dir="ltr">{sel.key}</code>
            <button type="button" onClick={() => { void navigator.clipboard.writeText(sel.key).then(() => setCopied(true)).catch(() => setCopied(false)); }} className={`${BTN} mb-4 w-full`}>{copied ? c.copied : c.copy}</button>

            <dl className="mb-4 space-y-2 text-sm">
              {[
                [c.merchant, sel.merchantId, 'ltr'],
                [c.issued, fmtDate(sel.issuedAt, lang), 'ltr'],
                [c.expires, `${fmtDate(sel.expiresAt, lang)} (${c.days(Math.max(0, dl(sel) ?? 0))})`, 'ltr'],
              ].map(([k, v, dir]) => (
                <div key={k} className="border-b border-[var(--adm-border)] pb-2">
                  <dt className="text-xs font-semibold uppercase text-[var(--adm-muted)]">{k}</dt>
                  <dd className="text-[var(--adm-text)]" dir={dir as 'ltr'}>{v}</dd>
                </div>
              ))}
            </dl>

            {notice && (
              <div role={notice.kind === 'err' ? 'alert' : 'status'} className={`mb-4 rounded-[4px] border p-3 text-sm ${notice.kind === 'err' ? 'border-[var(--adm-error)] text-[var(--adm-error)]' : notice.kind === 'warn' ? 'border-[#F0B429] text-[var(--adm-text)]' : 'border-[#5EC485] text-[var(--adm-text)]'}`}>
                {notice.lines.map((l) => <p key={l}>{l}</p>)}
              </div>
            )}

            <h3 className="mb-2 text-sm font-bold text-[var(--adm-text)]">{c.terminals} ({(sel.terminals ?? []).length} / {sel.maxRegisters})</h3>
            {(sel.terminals ?? []).length === 0 ? <p className="mb-4 text-sm text-[var(--adm-muted)]">{c.noTerminals}</p> : (
              <ul className="mb-4 space-y-2">
                {(sel.terminals ?? []).map((t) => (
                  <li key={t.machineId} className="flex items-center justify-between gap-2 rounded-[4px] border border-[var(--adm-border)] p-2 text-sm">
                    <div className="min-w-0">
                      <code className="block break-all text-xs text-[var(--adm-text)]" dir="ltr">{t.machineId}</code>
                      <span className="text-xs text-[var(--adm-muted)]">{c.lastSeen} {fmtDate(t.lastSeenAt, lang)}</span>
                    </div>
                    {canWrite && <button type="button" disabled={busy} onClick={() => void act(`/api/admin/licenses/${sel.id}/terminals/release`, { machineId: t.machineId })} className={`${BTN} shrink-0 px-3`}>{c.release}</button>}
                  </li>
                ))}
              </ul>
            )}

            {!canWrite ? <p className="text-sm text-[var(--adm-muted)]">{c.readOnly}</p> : sel.status === 'revoked' ? (
              <p className="text-sm text-[var(--adm-muted)]">{c.revokedCannot}</p>
            ) : (
              <>
                <div className="mb-4 rounded-[8px] border border-[var(--adm-border)] p-3">
                  <h3 className="mb-1 text-sm font-bold text-[var(--adm-text)]">{c.extend}</h3>
                  <p className="mb-3 text-xs text-[var(--adm-muted)]">{c.extendHelp}</p>
                  <div className="mb-3 grid grid-cols-2 gap-3">
                    <label className="text-xs font-semibold text-[var(--adm-muted)]">{c.amount}
                      {mode === 'months' ? (
                        <select className={`${FIELD} mt-1 w-full`} value={amount} onChange={(e) => setAmount(Number(e.target.value))}>
                          {DURATIONS.map((d) => <option key={d} value={d}>{c.months(d)}</option>)}
                        </select>
                      ) : (
                        <input type="number" min={1} max={366} className={`${FIELD} mt-1 w-full`} value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                      )}
                    </label>
                    <label className="text-xs font-semibold text-[var(--adm-muted)]">&nbsp;
                      <select className={`${FIELD} mt-1 w-full`} value={mode} onChange={(e) => { const m = e.target.value as 'months' | 'days'; setMode(m); setAmount(m === 'months' ? 1 : 7); }}>
                        <option value="months">{c.byMonths}</option>
                        <option value="days">{c.byDays}</option>
                      </select>
                    </label>
                  </div>
                  <label className="mb-3 block text-xs font-semibold text-[var(--adm-muted)]">{c.reason}
                    <input className={`${FIELD} mt-1 w-full`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
                  </label>
                  <button type="button" disabled={busy} onClick={() => void act(`/api/admin/licenses/${sel.id}/extend`, { [mode]: amount, ...(reason.trim() ? { reason: reason.trim() } : {}) })} className={`${BTN_PRIMARY} w-full`}>{c.extendBtn}</button>
                </div>

                <div className="rounded-[8px] border border-[var(--adm-error)] p-3">
                  <h3 className="mb-1 text-sm font-bold text-[var(--adm-error)]">{c.revoke}</h3>
                  <p className="mb-3 text-xs text-[var(--adm-muted)]">{c.revokeHelp}</p>
                  <label className="mb-3 flex items-start gap-2 text-xs text-[var(--adm-text)]">
                    <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-5 w-5" />
                    {c.confirmRevoke}
                  </label>
                  <button type="button" disabled={busy || !confirm} onClick={() => void act(`/api/admin/licenses/${sel.id}/revoke`, reason.trim() ? { reason: reason.trim() } : {})} className="min-h-[44px] w-full rounded-[4px] bg-[#D32F2F] px-4 text-sm font-bold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D32F2F]">
                    {c.revokeBtn}
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
