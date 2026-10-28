'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './AdminShell';
import ExportButton from './ExportButton';
import { BTN, BTN_PRIMARY, FIELD, PLAN_STYLE, SECTOR_LABEL, initialQuery, type Lang } from './adminUi';

interface Merchant { id: string; storeName: string; phone: string; email?: string; city: string; sector: string; plan?: string; commissionRate?: number }

const LIMIT = 25;

const COPY: Record<Lang, {
  title: string; subtitle: string; search: string; apply: string; refresh: string; merchant: string; type: string; plan: string; rate: string; action: string;
  save: string; saving: string; saved: string; empty: string; loading: string; error: string; unavailable: string; total: string; prev: string; next: string; page: string;
  invalid: string; forbidden: string; failed: string; auditFail: string; readOnly: string; notSet: string; hint: string; rateFor: (n: string) => string; saveFor: (n: string) => string;
}> = {
  ar: {
    title: 'نسبة العمولة', subtitle: 'عمولة المنصة لكل تاجر نشط', search: 'بحث بالاسم أو الهاتف أو المدينة', apply: 'تطبيق', refresh: 'تحديث',
    merchant: 'التاجر', type: 'نوع المتجر', plan: 'الباقة', rate: 'العمولة (%)', action: 'إجراء', save: 'حفظ', saving: 'جارٍ الحفظ…', saved: 'تم الحفظ',
    empty: 'لا يوجد تجار نشطون', loading: 'جارٍ التحميل…', error: 'تعذّر تحميل التجار', unavailable: 'قاعدة البيانات غير متاحة', total: 'تاجر', prev: 'السابق', next: 'التالي', page: 'صفحة',
    invalid: 'من 0 إلى 100 بخانتين عشريتين كحد أقصى', forbidden: 'ليست لديك صلاحية التعديل', failed: 'تعذّر الحفظ', auditFail: 'لم يُسجَّل في سجل التدقيق',
    readOnly: 'حسابك للقراءة فقط', notSet: 'غير محددة', hint: 'اترك الخانة كما هي لإبقاء النسبة الحالية. النسبة من 0 إلى 100.',
    rateFor: (n) => `نسبة عمولة ${n}`, saveFor: (n) => `حفظ عمولة ${n}`,
  },
  fr: {
    title: 'Taux de commission', subtitle: 'Commission de la plateforme pour chaque commerçant actif', search: 'Rechercher nom, téléphone, ville', apply: 'Appliquer', refresh: 'Actualiser',
    merchant: 'Commerçant', type: 'Type de commerce', plan: 'Formule', rate: 'Commission (%)', action: 'Action', save: 'Enregistrer', saving: 'Enregistrement…', saved: 'Enregistré',
    empty: 'Aucun commerçant actif', loading: 'Chargement…', error: 'Impossible de charger les commerçants', unavailable: 'Base de données indisponible', total: 'commerçants', prev: 'Précédent', next: 'Suivant', page: 'Page',
    invalid: 'De 0 à 100, deux décimales au maximum', forbidden: 'Vous n’avez pas le droit de modifier', failed: 'Enregistrement impossible', auditFail: 'Non inscrit au journal d’audit',
    readOnly: 'Votre compte est en lecture seule', notSet: 'Non définie', hint: 'Laissez la valeur telle quelle pour garder le taux actuel. De 0 à 100.',
    rateFor: (n) => `Taux de commission de ${n}`, saveFor: (n) => `Enregistrer la commission de ${n}`,
  },
  en: {
    title: 'Commission rate', subtitle: 'Platform commission for each active merchant', search: 'Search name, phone, city', apply: 'Apply', refresh: 'Refresh',
    merchant: 'Merchant', type: 'Shop type', plan: 'Plan', rate: 'Commission (%)', action: 'Action', save: 'Save', saving: 'Saving…', saved: 'Saved',
    empty: 'No active merchants', loading: 'Loading…', error: 'Could not load merchants', unavailable: 'Database unavailable', total: 'merchants', prev: 'Previous', next: 'Next', page: 'Page',
    invalid: '0 to 100, at most two decimals', forbidden: 'You are not allowed to edit', failed: 'Could not save', auditFail: 'Not recorded in the audit log',
    readOnly: 'Your account is read-only', notSet: 'Not set', hint: 'Leave a value unchanged to keep the current rate. Range 0 to 100.',
    rateFor: (n) => `Commission rate for ${n}`, saveFor: (n) => `Save commission for ${n}`,
  },
};

/** Parses "12", "12.5", "12,5" (comma accepted) into a number, or null when it is not a valid percentage. */
function parseRate(v: string): number | null {
  const s = v.trim().replace(',', '.');
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;
  const n = Number(s);
  return n >= 0 && n <= 100 ? n : null;
}

export default function CommissionTable() {
  const { lang, actor, isRTL } = useAdmin();
  const c = COPY[lang];
  const canWrite = actor.role !== 'viewer';

  const [rows, setRows] = useState<Merchant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState(initialQuery);
  const [appliedQ, setAppliedQ] = useState(initialQuery);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unavailable'>('loading');
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowMsg, setRowMsg] = useState<Record<string, { kind: 'ok' | 'err'; text: string }>>({});

  useEffect(() => {
    let cancelled = false;
    const p = new URLSearchParams({ status: 'approved', page: String(page), limit: String(LIMIT) });
    if (appliedQ) p.set('q', appliedQ);
    type Result = { state: 'ok'; merchants: Merchant[]; total: number } | { state: 'error' | 'unavailable' };
    fetch(`/api/admin/merchants?${p}`)
      .then(async (r): Promise<Result> => {
        if (r.status === 503) return { state: 'unavailable' };
        if (!r.ok) return { state: 'error' };
        const d = (await r.json()) as { merchants: Merchant[]; total: number };
        return { state: 'ok', merchants: d.merchants, total: d.total };
      })
      .catch((): Result => ({ state: 'error' }))
      .then((res) => {
        if (cancelled) return;
        if (res.state === 'ok') {
          setRows(res.merchants);
          setTotal(res.total);
          setDraft(Object.fromEntries(res.merchants.map((m) => [m.id, m.commissionRate === undefined ? '' : String(m.commissionRate)])));
        }
        setState(res.state);
      });
    return () => { cancelled = true; };
  }, [page, appliedQ, tick]);

  function reload(nextPage = page, nextQ = appliedQ) {
    setState('loading');
    setRowMsg({});
    setPage(nextPage);
    setAppliedQ(nextQ);
    setTick((t) => t + 1);
  }

  async function save(m: Merchant) {
    const rate = parseRate(draft[m.id] ?? '');
    if (rate === null) { setRowMsg((s) => ({ ...s, [m.id]: { kind: 'err', text: c.invalid } })); return; }
    setBusyId(m.id);
    setRowMsg((s) => { const n = { ...s }; delete n[m.id]; return n; });
    try {
      const r = await fetch(`/api/admin/merchants/${m.id}/commission`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rate }) });
      const d = (await r.json().catch(() => ({}))) as { auditRecorded?: boolean };
      if (r.ok) {
        setRows((cur) => cur.map((x) => (x.id === m.id ? { ...x, commissionRate: rate } : x)));
        setDraft((cur) => ({ ...cur, [m.id]: String(rate) }));
        setRowMsg((s) => ({ ...s, [m.id]: { kind: d.auditRecorded === false ? 'err' : 'ok', text: d.auditRecorded === false ? `${c.saved}. ${c.auditFail}` : c.saved } }));
      } else {
        setRowMsg((s) => ({ ...s, [m.id]: { kind: 'err', text: r.status === 403 ? c.forbidden : r.status === 422 ? c.invalid : c.failed } }));
      }
    } catch {
      setRowMsg((s) => ({ ...s, [m.id]: { kind: 'err', text: c.failed } }));
    } finally {
      setBusyId(null);
    }
  }

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <section aria-labelledby="commission-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="commission-title" className="text-2xl font-bold text-[var(--adm-text)]">{c.title}</h1>
          <p className="text-sm text-[var(--adm-muted)]">{c.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ExportButton dataset="commission-rates" filters={{ q: appliedQ }} />
          <button type="button" onClick={() => reload()} className={BTN}>{c.refresh}</button>
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); reload(1, q.trim()); }} className="mb-3 flex flex-wrap items-end gap-3 rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
        <label className="flex min-w-0 flex-1 basis-[220px] flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.search}
          <input className={`${FIELD} sm:w-full`} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button type="submit" className={BTN_PRIMARY}>{c.apply}</button>
      </form>
      <p className="mb-3 text-xs text-[var(--adm-muted)]">{canWrite ? c.hint : c.readOnly}</p>

      {state === 'error' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.error}</p>}
      {state === 'unavailable' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.unavailable}</p>}

      <div className="overflow-x-auto rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">{c.title}</caption>
          <thead>
            <tr className="bg-[var(--adm-head)] text-xs uppercase tracking-wide text-[var(--adm-muted)]">
              {[c.merchant, c.type, c.plan, c.rate, c.action].map((h) => <th key={h} scope="col" className="px-3 py-3 text-start font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan={5} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.loading}</td></tr>}
            {state === 'ok' && rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.empty}</td></tr>}
            {state === 'ok' && rows.map((m) => {
              const value = draft[m.id] ?? '';
              const parsed = parseRate(value);
              const dirty = value.trim() !== (m.commissionRate === undefined ? '' : String(m.commissionRate)) && value.trim() !== '';
              const msg = rowMsg[m.id];
              return (
                <tr key={m.id} className="border-t border-[var(--adm-border)] align-top">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-[var(--adm-text)]">{m.storeName}</div>
                    <div className="text-xs text-[var(--adm-muted)]" dir="ltr">{m.phone || m.email} · {m.city || '—'}</div>
                  </td>
                  <td className="px-3 py-3"><span className="rounded-full border border-[var(--adm-border)] px-2.5 py-1 text-xs font-semibold text-[var(--adm-text2)]">{SECTOR_LABEL[lang][m.sector] ?? (m.sector || '—')}</span></td>
                  <td className="px-3 py-3">{m.plan ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${PLAN_STYLE[m.plan] ?? ''}`}>{m.plan}</span> : '—'}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2" dir="ltr">
                      <input
                        inputMode="decimal" value={value} disabled={!canWrite} placeholder={c.notSet}
                        aria-label={c.rateFor(m.storeName)} aria-invalid={value.trim() !== '' && parsed === null}
                        onChange={(e) => { setDraft((cur) => ({ ...cur, [m.id]: e.target.value })); setRowMsg((s) => { const n = { ...s }; delete n[m.id]; return n; }); }}
                        onKeyDown={(e) => { if (e.key === 'Enter' && dirty && parsed !== null) { e.preventDefault(); void save(m); } }}
                        className={`${FIELD} w-28 text-end ${value.trim() !== '' && parsed === null ? '!border-[var(--adm-error)]' : ''}`}
                      />
                      <span className="text-[var(--adm-muted)]" aria-hidden="true">%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <button
                        type="button" disabled={!canWrite || busyId === m.id || !dirty || parsed === null}
                        onClick={() => void save(m)} aria-label={c.saveFor(m.storeName)} className={`${BTN_PRIMARY} min-w-[110px]`}
                      >
                        {busyId === m.id ? c.saving : c.save}
                      </button>
                      {msg && <span role={msg.kind === 'err' ? 'alert' : 'status'} className={`text-xs ${msg.kind === 'err' ? 'text-[var(--adm-error)]' : 'text-[var(--adm-muted)]'}`}>{msg.text}</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
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
    </section>
  );
}
