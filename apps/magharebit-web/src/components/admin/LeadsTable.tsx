'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './AdminShell';
import ExportButton from './ExportButton';
import { initialQuery } from './adminUi';

type LeadStatus = 'new' | 'contacted' | 'converted' | 'rejected' | 'activated';
interface Lead {
  id: string;
  storeName: string;
  phone: string;
  businessType: string;
  city: string;
  locale: string;
  submittedAt: string;
  status: LeadStatus;
  licenseKey?: string;
  licenseId?: string;
  activatedAt?: string;
  activatedBy?: string;
}

type Lang = 'ar' | 'fr' | 'en';
const STATUSES: LeadStatus[] = ['new', 'contacted', 'converted', 'rejected', 'activated'];
const SETTABLE: LeadStatus[] = ['new', 'contacted', 'converted', 'rejected'];
const PLANS = ['Starter', 'Business', 'Enterprise'] as const;
const DURATIONS = [1, 3, 6, 12, 24] as const;
const LIMIT = 25;

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: 'bg-[#DBEAFE] text-[#1D4ED8]',
  contacted: 'bg-[#FEF9C3] text-[#854D0E]',
  converted: 'bg-[#DCFCE7] text-[#166534]',
  rejected: 'bg-[#FEE2E2] text-[#991B1B]',
  activated: 'bg-[#FEF3C7] text-[#92400E]',
};

const COPY: Record<Lang, {
  title: string; subtitle: string; search: string; allStatuses: string; apply: string; refresh: string;
  store: string; phone: string; type: string; city: string; lang: string; status: string; date: string; key: string;
  empty: string; loading: string; error: string; unavailable: string; total: string; prev: string; next: string; page: string;
  statuses: Record<LeadStatus, string>; close: string; details: string; changeStatus: string; readOnly: string;
  activate: string; activateHelp: string; plan: string; duration: string; months: (n: number) => string; generate: string;
  generating: string; activated: string; copy: string; copied: string; whatsapp: string; sentWa: string; notSentWa: string;
  auditOk: string; auditFail: string; already: string; rejectedFirst: string; forbidden: string; failed: string; statusFailed: string;
  types: Record<string, string>; activatedBy: string;
}> = {
  ar: {
    title: 'العملاء المحتملون', subtitle: 'طلبات العروض التجريبية، الأحدث أولاً', search: 'بحث بالاسم أو الهاتف أو المدينة',
    allStatuses: 'كل الحالات', apply: 'تطبيق', refresh: 'تحديث', store: 'المتجر', phone: 'الهاتف', type: 'النشاط', city: 'المدينة',
    lang: 'اللغة', status: 'الحالة', date: 'التاريخ', key: 'المفتاح', empty: 'لا يوجد عملاء مطابقون', loading: 'جارٍ التحميل…',
    error: 'تعذّر تحميل العملاء', unavailable: 'قاعدة البيانات غير متاحة', total: 'عميل', prev: 'السابق', next: 'التالي', page: 'صفحة',
    statuses: { new: 'جديد', contacted: 'تم التواصل', converted: 'محوّل', rejected: 'مرفوض', activated: 'مُفعَّل' },
    close: 'إغلاق', details: 'تفاصيل العميل', changeStatus: 'تغيير الحالة', readOnly: 'حسابك للقراءة فقط',
    activate: 'تفعيل الاشتراك', activateHelp: 'يُنشأ مفتاح ترخيص حقيقي على الخادم ويُسجَّل في سجل التدقيق.', plan: 'الباقة', duration: 'المدة',
    months: (n) => (n === 1 ? 'شهر' : n === 12 ? 'سنة' : n === 24 ? 'سنتان' : `${n} أشهر`), generate: 'إنشاء مفتاح الترخيص', generating: 'جارٍ الإنشاء…',
    activated: 'تم التفعيل', copy: 'نسخ المفتاح', copied: 'تم النسخ', whatsapp: 'إرسال عبر واتساب',
    sentWa: 'أُرسل المفتاح إلى التاجر عبر واتساب', notSentWa: 'لم يُرسل واتساب تلقائياً؛ أرسل المفتاح يدوياً',
    auditOk: 'سُجّل الإجراء في سجل التدقيق', auditFail: 'تحذير: لم يُسجَّل الإجراء في سجل التدقيق',
    already: 'هذا العميل مُفعَّل مسبقاً', rejectedFirst: 'العميل مرفوض: غيّر حالته أولاً', forbidden: 'ليست لديك صلاحية التعديل',
    failed: 'تعذّر إنشاء المفتاح', statusFailed: 'تعذّر تغيير الحالة',
    types: { bakery: 'مخبزة', cafe: 'مقهى', restaurant: 'مطعم', grocery: 'بقالة', beauty: 'تجميل', fashion: 'ملابس', pharmacy: 'صيدلية', vegetables: 'خضر وفواكه', general: 'عام', multi: 'متعدد', other: 'أخرى' },
    activatedBy: 'فعّله',
  },
  fr: {
    title: 'Prospects', subtitle: 'Demandes de démo, les plus récentes en premier', search: 'Rechercher nom, téléphone, ville',
    allStatuses: 'Tous les statuts', apply: 'Appliquer', refresh: 'Actualiser', store: 'Commerce', phone: 'Téléphone', type: 'Activité', city: 'Ville',
    lang: 'Langue', status: 'Statut', date: 'Date', key: 'Clé', empty: 'Aucun prospect correspondant', loading: 'Chargement…',
    error: 'Impossible de charger les prospects', unavailable: 'Base de données indisponible', total: 'prospects', prev: 'Précédent', next: 'Suivant', page: 'Page',
    statuses: { new: 'Nouveau', contacted: 'Contacté', converted: 'Converti', rejected: 'Refusé', activated: 'Activé' },
    close: 'Fermer', details: 'Détail du prospect', changeStatus: 'Changer le statut', readOnly: 'Votre compte est en lecture seule',
    activate: 'Activer l’abonnement', activateHelp: 'Une vraie clé de licence est créée côté serveur et inscrite au journal d’audit.', plan: 'Formule', duration: 'Durée',
    months: (n) => (n === 1 ? '1 mois' : n === 12 ? '1 an' : n === 24 ? '2 ans' : `${n} mois`), generate: 'Générer la clé de licence', generating: 'Génération…',
    activated: 'Activé', copy: 'Copier la clé', copied: 'Copié', whatsapp: 'Envoyer sur WhatsApp',
    sentWa: 'Clé envoyée au commerçant sur WhatsApp', notSentWa: 'WhatsApp non envoyé automatiquement : envoyez la clé à la main',
    auditOk: 'Action inscrite au journal d’audit', auditFail: 'Attention : action non inscrite au journal d’audit',
    already: 'Ce prospect est déjà activé', rejectedFirst: 'Prospect refusé : changez d’abord son statut', forbidden: 'Vous n’avez pas le droit de modifier',
    failed: 'Impossible de générer la clé', statusFailed: 'Impossible de changer le statut',
    types: { bakery: 'Boulangerie', cafe: 'Café', restaurant: 'Restaurant', grocery: 'Épicerie', beauty: 'Beauté', fashion: 'Mode', pharmacy: 'Pharmacie', vegetables: 'Fruits et légumes', general: 'Général', multi: 'Multi', other: 'Autre' },
    activatedBy: 'Activé par',
  },
  en: {
    title: 'Leads', subtitle: 'Demo requests, newest first', search: 'Search name, phone, city',
    allStatuses: 'All statuses', apply: 'Apply', refresh: 'Refresh', store: 'Shop', phone: 'Phone', type: 'Business', city: 'City',
    lang: 'Language', status: 'Status', date: 'Date', key: 'Key', empty: 'No matching leads', loading: 'Loading…',
    error: 'Could not load leads', unavailable: 'Database unavailable', total: 'leads', prev: 'Previous', next: 'Next', page: 'Page',
    statuses: { new: 'New', contacted: 'Contacted', converted: 'Converted', rejected: 'Rejected', activated: 'Activated' },
    close: 'Close', details: 'Lead details', changeStatus: 'Change status', readOnly: 'Your account is read-only',
    activate: 'Activate subscription', activateHelp: 'A real license key is created on the server and written to the audit log.', plan: 'Plan', duration: 'Duration',
    months: (n) => (n === 1 ? '1 month' : n === 12 ? '1 year' : n === 24 ? '2 years' : `${n} months`), generate: 'Generate license key', generating: 'Generating…',
    activated: 'Activated', copy: 'Copy key', copied: 'Copied', whatsapp: 'Send on WhatsApp',
    sentWa: 'Key sent to the merchant on WhatsApp', notSentWa: 'WhatsApp was not sent automatically: send the key by hand',
    auditOk: 'Action recorded in the audit log', auditFail: 'Warning: action was not recorded in the audit log',
    already: 'This lead is already activated', rejectedFirst: 'Lead is rejected: change its status first', forbidden: 'You are not allowed to edit',
    failed: 'Could not generate the key', statusFailed: 'Could not change the status',
    types: { bakery: 'Bakery', cafe: 'Café', restaurant: 'Restaurant', grocery: 'Grocery', beauty: 'Beauty', fashion: 'Fashion', pharmacy: 'Pharmacy', vegetables: 'Fruit & veg', general: 'General', multi: 'Multi', other: 'Other' },
    activatedBy: 'Activated by',
  },
};

const FIELD =
  'min-h-[44px] w-full rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-field)] px-3 text-sm text-[var(--adm-text)] ' +
  'focus:border-[var(--adm-accent)] focus:outline-none focus:ring-2 focus:ring-[#F0B429]/40 sm:w-auto';

function fmtDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR');
}

export default function LeadsTable() {
  const { lang, actor, isRTL } = useAdmin();
  const c = COPY[lang];
  const canWrite = actor.role !== 'viewer';

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [qInput, setQInput] = useState(initialQuery);
  const [statusInput, setStatusInput] = useState<LeadStatus | ''>('');
  const [applied, setApplied] = useState<{ q: string; status: LeadStatus | '' }>(() => ({ q: initialQuery(), status: '' }));
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unavailable'>('loading');

  const [selected, setSelected] = useState<Lead | null>(null);
  const [plan, setPlan] = useState<(typeof PLANS)[number]>('Starter');
  const [months, setMonths] = useState<(typeof DURATIONS)[number]>(12);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err' | 'warn'; lines: string[] } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (applied.q) q.set('q', applied.q);
    if (applied.status) q.set('status', applied.status);

    type Result = { state: 'ok'; leads: Lead[]; total: number } | { state: 'error' | 'unavailable' };
    fetch(`/api/leads?${q}`)
      .then(async (r): Promise<Result> => {
        if (r.status === 503) return { state: 'unavailable' };
        if (!r.ok) return { state: 'error' };
        const data = (await r.json()) as { leads: Lead[]; total: number };
        return { state: 'ok', leads: data.leads, total: data.total };
      })
      .catch((): Result => ({ state: 'error' }))
      .then((res) => {
        if (cancelled) return;
        if (res.state === 'ok') { setLeads(res.leads); setTotal(res.total); }
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

  function open(lead: Lead) {
    setSelected(lead);
    setNotice(null);
    setCopied(false);
  }

  async function changeStatus(lead: Lead, status: LeadStatus) {
    setNotice(null);
    const r = await fetch(`/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    if (r && r.ok) {
      const updated = { ...lead, status };
      setSelected(updated);
      setLeads((prev) => prev.map((l) => (l.id === lead.id ? updated : l)));
      const data = (await r.json().catch(() => ({}))) as { auditRecorded?: boolean };
      if (data.auditRecorded === false) setNotice({ kind: 'warn', lines: [c.auditFail] });
    } else {
      const msg = r?.status === 403 ? c.forbidden : r?.status === 409 ? c.already : c.statusFailed;
      setNotice({ kind: 'err', lines: [msg] });
    }
  }

  async function activate(lead: Lead) {
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch(`/api/admin/leads/${lead.id}/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, durationMonths: months }),
      });
      const data = (await r.json().catch(() => ({}))) as {
        lead?: Lead; license?: { key: string }; auditRecorded?: boolean; whatsapp?: { sent: boolean }; error?: string;
      };
      if (r.status === 201 && data.lead) {
        setSelected(data.lead);
        setLeads((prev) => prev.map((l) => (l.id === lead.id ? data.lead! : l)));
        setNotice({
          kind: data.auditRecorded === false ? 'warn' : 'ok',
          lines: [c.activated, data.whatsapp?.sent ? c.sentWa : c.notSentWa, data.auditRecorded === false ? c.auditFail : c.auditOk],
        });
      } else {
        const err = data.error ?? '';
        const msg =
          r.status === 403 ? c.forbidden
          : r.status === 409 && err.startsWith('lead_rejected') ? c.rejectedFirst
          : r.status === 409 ? c.already
          : r.status === 503 ? c.unavailable
          : c.failed;
        setNotice({ kind: 'err', lines: [msg] });
      }
    } catch {
      setNotice({ kind: 'err', lines: [c.failed] });
    } finally {
      setBusy(false);
    }
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const waHref = (l: Lead) =>
    `https://wa.me/${l.phone.replace(/\D/g, '').replace(/^0/, '212')}?text=${encodeURIComponent(l.licenseKey ?? '')}`;

  return (
    <section aria-labelledby="leads-title">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="leads-title" className="text-2xl font-bold text-[var(--adm-text)]">{c.title}</h1>
          <p className="text-sm text-[var(--adm-muted)]">{c.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <ExportButton dataset="leads" filters={{ q: applied.q, status: applied.status }} />
          <button
            type="button"
            onClick={() => reload()}
            className="min-h-[44px] rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm font-semibold text-[var(--adm-text)] hover:border-[var(--adm-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]"
          >
            {c.refresh}
          </button>
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); reload(1, { q: qInput.trim(), status: statusInput }); }}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3"
      >
        <label className="flex min-w-0 flex-1 basis-[220px] flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">
          {c.search}
          <input className={`${FIELD} w-full`} value={qInput} onChange={(e) => setQInput(e.target.value)} />
        </label>
        <label className="flex w-full flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)] sm:w-auto">
          {c.status}
          <select className={FIELD} value={statusInput} onChange={(e) => setStatusInput(e.target.value as LeadStatus | '')}>
            <option value="">{c.allStatuses}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{c.statuses[s]}</option>)}
          </select>
        </label>
        <button type="submit" className="min-h-[44px] rounded-[4px] bg-[var(--adm-primary)] px-4 text-sm font-bold text-[var(--adm-primary-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]">
          {c.apply}
        </button>
      </form>

      {state === 'error' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.error}</p>}
      {state === 'unavailable' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.unavailable}</p>}

      <div className="overflow-x-auto rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <caption className="sr-only">{c.title}</caption>
          <thead>
            <tr className="bg-[var(--adm-head)] text-xs uppercase tracking-wide text-[var(--adm-muted)]">
              {[c.store, c.phone, c.type, c.city, c.lang, c.status, c.date].map((h) => (
                <th key={h} scope="col" className="px-3 py-3 text-start font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan={7} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.loading}</td></tr>}
            {state === 'ok' && leads.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.empty}</td></tr>}
            {state === 'ok' && leads.map((l) => (
              <tr key={l.id} className="border-t border-[var(--adm-border)] hover:bg-[var(--adm-head)]">
                <td className="px-3 py-3">
                  <button type="button" onClick={() => open(l)} className="min-h-[44px] text-start font-semibold text-[var(--adm-text)] underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]">
                    {l.storeName}
                  </button>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-[var(--adm-text2)]" dir="ltr">{l.phone}</td>
                <td className="px-3 py-3 text-[var(--adm-muted)]">{c.types[l.businessType] ?? (l.businessType || '—')}</td>
                <td className="px-3 py-3 text-[var(--adm-muted)]">{l.city || '—'}</td>
                <td className="px-3 py-3 text-[var(--adm-muted)]" dir="ltr">{l.locale}</td>
                <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[l.status]}`}>{c.statuses[l.status]}</span></td>
                <td className="whitespace-nowrap px-3 py-3 text-[var(--adm-muted)]" dir="ltr">{fmtDate(l.submittedAt, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-[var(--adm-muted)]">
        <span>{total} {c.total}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => reload(page - 1)} className="min-h-[44px] rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 font-semibold text-[var(--adm-text)] disabled:opacity-50">
            {isRTL ? '›' : '‹'} {c.prev}
          </button>
          <span>{c.page} {page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => reload(page + 1)} className="min-h-[44px] rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-3 font-semibold text-[var(--adm-text)] disabled:opacity-50">
            {c.next} {isRTL ? '‹' : '›'}
          </button>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-40" role="presentation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSelected(null)} aria-hidden="true" />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={c.details}
            className="absolute inset-y-0 end-0 w-[380px] max-w-[95vw] overflow-y-auto border-s border-[var(--adm-border)] bg-[var(--adm-surface)] p-5 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-[var(--adm-text)]">{selected.storeName}</h2>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[selected.status]}`}>{c.statuses[selected.status]}</span>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label={c.close} className="min-h-[44px] min-w-[44px] rounded-[4px] border border-[var(--adm-border)] text-lg text-[var(--adm-text)]">×</button>
            </div>

            <dl className="mb-5 space-y-3 text-sm">
              {[
                [c.phone, selected.phone, 'ltr'],
                [c.type, c.types[selected.businessType] ?? (selected.businessType || '—'), undefined],
                [c.city, selected.city || '—', undefined],
                [c.lang, selected.locale, 'ltr'],
                [c.date, fmtDate(selected.submittedAt, lang), 'ltr'],
              ].map(([k, v, dir]) => (
                <div key={k} className="border-b border-[var(--adm-border)] pb-2">
                  <dt className="text-xs font-semibold uppercase text-[var(--adm-muted)]">{k}</dt>
                  <dd className="text-[var(--adm-text)]" dir={dir as 'ltr' | undefined}>{v}</dd>
                </div>
              ))}
            </dl>

            {notice && (
              <div role={notice.kind === 'err' ? 'alert' : 'status'} className={`mb-4 rounded-[4px] border p-3 text-sm ${
                notice.kind === 'err' ? 'border-[var(--adm-error)] text-[var(--adm-error)]'
                : notice.kind === 'warn' ? 'border-[#F0B429] text-[var(--adm-text)]'
                : 'border-[#5EC485] text-[var(--adm-text)]'}`}>
                {notice.lines.map((l) => <p key={l}>{l}</p>)}
              </div>
            )}

            {/* License */}
            <h3 className="mb-2 text-sm font-bold text-[var(--adm-text)]">{c.activate}</h3>
            {selected.status === 'activated' && selected.licenseKey ? (
              <div className="mb-5">
                <code className="mb-2 block break-all rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-field)] p-3 text-sm text-[var(--adm-text)]" dir="ltr">{selected.licenseKey}</code>
                {selected.activatedBy && <p className="mb-2 text-xs text-[var(--adm-muted)]">{c.activatedBy}: {selected.activatedBy}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => void copyKey(selected.licenseKey!)} className="min-h-[44px] flex-1 rounded-[4px] border border-[var(--adm-border)] px-3 text-sm font-semibold text-[var(--adm-text)]">
                    {copied ? c.copied : c.copy}
                  </button>
                  <a href={waHref(selected)} target="_blank" rel="noopener noreferrer" className="flex min-h-[44px] flex-1 items-center justify-center rounded-[4px] bg-[#DCFCE7] px-3 text-sm font-semibold text-[#166534]">
                    {c.whatsapp}
                  </a>
                </div>
              </div>
            ) : canWrite ? (
              <div className="mb-5">
                <p className="mb-3 text-xs text-[var(--adm-muted)]">{c.activateHelp}</p>
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-[var(--adm-muted)]">{c.plan}
                    <select className={`${FIELD} mt-1 w-full`} value={plan} onChange={(e) => setPlan(e.target.value as (typeof PLANS)[number])}>
                      {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-[var(--adm-muted)]">{c.duration}
                    <select className={`${FIELD} mt-1 w-full`} value={months} onChange={(e) => setMonths(Number(e.target.value) as (typeof DURATIONS)[number])}>
                      {DURATIONS.map((m) => <option key={m} value={m}>{c.months(m)}</option>)}
                    </select>
                  </label>
                </div>
                <button
                  type="button"
                  disabled={busy || selected.status === 'rejected'}
                  onClick={() => void activate(selected)}
                  className="min-h-[48px] w-full rounded-[4px] bg-[var(--adm-primary)] px-4 font-bold text-[var(--adm-primary-text)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--adm-accent)]"
                >
                  {busy ? c.generating : c.generate}
                </button>
                {selected.status === 'rejected' && <p className="mt-2 text-xs text-[var(--adm-muted)]">{c.rejectedFirst}</p>}
              </div>
            ) : (
              <p className="mb-5 text-sm text-[var(--adm-muted)]">{c.readOnly}</p>
            )}

            {/* Status */}
            {selected.status !== 'activated' && (
              <>
                <h3 className="mb-2 text-sm font-bold text-[var(--adm-text)]">{c.changeStatus}</h3>
                <div className="flex flex-wrap gap-2">
                  {SETTABLE.map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={!canWrite}
                      aria-pressed={selected.status === s}
                      onClick={() => void changeStatus(selected, s)}
                      className={`min-h-[44px] rounded-full px-4 text-xs font-bold disabled:opacity-50 ${selected.status === s ? STATUS_STYLE[s] : 'border border-[var(--adm-border)] text-[var(--adm-text)]'}`}
                    >
                      {c.statuses[s]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
