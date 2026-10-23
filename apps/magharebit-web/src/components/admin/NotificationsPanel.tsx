'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './AdminShell';
import { BTN, BTN_PRIMARY, FIELD, PLANS, type Lang } from './adminUi';

type Audience = 'all' | 'plan' | 'merchant';
interface Notification { id: string; title: string; body: string; audience: Audience; target?: string; status: 'queued' | 'sent'; createdAt: string; createdBy: string }

const LIMIT = 25;

const COPY: Record<Lang, {
  title: string; subtitle: string; scaffold: string; refresh: string; newTitle: string; heading: string; body: string; audience: string; audiences: Record<Audience, string>;
  plan: string; merchant: string; merchantHint: string; send: string; queuedNote: string; cols: string[]; queued: string; sent: string; empty: string; loading: string; error: string; unavailable: string;
  total: string; prev: string; next: string; page: string; invalid: string; forbidden: string; failed: string; auditFail: string; readOnly: string;
}> = {
  ar: {
    title: 'الإشعارات', subtitle: 'إعلانات موجّهة إلى التجار', scaffold: 'مرحلة أولية: تُحفظ الإعلانات وتُسجَّل في سجل التدقيق بحالة «في الانتظار»؛ لا يوجد إرسال فعلي (واتساب أو داخل تطبيق نقاط البيع) بعد.', refresh: 'تحديث', newTitle: 'إشعار جديد',
    heading: 'العنوان', body: 'النص', audience: 'الجمهور', audiences: { all: 'كل التجار', plan: 'باقة محددة', merchant: 'تاجر واحد' }, plan: 'الباقة', merchant: 'التاجر', merchantHint: 'رقم الهاتف أو المعرّف', send: 'حفظ الإشعار',
    queuedNote: 'حُفظ الإشعار (في الانتظار): لم يُرسل بعد لأن الإرسال غير مربوط.', cols: ['العنوان', 'الجمهور', 'الحالة', 'بواسطة'], queued: 'في الانتظار', sent: 'أُرسل', empty: 'لا توجد إشعارات', loading: 'جارٍ التحميل…', error: 'تعذّر تحميل الإشعارات', unavailable: 'قاعدة البيانات غير متاحة',
    total: 'إشعار', prev: 'السابق', next: 'التالي', page: 'صفحة', invalid: 'تحقق من الحقول', forbidden: 'ليست لديك صلاحية التعديل', failed: 'تعذّر تنفيذ الإجراء', auditFail: 'تحذير: لم يُسجَّل الإجراء في سجل التدقيق', readOnly: 'حسابك للقراءة فقط',
  },
  fr: {
    title: 'Notifications', subtitle: 'Annonces destinées aux commerçants', scaffold: 'Première version : les annonces sont enregistrées et auditées avec le statut « en file » ; aucun envoi réel (WhatsApp ou boîte du POS) n’est encore branché.', refresh: 'Actualiser', newTitle: 'Nouvelle notification',
    heading: 'Titre', body: 'Message', audience: 'Public', audiences: { all: 'Tous les commerçants', plan: 'Une formule', merchant: 'Un commerçant' }, plan: 'Formule', merchant: 'Commerçant', merchantHint: 'Téléphone ou identifiant', send: 'Enregistrer la notification',
    queuedNote: 'Notification enregistrée (en file) : pas encore envoyée, l’envoi n’est pas branché.', cols: ['Titre', 'Public', 'Statut', 'Par'], queued: 'En file', sent: 'Envoyée', empty: 'Aucune notification', loading: 'Chargement…', error: 'Impossible de charger les notifications', unavailable: 'Base de données indisponible',
    total: 'notifications', prev: 'Précédent', next: 'Suivant', page: 'Page', invalid: 'Vérifiez les champs', forbidden: 'Vous n’avez pas le droit de modifier', failed: 'Action impossible', auditFail: 'Attention : action non inscrite au journal d’audit', readOnly: 'Votre compte est en lecture seule',
  },
  en: {
    title: 'Notifications', subtitle: 'Announcements for merchants', scaffold: 'First version: announcements are stored and audited as “queued”; no real delivery (WhatsApp or POS inbox) is wired yet.', refresh: 'Refresh', newTitle: 'New notification',
    heading: 'Title', body: 'Message', audience: 'Audience', audiences: { all: 'All merchants', plan: 'One plan', merchant: 'One merchant' }, plan: 'Plan', merchant: 'Merchant', merchantHint: 'Phone or id', send: 'Save notification',
    queuedNote: 'Notification saved (queued): not delivered yet because sending is not wired.', cols: ['Title', 'Audience', 'Status', 'By'], queued: 'Queued', sent: 'Sent', empty: 'No notifications', loading: 'Loading…', error: 'Could not load notifications', unavailable: 'Database unavailable',
    total: 'notifications', prev: 'Previous', next: 'Next', page: 'Page', invalid: 'Check the fields', forbidden: 'You are not allowed to edit', failed: 'Action failed', auditFail: 'Warning: action was not recorded in the audit log', readOnly: 'Your account is read-only',
  },
};

const EMPTY = { title: '', body: '', audience: 'all' as Audience, plan: 'Starter' as string, merchant: '' };

export default function NotificationsPanel() {
  const { lang, actor, isRTL } = useAdmin();
  const c = COPY[lang];
  const canWrite = actor.role !== 'viewer';

  const [rows, setRows] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unavailable'>('loading');
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    type Result = { state: 'ok'; notifications: Notification[]; total: number } | { state: 'error' | 'unavailable' };
    fetch(`/api/admin/notifications?page=${page}&limit=${LIMIT}`)
      .then(async (r): Promise<Result> => {
        if (r.status === 503) return { state: 'unavailable' };
        if (!r.ok) return { state: 'error' };
        const d = (await r.json()) as { notifications: Notification[]; total: number };
        return { state: 'ok', notifications: d.notifications, total: d.total };
      })
      .catch((): Result => ({ state: 'error' }))
      .then((res) => {
        if (cancelled) return;
        if (res.state === 'ok') { setRows(res.notifications); setTotal(res.total); }
        setState(res.state);
      });
    return () => { cancelled = true; };
  }, [page, tick]);

  function reload(nextPage = page) {
    setState('loading');
    setPage(nextPage);
    setTick((t) => t + 1);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const body: Record<string, unknown> = { title: form.title, body: form.body, audience: form.audience };
      if (form.audience === 'plan') body.target = form.plan;
      if (form.audience === 'merchant') body.target = form.merchant;
      const r = await fetch('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = (await r.json().catch(() => ({}))) as { auditRecorded?: boolean };
      if (r.ok) {
        setNotice({ kind: d.auditRecorded === false ? 'warn' : 'ok', text: d.auditRecorded === false ? `${c.queuedNote} ${c.auditFail}` : c.queuedNote });
        setForm(EMPTY);
        reload(1);
      } else {
        setNotice({ kind: 'err', text: r.status === 422 ? c.invalid : r.status === 403 ? c.forbidden : c.failed });
      }
    } catch {
      setNotice({ kind: 'err', text: c.failed });
    } finally {
      setBusy(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const audienceText = (n: Notification) => (n.audience === 'all' ? c.audiences.all : `${c.audiences[n.audience]}: ${n.target ?? ''}`);

  return (
    <section aria-labelledby="notifications-title">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="notifications-title" className="text-2xl font-bold text-[var(--adm-text)]">{c.title}</h1>
          <p className="text-sm text-[var(--adm-muted)]">{c.subtitle}</p>
        </div>
        <button type="button" onClick={() => reload()} className={BTN}>{c.refresh}</button>
      </div>
      <p className="mb-4 rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-2 text-xs text-[var(--adm-muted)]">{c.scaffold}</p>

      {canWrite ? (
        <form onSubmit={(e) => void submit(e)} className="mb-5 rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4" aria-label={c.newTitle}>
          <h2 className="mb-3 text-sm font-bold text-[var(--adm-text)]">{c.newTitle}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)] sm:col-span-2">{c.heading}
              <input required minLength={2} maxLength={120} className={`${FIELD} sm:w-full`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)] sm:col-span-2">{c.body}
              <textarea required minLength={2} maxLength={1000} rows={4} className={`${FIELD} min-h-[96px] py-2 sm:w-full`} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.audience}
              <select className={`${FIELD} sm:w-full`} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value as Audience })}>
                {(Object.keys(c.audiences) as Audience[]).map((a) => <option key={a} value={a}>{c.audiences[a]}</option>)}
              </select>
            </label>
            {form.audience === 'plan' && (
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.plan}
                <select className={`${FIELD} sm:w-full`} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                  {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
            )}
            {form.audience === 'merchant' && (
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.merchant} ({c.merchantHint})
                <input required dir="ltr" maxLength={64} className={`${FIELD} sm:w-full`} value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} />
              </label>
            )}
          </div>
          {notice && <p role={notice.kind === 'err' ? 'alert' : 'status'} className={`mt-3 text-sm ${notice.kind === 'err' ? 'text-[var(--adm-error)]' : 'text-[var(--adm-text)]'}`}>{notice.text}</p>}
          <button type="submit" disabled={busy} className={`${BTN_PRIMARY} mt-3`}>{c.send}</button>
        </form>
      ) : (
        <p className="mb-4 text-sm text-[var(--adm-muted)]">{c.readOnly}</p>
      )}

      {state === 'error' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.error}</p>}
      {state === 'unavailable' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.unavailable}</p>}

      <div className="overflow-x-auto rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">{c.title}</caption>
          <thead>
            <tr className="bg-[var(--adm-head)] text-xs uppercase tracking-wide text-[var(--adm-muted)]">
              {c.cols.map((h) => <th key={h} scope="col" className="px-3 py-3 text-start font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan={4} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.loading}</td></tr>}
            {state === 'ok' && rows.length === 0 && <tr><td colSpan={4} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.empty}</td></tr>}
            {state === 'ok' && rows.map((n) => (
              <tr key={n.id} className="border-t border-[var(--adm-border)] hover:bg-[var(--adm-head)]">
                <td className="px-3 py-3 text-[var(--adm-text)]"><div className="font-semibold">{n.title}</div><div className="text-xs text-[var(--adm-muted)]">{n.body.length > 90 ? `${n.body.slice(0, 90)}…` : n.body}</div></td>
                <td className="px-3 py-3 text-[var(--adm-muted)]">{audienceText(n)}</td>
                <td className="px-3 py-3"><span className="rounded-full border border-[var(--adm-border)] px-2.5 py-1 text-xs font-bold text-[var(--adm-text)]">{n.status === 'queued' ? c.queued : c.sent}</span></td>
                <td className="px-3 py-3 text-[var(--adm-muted)]">{n.createdBy}</td>
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
    </section>
  );
}
