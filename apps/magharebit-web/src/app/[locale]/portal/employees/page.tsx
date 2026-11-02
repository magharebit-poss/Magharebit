'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang, type Lang } from '@/components/landing/useLang';
import { usePortal } from '@/components/portal/shell/PortalProvider';
import { portalJson } from '@/components/portal/shell/portalFetch';
import PortalDialog, { BTN, CARD, FIELD, LABEL } from '@/components/portal/PortalDialog';
import { ago, int, money } from '@/components/portal/format';

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = 'cashier' | 'manager' | 'owner';
interface Employee {
  id: string; name: string; loginId: string; role: Role; phone?: string; isActive: boolean;
  totalSales: number; txCount: number; lastLoginAt?: string; createdAt: string;
}

const ROLES: Role[] = ['cashier', 'manager', 'owner'];
const PIN_RE = /^\d{4,6}$/;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[1][0]).toUpperCase();
}
/** Suggested login id from a Latin name ("Fatima Zahra" → "fatimazahra"); Arabic names leave it to the owner */
function suggestLogin(name: string): string {
  return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12);
}

// ─── Copy ─────────────────────────────────────────────────────────────────────
type Copy = {
  count: (n: number) => string; intro: string; loading: string; add: string; showInactive: string;
  roles: Record<Role, string>; roleHelp: Record<Role, string>; inactive: string;
  loginId: string; phone: string; sales: string; tickets: string; lastLogin: string; never: string;
  edit: string; editLabel: (n: string) => string; pin: string; pinLabel: (n: string) => string;
  deactivate: string; deactivateLabel: (n: string) => string; reactivate: string; reactivateLabel: (n: string) => string;
  empty: string; emptyHint: string; loadError: string; retry: string; close: string; cancel: string;
  form: { add: string; edit: string; name: string; namePh: string; loginId: string; loginHint: string; phone: string; optional: string; role: string; pin: string; pinConfirm: string; pinHint: string; create: string; save: string };
  pinForm: { title: string; newPin: string; confirm: string; save: string };
  off: { title: (n: string) => string; body: string; confirm: string };
  toast: { added: string; saved: string; pin: (n: string) => string; deactivated: string; reactivated: string };
  err: Record<string, string>; errGeneric: string;
};

const COPY: Record<Lang, Copy> = {
  fr: {
    count: (n) => `${n} employé${n > 1 ? 's' : ''}`, intro: 'Chaque employé se connecte à la caisse avec son identifiant et son code PIN.', loading: 'Chargement…',
    add: 'Ajouter un employé', showInactive: 'Afficher les comptes désactivés',
    roles: { cashier: 'Caissier', manager: 'Gérant', owner: 'Propriétaire' },
    roleHelp: { cashier: 'Encaisse les ventes.', manager: 'Encaisse et valide avec son code les opérations protégées (retours, dépassements de stock).', owner: 'Accès complet à la caisse.' },
    inactive: 'Désactivé', loginId: 'Identifiant', phone: 'Téléphone', sales: 'Ventes', tickets: 'Tickets', lastLogin: 'Dernière connexion', never: 'Jamais',
    edit: 'Modifier', editLabel: (n) => `Modifier ${n}`, pin: 'Code PIN', pinLabel: (n) => `Changer le code PIN de ${n}`,
    deactivate: 'Désactiver', deactivateLabel: (n) => `Désactiver ${n}`, reactivate: 'Réactiver', reactivateLabel: (n) => `Réactiver ${n}`,
    empty: 'Aucun employé pour l’instant.', emptyHint: 'Ajoutez un premier employé pour activer la connexion par code PIN sur vos caisses.',
    loadError: 'Impossible de charger les employés.', retry: 'Réessayer', close: 'Fermer', cancel: 'Annuler',
    form: { add: 'Nouvel employé', edit: 'Modifier l’employé', name: 'Nom complet', namePh: 'Ex. : Fatima Zahra', loginId: 'Identifiant de connexion', loginHint: 'Saisi sur l’écran PIN de la caisse. Lettres minuscules et chiffres.', phone: 'Téléphone', optional: 'facultatif', role: 'Rôle', pin: 'Code PIN', pinConfirm: 'Confirmer le code PIN', pinHint: '4 à 6 chiffres', create: 'Ajouter l’employé', save: 'Enregistrer' },
    pinForm: { title: 'Changer le code PIN', newPin: 'Nouveau code PIN', confirm: 'Confirmer le code PIN', save: 'Enregistrer le code' },
    off: { title: (n) => `Désactiver ${n} ?`, body: 'Cet employé ne pourra plus se connecter à la caisse. Son historique de ventes est conservé et vous pourrez le réactiver à tout moment.', confirm: 'Désactiver' },
    toast: { added: 'Employé ajouté', saved: 'Employé enregistré', pin: (n) => `Code PIN de ${n} mis à jour`, deactivated: 'Employé désactivé', reactivated: 'Employé réactivé' },
    err: {
      name_required: 'Le nom est obligatoire.', loginId_required: 'L’identifiant est obligatoire.', loginId_format: 'L’identifiant ne peut contenir que des lettres minuscules et des chiffres.',
      loginId_already_exists: 'Cet identifiant est déjà utilisé.', pin_required: 'Le code PIN est obligatoire.', pin_must_be_4_to_6_digits: 'Le code PIN doit comporter 4 à 6 chiffres.',
      pin_mismatch: 'Les deux codes PIN ne correspondent pas.', invalid_role: 'Rôle non valide.', not_found: 'Employé introuvable.', offline: 'Vous êtes hors ligne.',
    },
    errGeneric: 'L’opération a échoué. Réessayez.',
  },
  ar: {
    count: (n) => (n === 1 ? 'موظف واحد' : n === 2 ? 'موظفان' : n <= 10 ? `${n} موظفين` : `${n} موظفاً`), intro: 'يدخل كل موظف إلى الصندوق بمعرّفه ورمز PIN الخاص به.', loading: 'جارٍ التحميل…',
    add: 'إضافة موظف', showInactive: 'إظهار الحسابات المعطّلة',
    roles: { cashier: 'كاشير', manager: 'مدير', owner: 'مالك' },
    roleHelp: { cashier: 'يسجّل المبيعات.', manager: 'يسجّل المبيعات ويوافق برمزه على العمليات المحمية (المرتجعات، تجاوز المخزون).', owner: 'صلاحية كاملة على الصندوق.' },
    inactive: 'معطّل', loginId: 'المعرّف', phone: 'الهاتف', sales: 'المبيعات', tickets: 'الوصولات', lastLogin: 'آخر دخول', never: 'أبداً',
    edit: 'تعديل', editLabel: (n) => `تعديل ${n}`, pin: 'رمز PIN', pinLabel: (n) => `تغيير رمز PIN لـ ${n}`,
    deactivate: 'تعطيل', deactivateLabel: (n) => `تعطيل ${n}`, reactivate: 'إعادة التفعيل', reactivateLabel: (n) => `إعادة تفعيل ${n}`,
    empty: 'لا يوجد موظفون بعد.', emptyHint: 'أضف أول موظف لتفعيل الدخول برمز PIN على صناديقك.',
    loadError: 'تعذّر تحميل الموظفين.', retry: 'أعد المحاولة', close: 'إغلاق', cancel: 'إلغاء',
    form: { add: 'موظف جديد', edit: 'تعديل الموظف', name: 'الاسم الكامل', namePh: 'مثال: فاطمة الزهراء', loginId: 'معرّف الدخول', loginHint: 'يُكتب في شاشة PIN بالصندوق. أحرف لاتينية صغيرة وأرقام.', phone: 'الهاتف', optional: 'اختياري', role: 'الدور', pin: 'رمز PIN', pinConfirm: 'تأكيد رمز PIN', pinHint: 'من 4 إلى 6 أرقام', create: 'إضافة الموظف', save: 'حفظ' },
    pinForm: { title: 'تغيير رمز PIN', newPin: 'رمز PIN الجديد', confirm: 'تأكيد رمز PIN', save: 'حفظ الرمز' },
    off: { title: (n) => `تعطيل ${n}؟`, body: 'لن يتمكن هذا الموظف من الدخول إلى الصندوق. يبقى سجل مبيعاته محفوظاً ويمكنك إعادة تفعيله في أي وقت.', confirm: 'تعطيل' },
    toast: { added: 'تمت إضافة الموظف', saved: 'تم حفظ الموظف', pin: (n) => `تم تحديث رمز PIN لـ ${n}`, deactivated: 'تم تعطيل الموظف', reactivated: 'تمت إعادة تفعيل الموظف' },
    err: {
      name_required: 'الاسم مطلوب.', loginId_required: 'المعرّف مطلوب.', loginId_format: 'المعرّف يقبل الأحرف اللاتينية الصغيرة والأرقام فقط.',
      loginId_already_exists: 'هذا المعرّف مستخدم بالفعل.', pin_required: 'رمز PIN مطلوب.', pin_must_be_4_to_6_digits: 'يجب أن يتكون رمز PIN من 4 إلى 6 أرقام.',
      pin_mismatch: 'رمزا PIN غير متطابقين.', invalid_role: 'دور غير صالح.', not_found: 'الموظف غير موجود.', offline: 'أنت غير متصل.',
    },
    errGeneric: 'فشلت العملية. أعد المحاولة.',
  },
  en: {
    count: (n) => `${n} employee${n === 1 ? '' : 's'}`, intro: 'Each employee signs in to the register with their login ID and PIN.', loading: 'Loading…',
    add: 'Add an employee', showInactive: 'Show deactivated accounts',
    roles: { cashier: 'Cashier', manager: 'Manager', owner: 'Owner' },
    roleHelp: { cashier: 'Takes sales.', manager: 'Takes sales and approves protected operations with their PIN (returns, stock overrides).', owner: 'Full register access.' },
    inactive: 'Deactivated', loginId: 'Login ID', phone: 'Phone', sales: 'Sales', tickets: 'Receipts', lastLogin: 'Last sign-in', never: 'Never',
    edit: 'Edit', editLabel: (n) => `Edit ${n}`, pin: 'PIN', pinLabel: (n) => `Change ${n}’s PIN`,
    deactivate: 'Deactivate', deactivateLabel: (n) => `Deactivate ${n}`, reactivate: 'Reactivate', reactivateLabel: (n) => `Reactivate ${n}`,
    empty: 'No employees yet.', emptyHint: 'Add a first employee to turn on PIN sign-in on your registers.',
    loadError: 'Could not load the employees.', retry: 'Try again', close: 'Close', cancel: 'Cancel',
    form: { add: 'New employee', edit: 'Edit employee', name: 'Full name', namePh: 'e.g. Fatima Zahra', loginId: 'Login ID', loginHint: 'Typed on the register’s PIN screen. Lowercase letters and digits.', phone: 'Phone', optional: 'optional', role: 'Role', pin: 'PIN', pinConfirm: 'Confirm the PIN', pinHint: '4 to 6 digits', create: 'Add the employee', save: 'Save' },
    pinForm: { title: 'Change the PIN', newPin: 'New PIN', confirm: 'Confirm the PIN', save: 'Save the PIN' },
    off: { title: (n) => `Deactivate ${n}?`, body: 'This employee will no longer be able to sign in to the register. Their sales history is kept and you can reactivate them at any time.', confirm: 'Deactivate' },
    toast: { added: 'Employee added', saved: 'Employee saved', pin: (n) => `${n}’s PIN updated`, deactivated: 'Employee deactivated', reactivated: 'Employee reactivated' },
    err: {
      name_required: 'The name is required.', loginId_required: 'The login ID is required.', loginId_format: 'The login ID can only contain lowercase letters and digits.',
      loginId_already_exists: 'This login ID is already in use.', pin_required: 'The PIN is required.', pin_must_be_4_to_6_digits: 'The PIN must be 4 to 6 digits.',
      pin_mismatch: 'The two PINs do not match.', invalid_role: 'Invalid role.', not_found: 'Employee not found.', offline: 'You are offline.',
    },
    errGeneric: 'That did not work. Try again.',
  },
};

const errText = (c: Copy, code: string) => c.err[code] ?? c.errGeneric;

const ROLE_TONE: Record<Role, string> = {
  cashier: 'bg-[#EFF6FF] text-[#1E40AF] ring-[#BFDBFE]',
  manager: 'bg-[#FFFBEB] text-[#7A5600] ring-[#F0B429]/50',
  owner: 'bg-[#F5F3FF] text-[#5B21B6] ring-[#DDD6FE]',
};

function RoleBadge({ role, lang }: { role: Role; lang: Lang }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${ROLE_TONE[role]}`} data-role={role}>{COPY[lang].roles[role]}</span>;
}

/** PIN field: digits only, masked, never autofilled from a saved password */
function PinInput({ label, hint, value, onChange, testId, autoFocus }: { label: string; hint?: string; value: string; onChange: (v: string) => void; testId: string; autoFocus?: boolean }) {
  return (
    <label className="block"><span className={LABEL}>{label} *</span>
      <input
        type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} dir="ltr" value={value} autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))} placeholder="••••"
        className={`${FIELD} text-center font-mono text-xl tracking-[0.5em]`} data-testid={testId}
      />
      {hint && <span className="mt-1 block text-xs text-[#9CA3AF]">{hint}</span>}
    </label>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EmployeesPage() {
  const { lang } = useLang();
  const c = COPY[lang];
  const { toast } = usePortal();

  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [form, setForm] = useState<Employee | 'new' | null>(null);
  const [pinFor, setPinFor] = useState<Employee | null>(null);
  const [offFor, setOffFor] = useState<Employee | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(() => {
    const mine = ++seq.current;
    setLoading(true);
    void portalJson<{ employees: Employee[] }>(`/api/portal/employees${showInactive ? '?includeInactive=true' : ''}`).then((r) => {
      if (mine !== seq.current) return;
      setLoadError(!r.ok);
      if (r.ok) setEmployees(r.data.employees ?? []);
      setLoading(false);
    });
  }, [showInactive]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load]);

  const setActive = async (e: Employee, active: boolean) => {
    if (busy) return;
    setBusy(e.id);
    const r = active
      ? await portalJson(`/api/portal/employees/${e.id}`, { method: 'PATCH', json: { isActive: true } })
      : await portalJson(`/api/portal/employees/${e.id}`, { method: 'DELETE' }); // soft delete: isActive=false, history kept
    setBusy(null);
    if (!r.ok) { toast('error', errText(c, r.error)); return; }
    setOffFor(null);
    toast('success', active ? c.toast.reactivated : c.toast.deactivated);
    load();
  };

  const list = employees ?? [];
  const activeCount = list.filter((e) => e.isActive).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#6B7280]" data-testid="employees-count">{employees === null ? c.loading : activeCount > 0 ? c.count(activeCount) : c.intro}</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-sm text-[#374151]">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="h-4 w-4 accent-[#0F3D2A]" data-testid="employees-show-inactive" />
            {c.showInactive}
          </label>
          <button type="button" onClick={() => setForm('new')} className={BTN.primary} data-testid="employee-add">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            {c.add}
          </button>
        </div>
      </div>

      <section aria-busy={loading} data-testid="employees-list">
        {employees === null && loading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-[#F3F4F6]" />)}</div>
        ) : loadError ? (
          <div className={`${CARD} flex flex-col items-center gap-3 px-5 py-12 text-center`}>
            <p className="text-sm text-[#B91C1C]">{c.loadError}</p>
            <button type="button" onClick={load} className={BTN.secondary}>{c.retry}</button>
          </div>
        ) : list.length === 0 ? (
          <div className={`${CARD} flex flex-col items-center gap-4 px-5 py-14 text-center`} data-testid="employees-empty">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F0FDF6] text-[#0F3D2A] ring-1 ring-[#D1FAE5]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 19v-1a5 5 0 0 1 10 0v1M16 11l2 2 4-4" /></svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-[#111827]">{c.empty}</p>
              <p className="mt-1 max-w-sm text-sm text-[#6B7280]">{c.emptyHint}</p>
            </div>
            <button type="button" onClick={() => setForm('new')} className={BTN.primary}>{c.add}</button>
          </div>
        ) : (
          <ul className={`grid gap-4 sm:grid-cols-2 xl:grid-cols-3 ${loading ? 'opacity-60' : ''}`}>
            {list.map((e) => (
              <li key={e.id} data-employee={e.loginId} className={`${CARD} flex flex-col p-5 ${e.isActive ? '' : 'bg-[#FAFAFB]'}`}>
                <div className="flex items-center gap-3">
                  <span aria-hidden="true" className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold ${e.isActive ? 'bg-[#0F3D2A] text-[#F0B429]' : 'bg-[#E5E7EB] text-[#6B7280]'}`}>{initials(e.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate font-semibold ${e.isActive ? 'text-[#111827]' : 'text-[#6B7280]'}`}>{e.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <RoleBadge role={e.role} lang={lang} />
                      {!e.isActive && <span className="inline-flex rounded-full bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-semibold text-[#991B1B] ring-1 ring-[#FECACA]" data-testid="employee-inactive">{c.inactive}</span>}
                    </div>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-[#F9FAFB] px-3 py-2"><dt className="text-xs text-[#6B7280]">{c.sales}</dt><dd className="mt-0.5 text-sm font-bold tabular-nums text-[#111827]">{money(e.totalSales, lang)}</dd></div>
                  <div className="rounded-xl bg-[#F9FAFB] px-3 py-2"><dt className="text-xs text-[#6B7280]">{c.tickets}</dt><dd className="mt-0.5 text-sm font-bold tabular-nums text-[#111827]">{int(e.txCount, lang)}</dd></div>
                </dl>

                <dl className="mt-3 space-y-1.5 text-sm">
                  <div className="flex items-center justify-between gap-3"><dt className="text-[#6B7280]">{c.loginId}</dt><dd className="font-mono text-[13px] text-[#111827]" dir="ltr">{e.loginId}</dd></div>
                  {e.phone && <div className="flex items-center justify-between gap-3"><dt className="text-[#6B7280]">{c.phone}</dt><dd className="font-mono text-[13px] text-[#374151]" dir="ltr">{e.phone}</dd></div>}
                  <div className="flex items-center justify-between gap-3"><dt className="text-[#6B7280]">{c.lastLogin}</dt><dd className="text-[#374151]">{e.lastLoginAt ? ago(e.lastLoginAt, lang) : c.never}</dd></div>
                </dl>

                <div className="mt-auto flex flex-wrap gap-2 border-t border-[#F3F4F6] pt-4 [&>*]:mt-0">
                  {e.isActive ? (
                    <>
                      <button type="button" onClick={() => setForm(e)} aria-label={c.editLabel(e.name)} className={`${BTN.secondary} min-h-[36px] flex-1 px-3 text-xs`} data-testid="employee-edit">{c.edit}</button>
                      <button type="button" onClick={() => setPinFor(e)} aria-label={c.pinLabel(e.name)} className={`${BTN.secondary} min-h-[36px] flex-1 px-3 text-xs`} data-testid="employee-pin">{c.pin}</button>
                      <button type="button" onClick={() => setOffFor(e)} aria-label={c.deactivateLabel(e.name)} className={`${BTN.secondary} min-h-[36px] flex-1 px-3 text-xs text-[#B91C1C]`} data-testid="employee-deactivate">{c.deactivate}</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => void setActive(e, true)} aria-disabled={busy === e.id} aria-label={c.reactivateLabel(e.name)} className={`${BTN.secondary} min-h-[36px] flex-1 px-3 text-xs`} data-testid="employee-reactivate">{c.reactivate}</button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <EmployeeForm
        key={form === null ? 'form-closed' : form === 'new' ? 'form-new' : `form-${form.id}`} employee={form} lang={lang}
        onClose={() => setForm(null)} onSaved={(added) => { setForm(null); toast('success', added ? c.toast.added : c.toast.saved); load(); }}
      />
      <PinDialog
        key={`pin-${pinFor?.id ?? 'none'}`} employee={pinFor} lang={lang}
        onClose={() => setPinFor(null)} onSaved={(e) => { setPinFor(null); toast('success', c.toast.pin(e.name)); }}
      />
      {offFor && (
        <PortalDialog
          open onClose={() => setOffFor(null)} title={c.off.title(offFor.name)} size="sm" closeLabel={c.close} testId="employee-off"
          footer={<>
            <button type="button" onClick={() => setOffFor(null)} className={BTN.secondary}>{c.cancel}</button>
            <button type="button" onClick={() => void setActive(offFor, false)} aria-disabled={busy === offFor.id} className={BTN.danger} data-testid="employee-off-confirm">{c.off.confirm}</button>
          </>}
        >
          <p className="text-sm leading-relaxed text-[#374151]">{c.off.body}</p>
        </PortalDialog>
      )}
    </div>
  );
}

// ─── Add / edit ───────────────────────────────────────────────────────────────
function EmployeeForm({ employee, lang, onClose, onSaved }: { employee: Employee | 'new' | null; lang: Lang; onClose: () => void; onSaved: (added: boolean) => void }) {
  const c = COPY[lang];
  const f = c.form;
  const editing = employee && employee !== 'new' ? employee : null;
  const [name, setName] = useState(editing?.name ?? '');
  const [loginId, setLoginId] = useState(editing?.loginId ?? '');
  const [loginTouched, setLoginTouched] = useState(false);
  const [phone, setPhone] = useState(editing?.phone ?? '');
  const [role, setRole] = useState<Role>(editing?.role ?? 'cashier');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (!employee) return null;

  const onName = (v: string) => {
    setName(v);
    if (!editing && !loginTouched) setLoginId(suggestLogin(v));
  };

  const save = async () => {
    if (saving) return;
    if (!name.trim()) return setError(c.err.name_required);
    if (!editing) {
      if (!loginId.trim()) return setError(c.err.loginId_required);
      if (!/^[a-z0-9]+$/.test(loginId.trim())) return setError(c.err.loginId_format);
      if (!PIN_RE.test(pin)) return setError(c.err.pin_must_be_4_to_6_digits);
      if (pin !== pin2) return setError(c.err.pin_mismatch);
    }
    setSaving(true); setError('');
    const r = editing
      ? await portalJson(`/api/portal/employees/${editing.id}`, { method: 'PATCH', json: { name: name.trim(), phone: phone.trim(), role } })
      : await portalJson('/api/portal/employees', { method: 'POST', json: { name: name.trim(), loginId: loginId.trim(), phone: phone.trim() || undefined, role, pin } });
    setSaving(false);
    if (r.ok) onSaved(!editing); else setError(errText(c, r.error));
  };

  return (
    <PortalDialog
      open onClose={onClose} title={editing ? f.edit : f.add} description={editing ? <span className="font-mono" dir="ltr">{editing.loginId}</span> : undefined} closeLabel={c.close} testId="employee-form"
      footer={<>
        <button type="button" onClick={onClose} className={BTN.secondary}>{c.cancel}</button>
        <button type="button" onClick={() => void save()} aria-disabled={saving} className={BTN.primary} data-testid="employee-save">{saving ? '…' : editing ? f.save : f.create}</button>
      </>}
    >
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-4 sm:grid-cols-2" noValidate>
        <label className="sm:col-span-2"><span className={LABEL}>{f.name} *</span>
          <input value={name} onChange={(e) => onName(e.target.value)} placeholder={f.namePh} className={FIELD} autoFocus data-testid="e-name" />
        </label>
        {!editing && (
          <label className="sm:col-span-2"><span className={LABEL}>{f.loginId} *</span>
            <input
              value={loginId} onChange={(e) => { setLoginTouched(true); setLoginId(e.target.value.toLowerCase().replace(/\s/g, '')); }}
              placeholder="fatima01" dir="ltr" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={`${FIELD} font-mono`} data-testid="e-login"
            />
            <span className="mt-1 block text-xs text-[#9CA3AF]">{f.loginHint}</span>
          </label>
        )}
        <label><span className={LABEL}>{f.phone} <span className="font-normal text-[#9CA3AF]">({f.optional})</span></span>
          <input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06 12 34 56 78" dir="ltr" className={`${FIELD} text-end`} data-testid="e-phone" />
        </label>
        <label><span className={LABEL}>{f.role} *</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={FIELD} data-testid="e-role">
            {ROLES.map((r) => <option key={r} value={r}>{c.roles[r]}</option>)}
          </select>
          <span className="mt-1 block text-xs text-[#9CA3AF]" data-testid="e-role-help">{c.roleHelp[role]}</span>
        </label>
        {!editing && (
          <>
            <PinInput label={f.pin} hint={f.pinHint} value={pin} onChange={setPin} testId="e-pin" />
            <PinInput label={f.pinConfirm} value={pin2} onChange={setPin2} testId="e-pin2" />
          </>
        )}
        {error && <p role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#B91C1C] sm:col-span-2" data-testid="employee-error">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </PortalDialog>
  );
}

// ─── PIN ──────────────────────────────────────────────────────────────────────
function PinDialog({ employee, lang, onClose, onSaved }: { employee: Employee | null; lang: Lang; onClose: () => void; onSaved: (e: Employee) => void }) {
  const c = COPY[lang];
  const p = c.pinForm;
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (!employee) return null;

  const save = async () => {
    if (saving) return;
    if (!PIN_RE.test(pin)) return setError(c.err.pin_must_be_4_to_6_digits);
    if (pin !== pin2) return setError(c.err.pin_mismatch);
    setSaving(true); setError('');
    const r = await portalJson(`/api/portal/employees/${employee.id}`, { method: 'PATCH', json: { pin } });
    setSaving(false);
    if (r.ok) onSaved(employee); else setError(errText(c, r.error));
  };

  return (
    <PortalDialog
      open onClose={onClose} title={p.title} description={employee.name} size="sm" closeLabel={c.close} testId="employee-pin-dialog"
      footer={<>
        <button type="button" onClick={onClose} className={BTN.secondary}>{c.cancel}</button>
        <button type="button" onClick={() => void save()} aria-disabled={saving} className={BTN.primary} data-testid="pin-save">{saving ? '…' : p.save}</button>
      </>}
    >
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="space-y-4" noValidate>
        <PinInput label={p.newPin} hint={c.form.pinHint} value={pin} onChange={setPin} testId="pin-new" autoFocus />
        <PinInput label={p.confirm} value={pin2} onChange={setPin2} testId="pin-confirm" />
        {error && <p role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#B91C1C]" data-testid="pin-error">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </PortalDialog>
  );
}
