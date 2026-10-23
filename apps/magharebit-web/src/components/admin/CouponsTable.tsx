'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './AdminShell';
import { BTN, BTN_PRIMARY, FIELD, PLANS, fmtDate, type Lang } from './adminUi';

type Kind = 'percent' | 'fixed' | 'trial_days';
interface Coupon {
  id: string; code: string; kind: Kind; value: number; description?: string; plans?: string[];
  maxRedemptions?: number; redeemed: number; expiresAt?: string; active: boolean; createdAt: string; createdBy: string;
}

const LIMIT = 25;

const COPY: Record<Lang, {
  title: string; subtitle: string; scaffold: string; search: string; refresh: string; apply: string; newTitle: string;
  code: string; kind: string; value: string; plans: string; allPlans: string; max: string; unlimited: string; expires: string; description: string; create: string;
  kinds: Record<Kind, string>; cols: string[]; used: string; active: string; off: string; empty: string; loading: string; error: string; unavailable: string;
  total: string; prev: string; next: string; page: string; created: string; exists: string; invalid: string; forbidden: string; failed: string; auditFail: string; readOnly: string; toggleOff: string; toggleOn: string; valueHint: Record<Kind, string>;
}> = {
  ar: {
    title: 'القسائم', subtitle: 'رموز الخصم والفترات التجريبية', scaffold: 'مرحلة أولية: تُحفظ الرموز وتُسجَّل في سجل التدقيق، والاستخدام عند الاشتراك غير مفعّل بعد.', search: 'بحث بالرمز', refresh: 'تحديث', apply: 'تطبيق', newTitle: 'قسيمة جديدة',
    code: 'الرمز', kind: 'النوع', value: 'القيمة', plans: 'الباقات', allPlans: 'كل الباقات', max: 'الحد الأقصى للاستخدام', unlimited: 'غير محدود', expires: 'تاريخ الانتهاء', description: 'ملاحظة', create: 'إنشاء القسيمة',
    kinds: { percent: 'نسبة مئوية', fixed: 'مبلغ ثابت (درهم)', trial_days: 'أيام تجريبية إضافية' }, cols: ['الرمز', 'الخصم', 'الباقات', 'الاستخدام', 'ينتهي', 'الحالة'], used: 'مستخدمة', active: 'نشطة', off: 'متوقفة', empty: 'لا توجد قسائم', loading: 'جارٍ التحميل…', error: 'تعذّر تحميل القسائم', unavailable: 'قاعدة البيانات غير متاحة',
    total: 'قسيمة', prev: 'السابق', next: 'التالي', page: 'صفحة', created: 'تم إنشاء القسيمة', exists: 'هذا الرمز موجود مسبقاً', invalid: 'تحقق من الحقول', forbidden: 'ليست لديك صلاحية التعديل', failed: 'تعذّر تنفيذ الإجراء', auditFail: 'تحذير: لم يُسجَّل الإجراء في سجل التدقيق', readOnly: 'حسابك للقراءة فقط', toggleOff: 'إيقاف القسيمة', toggleOn: 'تفعيل القسيمة',
    valueHint: { percent: '1 – 100', fixed: 'درهم', trial_days: '1 – 90 يوم' },
  },
  fr: {
    title: 'Coupons', subtitle: 'Codes de réduction et périodes d’essai', scaffold: 'Première version : les codes sont enregistrés et audités ; leur utilisation à l’inscription n’est pas encore branchée.', search: 'Rechercher un code', refresh: 'Actualiser', apply: 'Appliquer', newTitle: 'Nouveau coupon',
    code: 'Code', kind: 'Type', value: 'Valeur', plans: 'Formules', allPlans: 'Toutes les formules', max: 'Utilisations max.', unlimited: 'Illimité', expires: 'Date d’expiration', description: 'Note', create: 'Créer le coupon',
    kinds: { percent: 'Pourcentage', fixed: 'Montant fixe (MAD)', trial_days: 'Jours d’essai en plus' }, cols: ['Code', 'Avantage', 'Formules', 'Utilisation', 'Expire', 'Statut'], used: 'utilisés', active: 'Actif', off: 'Désactivé', empty: 'Aucun coupon', loading: 'Chargement…', error: 'Impossible de charger les coupons', unavailable: 'Base de données indisponible',
    total: 'coupons', prev: 'Précédent', next: 'Suivant', page: 'Page', created: 'Coupon créé', exists: 'Ce code existe déjà', invalid: 'Vérifiez les champs', forbidden: 'Vous n’avez pas le droit de modifier', failed: 'Action impossible', auditFail: 'Attention : action non inscrite au journal d’audit', readOnly: 'Votre compte est en lecture seule', toggleOff: 'Désactiver le coupon', toggleOn: 'Activer le coupon',
    valueHint: { percent: '1 – 100', fixed: 'MAD', trial_days: '1 – 90 j' },
  },
  en: {
    title: 'Coupons', subtitle: 'Discount codes and free-trial periods', scaffold: 'First version: codes are stored and audited; redeeming them at sign-up is not wired yet.', search: 'Search code', refresh: 'Refresh', apply: 'Apply', newTitle: 'New coupon',
    code: 'Code', kind: 'Type', value: 'Value', plans: 'Plans', allPlans: 'All plans', max: 'Max redemptions', unlimited: 'Unlimited', expires: 'Expiry date', description: 'Note', create: 'Create coupon',
    kinds: { percent: 'Percentage', fixed: 'Fixed amount (MAD)', trial_days: 'Extra trial days' }, cols: ['Code', 'Benefit', 'Plans', 'Usage', 'Expires', 'Status'], used: 'used', active: 'Active', off: 'Disabled', empty: 'No coupons', loading: 'Loading…', error: 'Could not load coupons', unavailable: 'Database unavailable',
    total: 'coupons', prev: 'Previous', next: 'Next', page: 'Page', created: 'Coupon created', exists: 'That code already exists', invalid: 'Check the fields', forbidden: 'You are not allowed to edit', failed: 'Action failed', auditFail: 'Warning: action was not recorded in the audit log', readOnly: 'Your account is read-only', toggleOff: 'Disable coupon', toggleOn: 'Enable coupon',
    valueHint: { percent: '1 – 100', fixed: 'MAD', trial_days: '1 – 90 d' },
  },
};

const EMPTY = { code: '', kind: 'percent' as Kind, value: '', plan: '', max: '', expires: '', description: '' };

export default function CouponsTable() {
  const { lang, actor, isRTL } = useAdmin();
  const c = COPY[lang];
  const canWrite = actor.role !== 'viewer';

  const [rows, setRows] = useState<Coupon[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unavailable'>('loading');
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (appliedQ) p.set('q', appliedQ);
    type Result = { state: 'ok'; coupons: Coupon[]; total: number } | { state: 'error' | 'unavailable' };
    fetch(`/api/admin/coupons?${p}`)
      .then(async (r): Promise<Result> => {
        if (r.status === 503) return { state: 'unavailable' };
        if (!r.ok) return { state: 'error' };
        const d = (await r.json()) as { coupons: Coupon[]; total: number };
        return { state: 'ok', coupons: d.coupons, total: d.total };
      })
      .catch((): Result => ({ state: 'error' }))
      .then((res) => {
        if (cancelled) return;
        if (res.state === 'ok') { setRows(res.coupons); setTotal(res.total); }
        setState(res.state);
      });
    return () => { cancelled = true; };
  }, [page, appliedQ, tick]);

  function reload(nextPage = page, nextQ = appliedQ) {
    setState('loading');
    setPage(nextPage);
    setAppliedQ(nextQ);
    setTick((t) => t + 1);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const body: Record<string, unknown> = { code: form.code, kind: form.kind, value: Number(form.value) };
      if (form.plan) body.plans = [form.plan];
      if (form.max) body.maxRedemptions = Number(form.max);
      if (form.expires) body.expiresAt = new Date(`${form.expires}T23:59:59`).toISOString();
      if (form.description.trim()) body.description = form.description.trim();
      const r = await fetch('/api/admin/coupons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = (await r.json().catch(() => ({}))) as { auditRecorded?: boolean };
      if (r.ok) {
        setNotice({ kind: d.auditRecorded === false ? 'warn' : 'ok', text: d.auditRecorded === false ? `${c.created} · ${c.auditFail}` : c.created });
        setForm(EMPTY);
        reload(1, '');
        setQ('');
      } else {
        setNotice({ kind: 'err', text: r.status === 409 ? c.exists : r.status === 422 ? c.invalid : r.status === 403 ? c.forbidden : c.failed });
      }
    } catch {
      setNotice({ kind: 'err', text: c.failed });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(cp: Coupon) {
    setNotice(null);
    const r = await fetch(`/api/admin/coupons/${cp.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !cp.active }) }).catch(() => null);
    if (r?.ok) setTick((t) => t + 1);
    else setNotice({ kind: 'err', text: r?.status === 403 ? c.forbidden : c.failed });
  }

  const pages = Math.max(1, Math.ceil(total / LIMIT));
  const benefit = (cp: Coupon) => (cp.kind === 'percent' ? `${cp.value}%` : cp.kind === 'fixed' ? `${cp.value} MAD` : `+${cp.value} ${lang === 'ar' ? 'يوم' : lang === 'fr' ? 'j' : 'd'}`);

  return (
    <section aria-labelledby="coupons-title">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id="coupons-title" className="text-2xl font-bold text-[var(--adm-text)]">{c.title}</h1>
          <p className="text-sm text-[var(--adm-muted)]">{c.subtitle}</p>
        </div>
        <button type="button" onClick={() => reload()} className={BTN}>{c.refresh}</button>
      </div>
      <p className="mb-4 rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-2 text-xs text-[var(--adm-muted)]">{c.scaffold}</p>

      {canWrite ? (
        <form onSubmit={(e) => void create(e)} className="mb-5 rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4" aria-label={c.newTitle}>
          <h2 className="mb-3 text-sm font-bold text-[var(--adm-text)]">{c.newTitle}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.code}
              <input required dir="ltr" className={`${FIELD} sm:w-full`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} maxLength={24} placeholder="RAMADAN25" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.kind}
              <select className={`${FIELD} sm:w-full`} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
                {(Object.keys(c.kinds) as Kind[]).map((k) => <option key={k} value={k}>{c.kinds[k]}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.value} ({c.valueHint[form.kind]})
              <input required type="number" min={1} step={form.kind === 'fixed' ? 'any' : 1} dir="ltr" className={`${FIELD} sm:w-full`} value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.plans}
              <select className={`${FIELD} sm:w-full`} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
                <option value="">{c.allPlans}</option>
                {PLANS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.max}
              <input type="number" min={1} dir="ltr" className={`${FIELD} sm:w-full`} value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} placeholder={c.unlimited} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.expires}
              <input type="date" dir="ltr" className={`${FIELD} sm:w-full`} value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)] sm:col-span-2 lg:col-span-3">{c.description}
              <input className={`${FIELD} sm:w-full`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={200} />
            </label>
          </div>
          {notice && <p role={notice.kind === 'err' ? 'alert' : 'status'} className={`mt-3 text-sm ${notice.kind === 'err' ? 'text-[var(--adm-error)]' : 'text-[var(--adm-text)]'}`}>{notice.text}</p>}
          <button type="submit" disabled={busy} className={`${BTN_PRIMARY} mt-3`}>{c.create}</button>
        </form>
      ) : (
        <p className="mb-4 text-sm text-[var(--adm-muted)]">{c.readOnly}</p>
      )}

      <form onSubmit={(e) => { e.preventDefault(); reload(1, q.trim()); }} className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 basis-[200px] flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.search}
          <input dir="ltr" className={`${FIELD} sm:w-full`} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button type="submit" className={BTN_PRIMARY}>{c.apply}</button>
      </form>

      {state === 'error' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.error}</p>}
      {state === 'unavailable' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.unavailable}</p>}

      <div className="overflow-x-auto rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">{c.title}</caption>
          <thead>
            <tr className="bg-[var(--adm-head)] text-xs uppercase tracking-wide text-[var(--adm-muted)]">
              {c.cols.map((h) => <th key={h} scope="col" className="px-3 py-3 text-start font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.loading}</td></tr>}
            {state === 'ok' && rows.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.empty}</td></tr>}
            {state === 'ok' && rows.map((cp) => (
              <tr key={cp.id} className="border-t border-[var(--adm-border)] hover:bg-[var(--adm-head)]">
                <td className="px-3 py-3"><code className="font-mono text-sm font-semibold text-[var(--adm-text)]" dir="ltr">{cp.code}</code>
                  {cp.description && <div className="text-xs text-[var(--adm-muted)]">{cp.description}</div>}</td>
                <td className="px-3 py-3 text-[var(--adm-text)]" dir="ltr">{benefit(cp)}<div className="text-xs text-[var(--adm-muted)]">{c.kinds[cp.kind]}</div></td>
                <td className="px-3 py-3 text-[var(--adm-muted)]">{cp.plans?.length ? cp.plans.join(', ') : c.allPlans}</td>
                <td className="px-3 py-3 text-[var(--adm-muted)]" dir="ltr">{cp.redeemed} / {cp.maxRedemptions ?? '∞'}</td>
                <td className="whitespace-nowrap px-3 py-3 text-[var(--adm-muted)]" dir="ltr">{cp.expiresAt ? fmtDate(cp.expiresAt, lang) : '—'}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button" role="switch" aria-checked={cp.active} aria-label={cp.active ? c.toggleOff : c.toggleOn} disabled={!canWrite} onClick={() => void toggle(cp)}
                      className="relative inline-flex h-11 w-14 shrink-0 items-center justify-center disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)]"
                    >
                      <span aria-hidden="true" className={`relative inline-block h-6 w-11 rounded-full transition-colors ${cp.active ? 'bg-[#16A34A]' : 'bg-[#9CA3AF]'}`}>
                        <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all" style={{ insetInlineStart: cp.active ? 22 : 2 }} />
                      </span>
                    </button>
                    <span className="text-xs font-semibold text-[var(--adm-text)]">{cp.active ? c.active : c.off}</span>
                  </div>
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
    </section>
  );
}
