'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './AdminShell';

interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  email?: string;
  role: 'owner' | 'operator' | 'viewer';
  createdAt: string;
  disabledAt?: string;
}

type Lang = 'ar' | 'fr' | 'en';

const COPY: Record<Lang, {
  title: string; subtitle: string; forbidden: string; add: string; username: string; displayName: string; email: string;
  emailOpt: string; role: string; password: string; passwordHint: string; create: string; creating: string;
  name: string; status: string; active: string; disabled: string; created: string; disable: string; enable: string;
  operator: string; viewer: string; empty: string; loadError: string; unavailable: string; taken: string;
  invalid: string; done: string; loading: string; toggleFail: string;
}> = {
  ar: {
    title: 'المسؤولون', subtitle: 'حسابات فردية بأدوار؛ كل إجراء يُسجَّل باسم صاحبه', forbidden: 'هذه الصفحة للمالك فقط',
    add: 'إضافة مسؤول', username: 'اسم المستخدم', displayName: 'الاسم الظاهر', email: 'البريد الإلكتروني', emailOpt: '(اختياري)',
    role: 'الدور', password: 'كلمة المرور', passwordHint: '12 حرفاً على الأقل', create: 'إنشاء', creating: 'جارٍ الإنشاء…',
    name: 'الاسم', status: 'الحالة', active: 'نشط', disabled: 'معطّل', created: 'أُنشئ', disable: 'تعطيل', enable: 'تفعيل',
    operator: 'مشغّل (يمكنه التعديل)', viewer: 'مشاهد (قراءة فقط)', empty: 'لا يوجد مسؤولون بعد',
    loadError: 'تعذّر تحميل الحسابات', unavailable: 'قاعدة البيانات غير متاحة', taken: 'اسم المستخدم أو البريد مستخدم',
    invalid: 'تحقق من الحقول (اسم المستخدم 3-32 حرفاً a-z 0-9 . _ -)', done: 'تم إنشاء الحساب', loading: 'جارٍ التحميل…',
    toggleFail: 'تعذّر تغيير الحالة',
  },
  fr: {
    title: 'Administrateurs', subtitle: 'Comptes individuels avec rôles ; chaque action est journalisée à leur nom',
    forbidden: 'Page réservée au propriétaire', add: 'Ajouter un administrateur', username: 'Identifiant', displayName: 'Nom affiché',
    email: 'E-mail', emailOpt: '(facultatif)', role: 'Rôle', password: 'Mot de passe', passwordHint: '12 caractères minimum',
    create: 'Créer', creating: 'Création…', name: 'Nom', status: 'Statut', active: 'Actif', disabled: 'Désactivé', created: 'Créé le',
    disable: 'Désactiver', enable: 'Activer', operator: 'Opérateur (peut modifier)', viewer: 'Lecteur (lecture seule)',
    empty: 'Aucun administrateur pour le moment', loadError: 'Impossible de charger les comptes', unavailable: 'Base de données indisponible',
    taken: 'Identifiant ou e-mail déjà utilisé', invalid: 'Vérifiez les champs (identifiant 3-32 car. a-z 0-9 . _ -)',
    done: 'Compte créé', loading: 'Chargement…', toggleFail: 'Changement de statut impossible',
  },
  en: {
    title: 'Admins', subtitle: 'Individual accounts with roles; every action is logged under their name', forbidden: 'Owner only',
    add: 'Add an admin', username: 'Username', displayName: 'Display name', email: 'Email', emailOpt: '(optional)', role: 'Role',
    password: 'Password', passwordHint: 'At least 12 characters', create: 'Create', creating: 'Creating…', name: 'Name',
    status: 'Status', active: 'Active', disabled: 'Disabled', created: 'Created', disable: 'Disable', enable: 'Enable',
    operator: 'Operator (can edit)', viewer: 'Viewer (read-only)', empty: 'No admins yet', loadError: 'Could not load accounts',
    unavailable: 'Database unavailable', taken: 'Username or email already in use',
    invalid: 'Check the fields (username 3-32 chars a-z 0-9 . _ -)', done: 'Account created', loading: 'Loading…',
    toggleFail: 'Could not change status',
  },
};

const FIELD =
  'min-h-[44px] w-full rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-field)] px-3 text-sm text-[var(--adm-text)] ' +
  'focus:border-[var(--adm-accent)] focus:outline-none focus:ring-2 focus:ring-[#F0B429]/40';

export default function AdminsTable() {
  const { actor, lang } = useAdmin();
  const c = COPY[lang];

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unavailable'>('loading');
  const [form, setForm] = useState({ username: '', displayName: '', email: '', role: 'operator', password: '' });
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const [tick, setTick] = useState(0); // bump to reload the list

  useEffect(() => {
    if (actor.role !== 'owner') return;
    let cancelled = false;
    type Result = { state: 'ok'; users: AdminUser[] } | { state: 'error' | 'unavailable' };
    fetch('/api/admin/users')
      .then(async (r): Promise<Result> => {
        if (r.status === 503) return { state: 'unavailable' };
        if (!r.ok) return { state: 'error' };
        return { state: 'ok', users: ((await r.json()) as { users: AdminUser[] }).users };
      })
      .catch((): Result => ({ state: 'error' }))
      .then((res) => {
        if (cancelled) return;
        if (res.state === 'ok') setUsers(res.users);
        setState(res.state);
      });
    return () => { cancelled = true; };
  }, [actor.role, tick]);

  const reload = () => { setState('loading'); setTick((t) => t + 1); };

  if (actor.role !== 'owner') {
    return <p role="alert" className="rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-6 text-[var(--adm-muted)]">{c.forbidden}</p>;
  }

  async function create() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...(form.email.trim() ? {} : { email: undefined }) }),
      });
      if (r.status === 201) {
        setMsg({ kind: 'ok', text: c.done });
        setForm({ username: '', displayName: '', email: '', role: 'operator', password: '' });
        reload();
      } else if (r.status === 409) setMsg({ kind: 'err', text: c.taken });
      else if (r.status === 503) setMsg({ kind: 'err', text: c.unavailable });
      else setMsg({ kind: 'err', text: c.invalid });
    } catch {
      setMsg({ kind: 'err', text: c.loadError });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(u: AdminUser) {
    setMsg(null);
    const r = await fetch(`/api/admin/users/${u.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disabled: !u.disabledAt }),
    }).catch(() => null);
    if (r && r.ok) reload();
    else setMsg({ kind: 'err', text: c.toggleFail });
  }

  return (
    <section aria-labelledby="admins-title">
      <h1 id="admins-title" className="text-2xl font-bold text-[var(--adm-text)]">{c.title}</h1>
      <p className="mb-4 text-sm text-[var(--adm-muted)]">{c.subtitle}</p>

      <form
        onSubmit={(e) => { e.preventDefault(); void create(); }}
        className="mb-6 rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-4"
      >
        <h2 className="mb-3 text-base font-bold text-[var(--adm-text)]">{c.add}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs font-semibold text-[var(--adm-muted)]">{c.username}
            <input className={`${FIELD} mt-1`} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required autoComplete="off" dir="ltr" />
          </label>
          <label className="text-xs font-semibold text-[var(--adm-muted)]">{c.displayName}
            <input className={`${FIELD} mt-1`} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
          </label>
          <label className="text-xs font-semibold text-[var(--adm-muted)]">{c.email} {c.emailOpt}
            <input type="email" className={`${FIELD} mt-1`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="off" dir="ltr" />
          </label>
          <label className="text-xs font-semibold text-[var(--adm-muted)]">{c.role}
            <select className={`${FIELD} mt-1`} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="operator">{c.operator}</option>
              <option value="viewer">{c.viewer}</option>
            </select>
          </label>
          <label className="text-xs font-semibold text-[var(--adm-muted)]">{c.password}
            <input type="password" className={`${FIELD} mt-1`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={12} autoComplete="new-password" />
            <span className="mt-1 block font-normal">{c.passwordHint}</span>
          </label>
          <div className="flex items-end">
            <button type="submit" disabled={busy} className="min-h-[48px] w-full rounded-[4px] bg-[var(--adm-primary)] px-4 font-bold text-[var(--adm-primary-text)] disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8860B]">
              {busy ? c.creating : c.create}
            </button>
          </div>
        </div>
        {msg && <p role={msg.kind === 'err' ? 'alert' : 'status'} className={`mt-3 text-sm ${msg.kind === 'err' ? 'text-[var(--adm-error)]' : 'text-[#166534]'}`}>{msg.text}</p>}
      </form>

      {state === 'error' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.loadError}</p>}
      {state === 'unavailable' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.unavailable}</p>}

      <div className="overflow-x-auto rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <caption className="sr-only">{c.title}</caption>
          <thead>
            <tr className="bg-[var(--adm-head)] text-xs uppercase tracking-wide text-[var(--adm-muted)]">
              {[c.name, c.role, c.status, c.created, ''].map((h, i) => <th key={i} scope="col" className="px-3 py-3 text-start font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan={5} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.loading}</td></tr>}
            {state === 'ok' && users.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.empty}</td></tr>}
            {state === 'ok' && users.map((u) => (
              <tr key={u.id} className="border-t border-[var(--adm-border)]">
                <td className="px-3 py-3">
                  <div className="font-semibold text-[var(--adm-text)]">{u.displayName}</div>
                  <div className="text-xs text-[var(--adm-muted)]" dir="ltr">{u.username}{u.email ? ` · ${u.email}` : ''}</div>
                </td>
                <td className="px-3 py-3 text-[var(--adm-text2)]">{u.role}</td>
                <td className="px-3 py-3">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${u.disabledAt ? 'bg-[#FEE2E2] text-[#991B1B]' : 'bg-[#DCFCE7] text-[#166534]'}`}>
                    {u.disabledAt ? c.disabled : c.active}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-[var(--adm-muted)]" dir="ltr">{new Date(u.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')}</td>
                <td className="px-3 py-3 text-end">
                  <button type="button" onClick={() => void toggle(u)} className="min-h-[44px] rounded-[4px] border border-[var(--adm-border)] px-3 text-sm font-semibold text-[var(--adm-text)] hover:border-[#B8860B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B]">
                    {u.disabledAt ? c.enable : c.disable}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
