'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './AdminShell';
import { BTN, BTN_PRIMARY, DURATIONS, FIELD, PLANS, PLAN_STYLE, SECTOR_FILTER, SECTOR_LABEL, daysLeft, fmtDate, type Lang } from './adminUi';

type MerchantStatus = 'pending' | 'approved' | 'suspended';
interface Merchant {
  id: string;
  phone: string;
  email?: string;
  storeName: string;
  sector: string;
  city: string;
  locale: string;
  createdAt: string;
  status: MerchantStatus;
  plan?: string;
  subscriptionEndsAt?: string;
  approvedBy?: string;
}
interface License {
  id: string;
  key: string;
  plan: string;
  status: 'active' | 'expired' | 'revoked';
  expiresAt: string;
  isTrial?: boolean;
}

const LIMIT = 25;
const STATUS_STYLE: Record<MerchantStatus, string> = {
  pending: 'bg-[#FEF9C3] text-[#854D0E]',
  approved: 'bg-[#DCFCE7] text-[#166534]',
  suspended: 'bg-[#FEE2E2] text-[#991B1B]',
};
const LIC_STYLE = { active: 'bg-[#DCFCE7] text-[#166534]', expired: 'bg-[#FEE2E2] text-[#991B1B]', revoked: 'bg-[#E5E7EB] text-[#374151]' } as const;

const COPY: Record<Lang, {
  title: string; subtitle: string; search: string; status: string; allStatuses: string; type: string; allTypes: string; tier: string; allTiers: string;
  apply: string; refresh: string; store: string; contact: string; city: string; sub: string; active: string; suspended: string; pending: string;
  empty: string; loading: string; error: string; unavailable: string; total: string; prev: string; next: string; page: string;
  switchOn: string; switchOff: string; toggleFailed: string; forbidden: string; close: string; details: string;
  approveTitle: string; approveHelp: string; approve: string; approving: string; plan: string; duration: string; months: (n: number) => string;
  approved: string; sentWa: string; notSentWa: string; auditOk: string; auditFail: string; approveFailed: string; already: string;
  licenses: string; noLicenses: string; issueTitle: string; issueHelp: string; issue: string; issuing: string; issued: string; issueFailed: string; copy: string; copied: string;
  trial: string; days: (n: number) => string; expired: string; readOnly: string; registered: string; by: string;
}> = {
  ar: {
    title: 'التجار', subtitle: 'قبول الطلبات الجديدة، تفعيل أو تعليق الحسابات، والتحكم في الباقات', search: 'بحث بالاسم أو الهاتف أو المدينة',
    status: 'الحالة', allStatuses: 'كل الحالات', type: 'نوع المتجر', allTypes: 'كل الأنواع', tier: 'الباقة', allTiers: 'كل الباقات',
    apply: 'تطبيق', refresh: 'تحديث', store: 'المتجر', contact: 'الاتصال', city: 'المدينة', sub: 'الاشتراك', active: 'نشط', suspended: 'معلّق', pending: 'قيد الانتظار',
    empty: 'لا يوجد تجار مطابقون', loading: 'جارٍ التحميل…', error: 'تعذّر تحميل التجار', unavailable: 'قاعدة البيانات غير متاحة', total: 'تاجر', prev: 'السابق', next: 'التالي', page: 'صفحة',
    switchOn: 'إيقاف الحساب', switchOff: 'تفعيل الحساب', toggleFailed: 'تعذّر تغيير الحالة', forbidden: 'ليست لديك صلاحية التعديل', close: 'إغلاق', details: 'تفاصيل التاجر',
    approveTitle: 'قبول التاجر', approveHelp: 'يُنشأ مفتاح ترخيص حقيقي ويُرسل عبر واتساب ويُسجَّل في سجل التدقيق.', approve: 'قبول وإنشاء المفتاح', approving: 'جارٍ القبول…', plan: 'الباقة', duration: 'المدة',
    months: (n) => (n === 1 ? 'شهر' : n === 12 ? 'سنة' : n === 24 ? 'سنتان' : `${n} أشهر`), approved: 'تم قبول التاجر', sentWa: 'أُرسل المفتاح عبر واتساب', notSentWa: 'لم يُرسل واتساب تلقائياً؛ أرسل المفتاح يدوياً',
    auditOk: 'سُجّل الإجراء في سجل التدقيق', auditFail: 'تحذير: لم يُسجَّل الإجراء في سجل التدقيق', approveFailed: 'تعذّر قبول التاجر', already: 'هذا التاجر مقبول مسبقاً',
    licenses: 'التراخيص', noLicenses: 'لا توجد تراخيص', issueTitle: 'إصدار ترخيص إضافي', issueHelp: 'لتغيير الباقة أو تجديد الاشتراك. يُسجَّل في سجل التدقيق.', issue: 'إنشاء الترخيص', issuing: 'جارٍ الإنشاء…', issued: 'تم إنشاء الترخيص', issueFailed: 'تعذّر إنشاء الترخيص', copy: 'نسخ', copied: 'تم النسخ',
    trial: 'تجريبي', days: (n) => `${n} يوم`, expired: 'منتهي', readOnly: 'حسابك للقراءة فقط', registered: 'تاريخ التسجيل', by: 'بواسطة',
  },
  fr: {
    title: 'Commerçants', subtitle: 'Approuver les demandes, activer ou suspendre les comptes, gérer les formules', search: 'Rechercher nom, téléphone, ville',
    status: 'Statut', allStatuses: 'Tous les statuts', type: 'Type de commerce', allTypes: 'Tous les types', tier: 'Formule', allTiers: 'Toutes les formules',
    apply: 'Appliquer', refresh: 'Actualiser', store: 'Commerce', contact: 'Contact', city: 'Ville', sub: 'Abonnement', active: 'Actif', suspended: 'Suspendu', pending: 'En attente',
    empty: 'Aucun commerçant correspondant', loading: 'Chargement…', error: 'Impossible de charger les commerçants', unavailable: 'Base de données indisponible', total: 'commerçants', prev: 'Précédent', next: 'Suivant', page: 'Page',
    switchOn: 'Suspendre le compte', switchOff: 'Réactiver le compte', toggleFailed: 'Impossible de changer le statut', forbidden: 'Vous n’avez pas le droit de modifier', close: 'Fermer', details: 'Détail du commerçant',
    approveTitle: 'Approuver le commerçant', approveHelp: 'Une vraie clé de licence est créée, envoyée sur WhatsApp et inscrite au journal d’audit.', approve: 'Approuver et générer la clé', approving: 'Approbation…', plan: 'Formule', duration: 'Durée',
    months: (n) => (n === 1 ? '1 mois' : n === 12 ? '1 an' : n === 24 ? '2 ans' : `${n} mois`), approved: 'Commerçant approuvé', sentWa: 'Clé envoyée sur WhatsApp', notSentWa: 'WhatsApp non envoyé automatiquement : envoyez la clé à la main',
    auditOk: 'Action inscrite au journal d’audit', auditFail: 'Attention : action non inscrite au journal d’audit', approveFailed: 'Impossible d’approuver', already: 'Ce commerçant est déjà approuvé',
    licenses: 'Licences', noLicenses: 'Aucune licence', issueTitle: 'Émettre une licence supplémentaire', issueHelp: 'Pour changer de formule ou renouveler. Inscrit au journal d’audit.', issue: 'Générer la licence', issuing: 'Génération…', issued: 'Licence créée', issueFailed: 'Impossible de créer la licence', copy: 'Copier', copied: 'Copié',
    trial: 'Essai', days: (n) => `${n} j`, expired: 'Expiré', readOnly: 'Votre compte est en lecture seule', registered: 'Inscrit le', by: 'par',
  },
  en: {
    title: 'Merchants', subtitle: 'Approve requests, switch accounts on or off, manage tiers', search: 'Search name, phone, city',
    status: 'Status', allStatuses: 'All statuses', type: 'Shop type', allTypes: 'All types', tier: 'Tier', allTiers: 'All tiers',
    apply: 'Apply', refresh: 'Refresh', store: 'Shop', contact: 'Contact', city: 'City', sub: 'Subscription', active: 'Active', suspended: 'Suspended', pending: 'Pending',
    empty: 'No matching merchants', loading: 'Loading…', error: 'Could not load merchants', unavailable: 'Database unavailable', total: 'merchants', prev: 'Previous', next: 'Next', page: 'Page',
    switchOn: 'Suspend account', switchOff: 'Reactivate account', toggleFailed: 'Could not change the status', forbidden: 'You are not allowed to edit', close: 'Close', details: 'Merchant details',
    approveTitle: 'Approve merchant', approveHelp: 'A real license key is created, sent on WhatsApp and written to the audit log.', approve: 'Approve and generate key', approving: 'Approving…', plan: 'Plan', duration: 'Duration',
    months: (n) => (n === 1 ? '1 month' : n === 12 ? '1 year' : n === 24 ? '2 years' : `${n} months`), approved: 'Merchant approved', sentWa: 'Key sent on WhatsApp', notSentWa: 'WhatsApp was not sent automatically: send the key by hand',
    auditOk: 'Action recorded in the audit log', auditFail: 'Warning: action was not recorded in the audit log', approveFailed: 'Could not approve', already: 'This merchant is already approved',
    licenses: 'Licenses', noLicenses: 'No licenses', issueTitle: 'Issue another license', issueHelp: 'To change tier or renew. Recorded in the audit log.', issue: 'Generate license', issuing: 'Generating…', issued: 'License created', issueFailed: 'Could not create the license', copy: 'Copy', copied: 'Copied',
    trial: 'Trial', days: (n) => `${n} d`, expired: 'Expired', readOnly: 'Your account is read-only', registered: 'Registered', by: 'by',
  },
};

export default function MerchantsTable() {
  const { lang, actor, isRTL } = useAdmin();
  const c = COPY[lang];
  const canWrite = actor.role !== 'viewer';

  const [rows, setRows] = useState<Merchant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [form, setForm] = useState({ q: '', status: '', sector: '', plan: '' });
  const [applied, setApplied] = useState(form);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unavailable'>('loading');
  const [rowMsg, setRowMsg] = useState<{ id: string; text: string } | null>(null);

  const [sel, setSel] = useState<Merchant | null>(null);
  const [lics, setLics] = useState<License[] | null>(null);
  const [plan, setPlan] = useState<(typeof PLANS)[number]>('Starter');
  const [months, setMonths] = useState<(typeof DURATIONS)[number]>(12);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err' | 'warn'; lines: string[] } | null>(null);
  const [copied, setCopied] = useState('');
  const [licTick, setLicTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (applied.q) q.set('q', applied.q);
    if (applied.status) q.set('status', applied.status);
    if (applied.sector) q.set('sector', applied.sector);
    if (applied.plan) q.set('plan', applied.plan);
    type Result = { state: 'ok'; merchants: Merchant[]; total: number } | { state: 'error' | 'unavailable' };
    fetch(`/api/admin/merchants?${q}`)
      .then(async (r): Promise<Result> => {
        if (r.status === 503) return { state: 'unavailable' };
        if (!r.ok) return { state: 'error' };
        const d = (await r.json()) as { merchants: Merchant[]; total: number };
        return { state: 'ok', merchants: d.merchants, total: d.total };
      })
      .catch((): Result => ({ state: 'error' }))
      .then((res) => {
        if (cancelled) return;
        if (res.state === 'ok') { setRows(res.merchants); setTotal(res.total); }
        setState(res.state);
      });
    return () => { cancelled = true; };
  }, [page, applied, tick]);

  // licenses of the open merchant
  const openPhone = sel?.phone;
  useEffect(() => {
    if (!openPhone) return;
    let cancelled = false;
    fetch(`/api/licenses?merchantId=${encodeURIComponent(openPhone)}&limit=50`)
      .then(async (r) => (r.ok ? (((await r.json()) as { licenses: License[] }).licenses) : []))
      .catch(() => [] as License[])
      .then((l) => { if (!cancelled) setLics(l); });
    return () => { cancelled = true; };
  }, [openPhone, licTick]);

  function reload(nextPage = page, nextApplied = applied) {
    setState('loading');
    setPage(nextPage);
    setApplied(nextApplied);
    setTick((t) => t + 1);
  }

  function open(m: Merchant) {
    setSel(m);
    setLics(null);
    setNotice(null);
  }

  async function toggle(m: Merchant) {
    setRowMsg(null);
    const next = m.status === 'approved' ? 'suspended' : 'active';
    const r = await fetch(`/api/admin/merchants/${m.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    }).catch(() => null);
    if (r && r.ok) {
      const updated: Merchant = { ...m, status: next === 'suspended' ? 'suspended' : 'approved' };
      setRows((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
      if (sel?.id === m.id) setSel(updated);
    } else {
      setRowMsg({ id: m.id, text: r?.status === 403 ? c.forbidden : c.toggleFailed });
    }
  }

  async function approve(m: Merchant) {
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch(`/api/admin/merchants/${m.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, durationMonths: months }),
      });
      const d = (await r.json().catch(() => ({}))) as { merchant?: Merchant; auditRecorded?: boolean; whatsapp?: { sent: boolean } };
      if (r.status === 201 && d.merchant) {
        const updated = { ...m, ...d.merchant };
        setSel(updated);
        setRows((prev) => prev.map((x) => (x.id === m.id ? updated : x)));
        setLicTick((t) => t + 1);
        setNotice({ kind: d.auditRecorded === false ? 'warn' : 'ok', lines: [c.approved, d.whatsapp?.sent ? c.sentWa : c.notSentWa, d.auditRecorded === false ? c.auditFail : c.auditOk] });
      } else {
        setNotice({ kind: 'err', lines: [r.status === 403 ? c.forbidden : r.status === 409 ? c.already : c.approveFailed] });
      }
    } catch {
      setNotice({ kind: 'err', lines: [c.approveFailed] });
    } finally {
      setBusy(false);
    }
  }

  async function issue(m: Merchant) {
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch('/api/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantId: m.phone || m.email, storeName: m.storeName, plan, durationMonths: months }),
      });
      const d = (await r.json().catch(() => ({}))) as { auditRecorded?: boolean };
      if (r.status === 201) {
        setLicTick((t) => t + 1);
        setTick((t) => t + 1);
        setNotice({ kind: d.auditRecorded === false ? 'warn' : 'ok', lines: [c.issued, d.auditRecorded === false ? c.auditFail : c.auditOk] });
      } else {
        setNotice({ kind: 'err', lines: [r.status === 403 ? c.forbidden : c.issueFailed] });
      }
    } catch {
      setNotice({ kind: 'err', lines: [c.issueFailed] });
    } finally {
      setBusy(false);
    }
  }

  async function copy(key: string) {
    try { await navigator.clipboard.writeText(key); setCopied(key); } catch { setCopied(''); }
  }

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const statusLabel = (s: MerchantStatus) => (s === 'approved' ? c.active : s === 'suspended' ? c.suspended : c.pending);

  return (
    <section aria-labelledby="merchants-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="merchants-title" className="text-2xl font-bold text-[var(--adm-text)]">{c.title}</h1>
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
        {([
          ['status', c.status, c.allStatuses, [['pending', c.pending], ['approved', c.active], ['suspended', c.suspended]]],
          ['sector', c.type, c.allTypes, SECTOR_FILTER.map((s) => [s, SECTOR_LABEL[lang][s]])],
          ['plan', c.tier, c.allTiers, PLANS.map((p) => [p, p])],
        ] as [keyof typeof form, string, string, string[][]][]).map(([k, label, all, opts]) => (
          <label key={k} className="flex w-full flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)] sm:w-auto">
            {label}
            <select className={FIELD} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}>
              <option value="">{all}</option>
              {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        ))}
        <button type="submit" className={BTN_PRIMARY}>{c.apply}</button>
      </form>

      {state === 'error' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.error}</p>}
      {state === 'unavailable' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.unavailable}</p>}

      <div className="overflow-x-auto rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        <table className="w-full min-w-[900px] border-collapse text-sm">
          <caption className="sr-only">{c.title}</caption>
          <thead>
            <tr className="bg-[var(--adm-head)] text-xs uppercase tracking-wide text-[var(--adm-muted)]">
              {[c.store, c.type, c.tier, c.status, c.sub, ''].map((h, i) => <th key={i} scope="col" className="px-3 py-3 text-start font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.loading}</td></tr>}
            {state === 'ok' && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.empty}</td></tr>}
            {state === 'ok' && rows.map((m) => {
              const left = daysLeft(m.subscriptionEndsAt);
              return (
                <tr key={m.id} className="border-t border-[var(--adm-border)] hover:bg-[var(--adm-head)]">
                  <td className="px-3 py-3">
                    <button type="button" onClick={() => open(m)} className="min-h-[44px] text-start font-semibold text-[var(--adm-text)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]">
                      {m.storeName}
                    </button>
                    <div className="text-xs text-[var(--adm-muted)]" dir="ltr">{m.phone || m.email} · {m.city || '—'}</div>
                  </td>
                  <td className="px-3 py-3"><span className="rounded-full border border-[var(--adm-border)] px-2.5 py-1 text-xs font-semibold text-[var(--adm-text2)]">{SECTOR_LABEL[lang][m.sector] ?? (m.sector || '—')}</span></td>
                  <td className="px-3 py-3">{m.plan ? <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${PLAN_STYLE[m.plan] ?? ''}`}>{m.plan}</span> : <span className="text-[var(--adm-muted)]">—</span>}</td>
                  <td className="px-3 py-3">
                    {m.status === 'pending' ? (
                      <button type="button" onClick={() => open(m)} className={`${BTN_PRIMARY} min-h-[44px]`}>{c.approveTitle}</button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={m.status === 'approved'}
                          aria-label={m.status === 'approved' ? c.switchOn : c.switchOff}
                          disabled={!canWrite}
                          onClick={() => void toggle(m)}
                          className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]"
                        >
                          <span aria-hidden="true" className={`relative inline-block h-6 w-11 rounded-full transition-colors ${m.status === 'approved' ? 'bg-[#16A34A]' : 'bg-[#9CA3AF]'}`}>
                            <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ insetInlineStart: m.status === 'approved' ? 22 : 2 }} />
                          </span>
                        </button>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[m.status]}`}>{statusLabel(m.status)}</span>
                      </div>
                    )}
                    {rowMsg?.id === m.id && <p role="alert" className="mt-1 text-xs text-[var(--adm-error)]">{rowMsg.text}</p>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-[var(--adm-muted)]" dir="ltr">
                    {m.subscriptionEndsAt ? <>{fmtDate(m.subscriptionEndsAt, lang)} <span className="text-xs">({left !== null && left < 0 ? c.expired : c.days(left ?? 0)})</span></> : '—'}
                  </td>
                  <td className="px-3 py-3 text-end">
                    <button type="button" onClick={() => open(m)} className={BTN}>{c.details}</button>
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

      {sel && (
        <div className="fixed inset-0 z-40" role="presentation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSel(null)} aria-hidden="true" />
          <aside role="dialog" aria-modal="true" aria-label={c.details} className="absolute inset-y-0 end-0 w-[400px] max-w-[95vw] overflow-y-auto border-s border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-[var(--adm-text)]">{sel.storeName}</h2>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[sel.status]}`}>{statusLabel(sel.status)}</span>
              </div>
              <button type="button" onClick={() => setSel(null)} aria-label={c.close} className="min-h-[44px] min-w-[44px] rounded-[4px] border border-[var(--adm-border)] text-lg text-[var(--adm-text)]">×</button>
            </div>

            <dl className="mb-4 space-y-2 text-sm">
              {[
                [c.contact, `${sel.phone || ''} ${sel.email || ''}`.trim() || '—', 'ltr'],
                [c.type, SECTOR_LABEL[lang][sel.sector] ?? (sel.sector || '—'), undefined],
                [c.city, sel.city || '—', undefined],
                [c.registered, fmtDate(sel.createdAt, lang), 'ltr'],
                ...(sel.approvedBy ? [[c.by, sel.approvedBy, undefined]] : []),
              ].map(([k, v, dir]) => (
                <div key={k} className="border-b border-[var(--adm-border)] pb-2">
                  <dt className="text-xs font-semibold uppercase text-[var(--adm-muted)]">{k}</dt>
                  <dd className="text-[var(--adm-text)]" dir={dir as 'ltr' | undefined}>{v}</dd>
                </div>
              ))}
            </dl>

            {notice && (
              <div role={notice.kind === 'err' ? 'alert' : 'status'} className={`mb-4 rounded-[4px] border p-3 text-sm ${notice.kind === 'err' ? 'border-[var(--adm-error)] text-[var(--adm-error)]' : notice.kind === 'warn' ? 'border-[#F0B429] text-[var(--adm-text)]' : 'border-[#5EC485] text-[var(--adm-text)]'}`}>
                {notice.lines.map((l) => <p key={l}>{l}</p>)}
              </div>
            )}

            {/* Approve (pending) or issue another license (approved / suspended) */}
            {!canWrite ? (
              <p className="mb-4 text-sm text-[var(--adm-muted)]">{c.readOnly}</p>
            ) : (
              <div className="mb-5 rounded-[8px] border border-[var(--adm-border)] p-3">
                <h3 className="mb-1 text-sm font-bold text-[var(--adm-text)]">{sel.status === 'pending' ? c.approveTitle : c.issueTitle}</h3>
                <p className="mb-3 text-xs text-[var(--adm-muted)]">{sel.status === 'pending' ? c.approveHelp : c.issueHelp}</p>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-[var(--adm-muted)]">{c.plan}
                    <select className={`${FIELD} mt-1 w-full`} value={plan} onChange={(e) => setPlan(e.target.value as (typeof PLANS)[number])}>
                      {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[var(--adm-muted)]">{c.duration}
                    <select className={`${FIELD} mt-1 w-full`} value={months} onChange={(e) => setMonths(Number(e.target.value) as (typeof DURATIONS)[number])}>
                      {DURATIONS.map((d) => <option key={d} value={d}>{c.months(d)}</option>)}
                    </select>
                  </label>
                </div>
                <button type="button" disabled={busy} onClick={() => void (sel.status === 'pending' ? approve(sel) : issue(sel))} className={`${BTN_PRIMARY} min-h-[48px] w-full`}>
                  {busy ? (sel.status === 'pending' ? c.approving : c.issuing) : sel.status === 'pending' ? c.approve : c.issue}
                </button>
              </div>
            )}

            <h3 className="mb-2 text-sm font-bold text-[var(--adm-text)]">{c.licenses}</h3>
            {lics === null ? <p className="text-sm text-[var(--adm-muted)]">{c.loading}</p>
              : lics.length === 0 ? <p className="text-sm text-[var(--adm-muted)]">{c.noLicenses}</p>
              : (
                <ul className="space-y-2">
                  {lics.map((l) => (
                    <li key={l.id} className="rounded-[4px] border border-[var(--adm-border)] p-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <code className="break-all text-xs text-[var(--adm-text)]" dir="ltr">{l.key}</code>
                        <button type="button" onClick={() => void copy(l.key)} className={`${BTN} min-h-[36px] px-2 text-xs`}>{copied === l.key ? c.copied : c.copy}</button>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--adm-muted)]">
                        <span className={`rounded-full px-2 py-0.5 font-bold ${PLAN_STYLE[l.plan] ?? ''}`}>{l.plan}</span>
                        {l.isTrial && <span className="rounded-full border border-[var(--adm-border)] px-2 py-0.5">{c.trial}</span>}
                        <span className={`rounded-full px-2 py-0.5 font-bold ${LIC_STYLE[l.status]}`}>{l.status}</span>
                        <span dir="ltr">{fmtDate(l.expiresAt, lang)}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
          </aside>
        </div>
      )}
    </section>
  );
}
