'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './AdminShell';
import AdminDialog from './AdminDialog';
import { BTN, BTN_PRIMARY, FIELD, PLANS, fmtDate, type Lang } from './adminUi';

type Audience = 'all' | 'plan' | 'merchant';
type Status = 'queued' | 'sent' | 'cancelled';
interface Notification {
  id: string; title: string; body: string; audience: Audience; target?: string; status: Status;
  resendCount?: number; createdAt: string; createdBy: string;
}

const LIMIT = 25;

const COPY: Record<Lang, {
  title: string; subtitle: string; scaffold: string; refresh: string; send: string; dialogTitle: string; heading: string; body: string; audience: string; audiences: Record<Audience, string>;
  plan: string; merchant: string; merchantHint: string; submit: string; submitting: string; cols: string[]; statuses: Record<Status, string>; resend: string; resending: string; changeStatus: string;
  resentTimes: (n: number) => string; empty: string; loading: string; error: string; unavailable: string; total: string; prev: string; next: string; page: string; close: string;
  sentOk: string; resentOk: string; statusOk: string; invalid: string; forbidden: string; failed: string; auditFail: string; readOnly: string; resendFor: (t: string) => string; statusFor: (t: string) => string;
}> = {
  ar: {
    title: 'الإشعارات', subtitle: 'سجل الإعلانات الموجّهة إلى التجار', scaffold: 'مرحلة أولية: تُحفظ الإشعارات وتُسجَّل في سجل التدقيق بحالة «في الانتظار»؛ لا يوجد إرسال فعلي (واتساب أو داخل تطبيق نقاط البيع) بعد، وإعادة الإرسال تعيد الإشعار إلى قائمة الانتظار فقط.',
    refresh: 'تحديث', send: 'إرسال إشعار', dialogTitle: 'إشعار جديد', heading: 'العنوان', body: 'الوصف', audience: 'الجمهور', audiences: { all: 'كل التجار', plan: 'باقة محددة', merchant: 'تاجر واحد' },
    plan: 'الباقة', merchant: 'التاجر', merchantHint: 'رقم الهاتف أو المعرّف', submit: 'حفظ الإشعار', submitting: 'جارٍ الحفظ…', cols: ['العنوان', 'الوصف', 'التاريخ', 'الحالة / إعادة الإرسال'],
    statuses: { queued: 'في الانتظار', sent: 'أُرسل', cancelled: 'ملغى' }, resend: 'إعادة إرسال', resending: '…', changeStatus: 'تغيير الحالة', resentTimes: (n) => `أُعيد ${n} مرة`,
    empty: 'لا توجد إشعارات بعد', loading: 'جارٍ التحميل…', error: 'تعذّر تحميل الإشعارات', unavailable: 'قاعدة البيانات غير متاحة', total: 'إشعار', prev: 'السابق', next: 'التالي', page: 'صفحة', close: 'إغلاق',
    sentOk: 'حُفظ الإشعار (في الانتظار): لم يُرسل بعد لأن الإرسال غير مربوط.', resentOk: 'أُعيد الإشعار إلى قائمة الانتظار', statusOk: 'تم تغيير الحالة', invalid: 'تحقق من الحقول',
    forbidden: 'ليست لديك صلاحية التعديل', failed: 'تعذّر تنفيذ الإجراء', auditFail: 'تحذير: لم يُسجَّل في سجل التدقيق', readOnly: 'حسابك للقراءة فقط',
    resendFor: (t) => `إعادة إرسال ${t}`, statusFor: (t) => `حالة ${t}`,
  },
  fr: {
    title: 'Notifications', subtitle: 'Historique des annonces envoyées aux commerçants', scaffold: 'Première version : les notifications sont enregistrées et auditées avec le statut « en file » ; aucun envoi réel (WhatsApp ou boîte du POS) n’est encore branché, et « Renvoyer » remet seulement la notification en file.',
    refresh: 'Actualiser', send: 'Envoyer une notification', dialogTitle: 'Nouvelle notification', heading: 'Titre', body: 'Description', audience: 'Public', audiences: { all: 'Tous les commerçants', plan: 'Une formule', merchant: 'Un commerçant' },
    plan: 'Formule', merchant: 'Commerçant', merchantHint: 'Téléphone ou identifiant', submit: 'Enregistrer la notification', submitting: 'Enregistrement…', cols: ['Titre', 'Description', 'Date', 'Statut / Renvoyer'],
    statuses: { queued: 'En file', sent: 'Envoyée', cancelled: 'Annulée' }, resend: 'Renvoyer', resending: '…', changeStatus: 'Changer le statut', resentTimes: (n) => `Renvoyée ${n} fois`,
    empty: 'Aucune notification pour le moment', loading: 'Chargement…', error: 'Impossible de charger les notifications', unavailable: 'Base de données indisponible', total: 'notifications', prev: 'Précédent', next: 'Suivant', page: 'Page', close: 'Fermer',
    sentOk: 'Notification enregistrée (en file) : pas encore envoyée, l’envoi n’est pas branché.', resentOk: 'Notification remise en file', statusOk: 'Statut modifié', invalid: 'Vérifiez les champs',
    forbidden: 'Vous n’avez pas le droit de modifier', failed: 'Action impossible', auditFail: 'Attention : non inscrit au journal d’audit', readOnly: 'Votre compte est en lecture seule',
    resendFor: (t) => `Renvoyer ${t}`, statusFor: (t) => `Statut de ${t}`,
  },
  en: {
    title: 'Notifications', subtitle: 'History of announcements sent to merchants', scaffold: 'First version: notifications are stored and audited as “queued”; no real delivery (WhatsApp or POS inbox) is wired yet, and “Resend” only puts the notification back in the queue.',
    refresh: 'Refresh', send: 'Send Notification', dialogTitle: 'New notification', heading: 'Title', body: 'Description', audience: 'Audience', audiences: { all: 'All merchants', plan: 'One plan', merchant: 'One merchant' },
    plan: 'Plan', merchant: 'Merchant', merchantHint: 'Phone or id', submit: 'Save notification', submitting: 'Saving…', cols: ['Title', 'Description', 'Date', 'Status / Resend'],
    statuses: { queued: 'Queued', sent: 'Sent', cancelled: 'Cancelled' }, resend: 'Resend', resending: '…', changeStatus: 'Change status', resentTimes: (n) => `Resent ${n}×`,
    empty: 'No notifications yet', loading: 'Loading…', error: 'Could not load notifications', unavailable: 'Database unavailable', total: 'notifications', prev: 'Previous', next: 'Next', page: 'Page', close: 'Close',
    sentOk: 'Notification saved (queued): not delivered yet because sending is not wired.', resentOk: 'Notification put back in the queue', statusOk: 'Status changed', invalid: 'Check the fields',
    forbidden: 'You are not allowed to edit', failed: 'Action failed', auditFail: 'Warning: not recorded in the audit log', readOnly: 'Your account is read-only',
    resendFor: (t) => `Resend ${t}`, statusFor: (t) => `Status of ${t}`,
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
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setFormError('');
    try {
      const body: Record<string, unknown> = { title: form.title, body: form.body, audience: form.audience };
      if (form.audience === 'plan') body.target = form.plan;
      if (form.audience === 'merchant') body.target = form.merchant;
      const r = await fetch('/api/admin/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = (await r.json().catch(() => ({}))) as { auditRecorded?: boolean };
      if (r.ok) {
        setDialog(false);
        setForm(EMPTY);
        setNotice({ kind: d.auditRecorded === false ? 'err' : 'ok', text: d.auditRecorded === false ? `${c.sentOk} ${c.auditFail}` : c.sentOk });
        reload(1);
      } else {
        setFormError(r.status === 422 ? c.invalid : r.status === 403 ? c.forbidden : c.failed);
      }
    } catch {
      setFormError(c.failed);
    } finally {
      setBusy(false);
    }
  }

  async function patch(n: Notification, payload: { status: Status } | { resend: true }, okText: string) {
    setRowBusy(n.id);
    setNotice(null);
    try {
      const r = await fetch(`/api/admin/notifications/${n.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const d = (await r.json().catch(() => ({}))) as { notification?: Notification; auditRecorded?: boolean };
      if (r.ok && d.notification) {
        setRows((cur) => cur.map((x) => (x.id === n.id ? { ...x, ...d.notification } : x)));
        setNotice({ kind: d.auditRecorded === false ? 'err' : 'ok', text: d.auditRecorded === false ? `${okText}. ${c.auditFail}` : okText });
      } else {
        setNotice({ kind: 'err', text: r.status === 403 ? c.forbidden : c.failed });
      }
    } catch {
      setNotice({ kind: 'err', text: c.failed });
    } finally {
      setRowBusy(null);
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
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => reload()} className={BTN}>{c.refresh}</button>
          {canWrite && <button type="button" onClick={() => { setForm(EMPTY); setFormError(''); setDialog(true); }} className={BTN_PRIMARY}>+ {c.send}</button>}
        </div>
      </div>
      <p className="mb-4 rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-2 text-xs text-[var(--adm-muted)]">{c.scaffold}</p>

      {!canWrite && <p className="mb-3 text-sm text-[var(--adm-muted)]">{c.readOnly}</p>}
      {notice && <p role={notice.kind === 'err' ? 'alert' : 'status'} className={`mb-3 text-sm ${notice.kind === 'err' ? 'text-[var(--adm-error)]' : 'text-[var(--adm-text)]'}`}>{notice.text}</p>}
      {state === 'error' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.error}</p>}
      {state === 'unavailable' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.unavailable}</p>}

      <div className="overflow-x-auto rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        <table className="w-full min-w-[820px] border-collapse text-sm">
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
              <tr key={n.id} className="border-t border-[var(--adm-border)] align-top">
                <td className="px-3 py-3"><div className="font-semibold text-[var(--adm-text)]">{n.title}</div><div className="text-xs text-[var(--adm-muted)]">{audienceText(n)}</div></td>
                <td className="max-w-[340px] px-3 py-3 text-[var(--adm-muted)]">{n.body.length > 140 ? `${n.body.slice(0, 140)}…` : n.body}</td>
                <td className="whitespace-nowrap px-3 py-3 text-[var(--adm-muted)]" dir="ltr">{fmtDate(n.createdAt, lang)}<div className="text-xs">{n.createdBy}</div></td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className={`${FIELD} w-auto`} value={n.status} disabled={!canWrite || rowBusy === n.id} aria-label={c.statusFor(n.title)}
                      onChange={(e) => void patch(n, { status: e.target.value as Status }, c.statusOk)}
                    >
                      {(['queued', 'sent', 'cancelled'] as Status[]).map((s) => <option key={s} value={s}>{c.statuses[s]}</option>)}
                    </select>
                    {canWrite && (
                      <button type="button" disabled={rowBusy === n.id} onClick={() => void patch(n, { resend: true }, c.resentOk)} aria-label={c.resendFor(n.title)} className={BTN}>
                        {rowBusy === n.id ? c.resending : c.resend}
                      </button>
                    )}
                  </div>
                  {!!n.resendCount && <div className="mt-1 text-xs text-[var(--adm-muted)]">{c.resentTimes(n.resendCount)}</div>}
                </td>
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

      {dialog && (
        <AdminDialog title={c.dialogTitle} closeLabel={c.close} onClose={() => setDialog(false)}>
          <form onSubmit={(e) => void create(e)} className="grid gap-4">
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.heading}
              <input autoFocus required minLength={2} maxLength={120} className={`${FIELD} sm:w-full`} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.body}
              <textarea required minLength={2} maxLength={1000} rows={4} className={`${FIELD} min-h-[104px] py-2 sm:w-full`} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
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
            {formError && <p role="alert" className="text-sm text-[var(--adm-error)]">{formError}</p>}
            <div className="flex justify-end"><button type="submit" disabled={busy} className={`${BTN_PRIMARY} min-w-[160px]`}>{busy ? c.submitting : c.submit}</button></div>
          </form>
        </AdminDialog>
      )}
    </section>
  );
}
