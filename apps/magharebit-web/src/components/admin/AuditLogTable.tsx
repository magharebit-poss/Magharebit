'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './AdminShell';

interface AuditEntry {
  id: string;
  ts: string;
  actorId: string;
  actorName: string;
  actorEmail?: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  meta?: Record<string, unknown>;
  ip?: string;
}

type Lang = 'ar' | 'fr' | 'en';

const ACTIONS = [
  'generateLicense', 'revokeKey', 'extendSubscription', 'approveMerchant', 'suspendMerchant',
  'reactivateMerchant', 'createCoupon', 'broadcastNotification', 'createAdmin', 'disableAdmin', 'adminLogin',
] as const;

const ACTION_LABEL: Record<Lang, Record<string, string>> = {
  ar: {
    generateLicense: 'إنشاء ترخيص', revokeKey: 'إلغاء مفتاح', extendSubscription: 'تمديد الاشتراك',
    approveMerchant: 'قبول تاجر', suspendMerchant: 'تعليق تاجر', reactivateMerchant: 'إعادة تفعيل تاجر',
    createCoupon: 'إنشاء قسيمة', broadcastNotification: 'بث إشعار', createAdmin: 'إنشاء مسؤول',
    disableAdmin: 'تعطيل مسؤول', adminLogin: 'تسجيل دخول',
  },
  fr: {
    generateLicense: 'Licence générée', revokeKey: 'Clé révoquée', extendSubscription: 'Abonnement prolongé',
    approveMerchant: 'Commerçant approuvé', suspendMerchant: 'Commerçant suspendu', reactivateMerchant: 'Commerçant réactivé',
    createCoupon: 'Coupon créé', broadcastNotification: 'Notification diffusée', createAdmin: 'Admin créé',
    disableAdmin: 'Admin désactivé', adminLogin: 'Connexion',
  },
  en: {
    generateLicense: 'License generated', revokeKey: 'Key revoked', extendSubscription: 'Subscription extended',
    approveMerchant: 'Merchant approved', suspendMerchant: 'Merchant suspended', reactivateMerchant: 'Merchant reactivated',
    createCoupon: 'Coupon created', broadcastNotification: 'Notification broadcast', createAdmin: 'Admin created',
    disableAdmin: 'Admin disabled/enabled', adminLogin: 'Sign-in',
  },
};

const COPY: Record<Lang, {
  title: string; subtitle: string; time: string; performedBy: string; action: string; target: string; details: string;
  all: string; targetFilter: string; from: string; to: string; apply: string; reset: string; empty: string;
  prev: string; next: string; page: string; error: string; unavailable: string; total: string; loading: string;
}> = {
  ar: {
    title: 'سجل التدقيق', subtitle: 'كل إجراءات المسؤولين، من الأحدث إلى الأقدم', time: 'الوقت', performedBy: 'نُفِّذ بواسطة',
    action: 'الإجراء', target: 'الهدف', details: 'التفاصيل', all: 'كل الإجراءات', targetFilter: 'معرّف الهدف',
    from: 'من', to: 'إلى', apply: 'تطبيق', reset: 'إعادة ضبط', empty: 'لا توجد سجلات مطابقة',
    prev: 'السابق', next: 'التالي', page: 'صفحة', error: 'تعذّر تحميل السجل',
    unavailable: 'قاعدة البيانات غير متاحة', total: 'سجل', loading: 'جارٍ التحميل…',
  },
  fr: {
    title: 'Journal d’audit', subtitle: 'Toutes les actions des administrateurs, de la plus récente à la plus ancienne',
    time: 'Date', performedBy: 'Effectué par', action: 'Action', target: 'Cible', details: 'Détails', all: 'Toutes les actions',
    targetFilter: 'ID de la cible', from: 'Du', to: 'Au', apply: 'Appliquer', reset: 'Réinitialiser',
    empty: 'Aucune entrée correspondante', prev: 'Précédent', next: 'Suivant', page: 'Page', error: 'Impossible de charger le journal',
    unavailable: 'Base de données indisponible', total: 'entrées', loading: 'Chargement…',
  },
  en: {
    title: 'Audit log', subtitle: 'Every admin action, newest first', time: 'Time', performedBy: 'Performed by',
    action: 'Action', target: 'Target', details: 'Details', all: 'All actions', targetFilter: 'Target ID',
    from: 'From', to: 'To', apply: 'Apply', reset: 'Reset', empty: 'No matching entries', prev: 'Previous',
    next: 'Next', page: 'Page', error: 'Could not load the log', unavailable: 'Database unavailable',
    total: 'entries', loading: 'Loading…',
  },
};

const FIELD =
  'min-h-[44px] w-full rounded-[4px] border border-[#E0E0E0] bg-white px-3 text-sm text-[#111827] sm:w-auto ' +
  'focus:border-[#B8860B] focus:outline-none focus:ring-2 focus:ring-[#F0B429]/40';

const LIMIT = 25;

function fmtTime(iso: string, lang: Lang): string {
  // Same dd/mm/yyyy hh:mm:ss shape in every language, Western digits; Arabic locales add bidi marks that scramble it.
  const tag = lang === 'en' ? 'en-GB' : 'fr-FR';
  return new Date(iso).toLocaleString(tag, { dateStyle: 'short', timeStyle: 'medium' });
}

function summarize(meta?: Record<string, unknown>): string {
  if (!meta) return '';
  return Object.entries(meta)
    .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    .join(' · ');
}

export default function AuditLogTable() {
  const { lang, isRTL } = useAdmin();
  const c = COPY[lang];

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [target, setTarget] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ action: '', target: '', from: '', to: '' });
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unavailable'>('loading');

  // Fetch whenever the page or the applied filters change. The handlers below set
  // state to 'loading' themselves, so the effect only updates state after the request.
  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (applied.action) q.set('action', applied.action);
    if (applied.target) q.set('targetId', applied.target);
    if (applied.from) q.set('from', new Date(applied.from).toISOString());
    if (applied.to) q.set('to', new Date(`${applied.to}T23:59:59.999`).toISOString());

    type Result = { state: 'ok'; entries: AuditEntry[]; total: number } | { state: 'error' | 'unavailable' };
    fetch(`/api/admin/audit-logs?${q}`)
      .then(async (r): Promise<Result> => {
        if (r.status === 503) return { state: 'unavailable' };
        if (!r.ok) return { state: 'error' };
        const data = (await r.json()) as { entries: AuditEntry[]; total: number };
        return { state: 'ok', entries: data.entries, total: data.total };
      })
      .catch((): Result => ({ state: 'error' }))
      .then((res) => {
        if (cancelled) return;
        if (res.state === 'ok') {
          setEntries(res.entries);
          setTotal(res.total);
        }
        setState(res.state);
      });
    return () => { cancelled = true; };
  }, [page, applied]);

  function go(nextPage: number, nextApplied = applied) {
    setState('loading');
    setPage(nextPage);
    setApplied(nextApplied);
  }

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <section aria-labelledby="audit-title">
      <h1 id="audit-title" className="text-2xl font-bold text-[#111827]">{c.title}</h1>
      <p className="mb-4 text-sm text-[#6B7280]">{c.subtitle}</p>

      <form
        onSubmit={(e) => { e.preventDefault(); go(1, { action, target: target.trim(), from, to }); }}
        className="mb-4 flex flex-wrap items-end gap-3 rounded-[8px] border border-[#E0E0E0] bg-white p-3"
      >
        <label className="flex w-full min-w-0 flex-col gap-1 text-xs font-semibold text-[#6B7280] sm:w-auto">
          {c.action}
          <select className={FIELD} value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">{c.all}</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABEL[lang][a]} ({a})</option>)}
          </select>
        </label>
        <label className="flex w-full min-w-0 flex-col gap-1 text-xs font-semibold text-[#6B7280] sm:w-auto">
          {c.targetFilter}
          <input className={FIELD} value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <label className="flex w-full min-w-0 flex-col gap-1 text-xs font-semibold text-[#6B7280] sm:w-auto">
          {c.from}
          <input type="date" className={FIELD} value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="flex w-full min-w-0 flex-col gap-1 text-xs font-semibold text-[#6B7280] sm:w-auto">
          {c.to}
          <input type="date" className={FIELD} value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button type="submit" className="min-h-[44px] rounded-[4px] bg-brand-900 px-4 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B]">{c.apply}</button>
        <button
          type="button"
          onClick={() => { setAction(''); setTarget(''); setFrom(''); setTo(''); go(1, { action: '', target: '', from: '', to: '' }); }}
          className="min-h-[44px] rounded-[4px] border border-[#E0E0E0] px-4 text-sm font-semibold text-[#111827]"
        >
          {c.reset}
        </button>
      </form>

      {state === 'error' && <p role="alert" className="mb-3 text-sm text-[#D32F2F]">{c.error}</p>}
      {state === 'unavailable' && <p role="alert" className="mb-3 text-sm text-[#D32F2F]">{c.unavailable}</p>}

      <div className="overflow-x-auto rounded-[8px] border border-[#E0E0E0] bg-white">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">{c.title}</caption>
          <thead>
            <tr className="bg-[#F8F9FA] text-start text-xs uppercase tracking-wide text-[#6B7280]">
              {[c.time, c.performedBy, c.action, c.target, c.details].map((h) => (
                <th key={h} scope="col" className="px-3 py-3 text-start font-semibold">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {state === 'loading' && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-[#6B7280]">{c.loading}</td></tr>
            )}
            {state === 'ok' && entries.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-[#6B7280]">{c.empty}</td></tr>
            )}
            {state === 'ok' && entries.map((e) => (
              <tr key={e.id} className="border-t border-[#E0E0E0] align-top">
                <td className="whitespace-nowrap px-3 py-3 text-[#374151]" dir="ltr">{fmtTime(e.ts, lang)}</td>
                <td className="px-3 py-3">
                  <div className="font-semibold text-[#111827]">{e.actorName}</div>
                  <div className="text-xs text-[#6B7280]" dir="ltr">{e.actorEmail ?? e.actorId} · {e.actorRole}</div>
                </td>
                <td className="px-3 py-3">
                  <div className="text-[#111827]">{ACTION_LABEL[lang][e.action] ?? e.action}</div>
                  <code className="text-xs text-[#6B7280]" dir="ltr">API: {e.action}</code>
                </td>
                <td className="px-3 py-3">
                  <div className="text-xs text-[#6B7280]">{e.targetType}</div>
                  <code className="break-all text-xs text-[#111827]" dir="ltr">{e.targetId}</code>
                </td>
                <td className="max-w-[320px] px-3 py-3 text-xs text-[#6B7280]" dir="ltr">{summarize(e.meta)}{e.ip ? ` · ip ${e.ip}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-[#6B7280]">
        <span>{total} {c.total}</span>
        <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => go(page - 1)} className="min-h-[44px] rounded-[4px] border border-[#E0E0E0] bg-white px-3 font-semibold text-[#111827] disabled:opacity-50">
            {isRTL ? '›' : '‹'} {c.prev}
          </button>
          <span>{c.page} {page} / {pages}</span>
          <button type="button" disabled={page >= pages} onClick={() => go(page + 1)} className="min-h-[44px] rounded-[4px] border border-[#E0E0E0] bg-white px-3 font-semibold text-[#111827] disabled:opacity-50">
            {c.next} {isRTL ? '‹' : '›'}
          </button>
        </div>
      </div>
    </section>
  );
}
