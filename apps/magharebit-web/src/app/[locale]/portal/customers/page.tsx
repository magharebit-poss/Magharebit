'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLang, type Lang } from '@/components/landing/useLang';
import { usePortal } from '@/components/portal/shell/PortalProvider';
import { portalJson } from '@/components/portal/shell/portalFetch';
import PortalDialog, { BTN, CARD, FIELD, LABEL } from '@/components/portal/PortalDialog';
import { int, longDate, money } from '@/components/portal/format';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Customer {
  id: string; name: string; phone: string; email?: string; totalSpent: number; visitCount: number;
  loyaltyPoints: number; lastVisitAt?: string; notes?: string; isActive: boolean;
}
interface TxRow { id: string; receiptNo: string; total: number; paymentMethod: string; createdAt: string; items: { name: string; qty: number }[] }
type Tier = 'bronze' | 'silver' | 'gold';

const LIMIT = 20;
const SILVER = 500;
const GOLD = 2000;

function tierOf(pts: number): Tier { return pts >= GOLD ? 'gold' : pts >= SILVER ? 'silver' : 'bronze'; }

/** 06 12 34 56 78 / +212 6 12 34 56 78 — display only, the stored value is unchanged */
function phoneOut(d: string): string {
  if (d.length === 12 && d.startsWith('212')) return `+212 ${d[3]} ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  if (d.length === 10 && d.startsWith('0')) return `${d.slice(0, 2)} ${d.slice(2, 4)} ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
  return d;
}

// ─── Copy ─────────────────────────────────────────────────────────────────────
const COPY: Record<Lang, {
  count: (n: number) => string; intro: string; loading: string; add: string; search: string;
  cols: { customer: string; phone: string; tier: string; points: string; spent: string; last: string };
  view: (n: string) => string; viewShort: string; empty: string; noMatch: string; clear: string;
  prev: string; next: string; page: (p: number, t: number) => string; close: string; cancel: string; never: string;
  tiers: Record<Tier, string>; toGold: (n: string) => string; toSilver: (n: string) => string; top: string;
  form: { title: string; name: string; namePh: string; phone: string; email: string; notes: string; notesPh: string; optional: string; save: string; saving: string };
  detail: { spent: string; visits: string; basket: string; points: string; lastVisit: string; notes: string; notesPh: string; saveNotes: string; savedNotes: string; history: string; historyEmpty: string; receipt: string; items: string; method: string; amount: string; date: string };
  methods: Record<string, string>;
  toast: { added: string };
  err: Record<string, string>; errGeneric: string; loadError: string;
}> = {
  fr: {
    count: (n) => `${n} client${n > 1 ? 's' : ''} enregistré${n > 1 ? 's' : ''}`, intro: 'Enregistrez vos clients et suivez leur fidélité.', loading: 'Chargement…',
    add: 'Ajouter un client', search: 'Rechercher par nom ou téléphone…',
    cols: { customer: 'Client', phone: 'Téléphone', tier: 'Niveau', points: 'Points', spent: 'Total dépensé', last: 'Dernière visite' },
    view: (n) => `Voir la fiche de ${n}`, viewShort: 'Voir', empty: 'Aucun client pour l’instant. Ajoutez votre premier client.', noMatch: 'Aucun client ne correspond à cette recherche.', clear: 'Effacer la recherche',
    prev: 'Précédent', next: 'Suivant', page: (p, t) => `Page ${p} sur ${t}`, close: 'Fermer', cancel: 'Annuler', never: 'Jamais',
    tiers: { bronze: 'Bronze', silver: 'Argent', gold: 'Or' }, toGold: (n) => `Encore ${n} points pour le niveau Or`, toSilver: (n) => `Encore ${n} points pour le niveau Argent`, top: 'Niveau le plus élevé',
    form: { title: 'Nouveau client', name: 'Nom', namePh: 'Ex. : Mohamed Alaoui', phone: 'Téléphone', email: 'E-mail', notes: 'Notes', notesPh: 'Ex. : client fidèle, sans gluten…', optional: 'facultatif', save: 'Ajouter', saving: 'Ajout…' },
    detail: { spent: 'Total dépensé', visits: 'Visites', basket: 'Panier moyen', points: 'Points fidélité', lastVisit: 'Dernière visite', notes: 'Notes', notesPh: 'Notes sur ce client…', saveNotes: 'Enregistrer les notes', savedNotes: 'Notes enregistrées', history: 'Historique d’achats', historyEmpty: 'Aucun achat enregistré pour ce client.', receipt: 'Ticket', items: 'Articles', method: 'Paiement', amount: 'Montant', date: 'Date' },
    methods: { cash: 'Espèces', card: 'Carte', mobile_money: 'Mobile', mixed: 'Mixte', qr: 'QR' },
    toast: { added: 'Client ajouté' },
    err: { name_required: 'Le nom est obligatoire.', phone_required: 'Le téléphone est obligatoire.', phone_too_short: 'Ce numéro de téléphone est trop court.', phone_already_exists: 'Ce numéro est déjà enregistré pour un autre client.', email_invalid: 'L’adresse e-mail n’est pas valide.', not_found: 'Client introuvable.', offline: 'Vous êtes hors ligne.' },
    errGeneric: 'L’opération a échoué. Réessayez.', loadError: 'Impossible de charger les clients. Réessayez.',
  },
  ar: {
    count: (n) => `${n} ${n === 1 ? 'زبون مسجل' : n === 2 ? 'زبونان مسجلان' : n <= 10 ? 'زبائن مسجلين' : 'زبوناً مسجلاً'}`, intro: 'سجّل زبائنك وتابع ولاءهم.', loading: 'جارٍ التحميل…',
    add: 'إضافة زبون', search: 'ابحث بالاسم أو رقم الهاتف…',
    cols: { customer: 'الزبون', phone: 'الهاتف', tier: 'المستوى', points: 'النقاط', spent: 'مجموع الإنفاق', last: 'آخر زيارة' },
    view: (n) => `عرض ملف ${n}`, viewShort: 'عرض', empty: 'لا يوجد زبائن بعد. أضف أول زبون.', noMatch: 'لا يوجد زبون مطابق لهذا البحث.', clear: 'مسح البحث',
    prev: 'السابق', next: 'التالي', page: (p, t) => `الصفحة ${p} من ${t}`, close: 'إغلاق', cancel: 'إلغاء', never: 'أبداً',
    tiers: { bronze: 'برونزي', silver: 'فضي', gold: 'ذهبي' }, toGold: (n) => `${n} نقطة متبقية للمستوى الذهبي`, toSilver: (n) => `${n} نقطة متبقية للمستوى الفضي`, top: 'أعلى مستوى',
    form: { title: 'زبون جديد', name: 'الاسم', namePh: 'مثال: محمد العلوي', phone: 'الهاتف', email: 'البريد الإلكتروني', notes: 'ملاحظات', notesPh: 'مثال: زبون وفي، بدون غلوتين…', optional: 'اختياري', save: 'إضافة', saving: 'جارٍ الإضافة…' },
    detail: { spent: 'مجموع الإنفاق', visits: 'الزيارات', basket: 'متوسط السلة', points: 'نقاط الولاء', lastVisit: 'آخر زيارة', notes: 'ملاحظات', notesPh: 'ملاحظات حول هذا الزبون…', saveNotes: 'حفظ الملاحظات', savedNotes: 'تم حفظ الملاحظات', history: 'سجل المشتريات', historyEmpty: 'لا توجد مشتريات مسجلة لهذا الزبون.', receipt: 'الوصل', items: 'المنتجات', method: 'الدفع', amount: 'المبلغ', date: 'التاريخ' },
    methods: { cash: 'نقداً', card: 'بطاقة', mobile_money: 'موبايل', mixed: 'مختلط', qr: 'QR' },
    toast: { added: 'تمت إضافة الزبون' },
    err: { name_required: 'الاسم مطلوب.', phone_required: 'رقم الهاتف مطلوب.', phone_too_short: 'رقم الهاتف قصير جداً.', phone_already_exists: 'هذا الرقم مسجل لزبون آخر.', email_invalid: 'البريد الإلكتروني غير صحيح.', not_found: 'الزبون غير موجود.', offline: 'أنت غير متصل.' },
    errGeneric: 'فشلت العملية. أعد المحاولة.', loadError: 'تعذّر تحميل الزبائن. أعد المحاولة.',
  },
  en: {
    count: (n) => `${n} customer${n === 1 ? '' : 's'} registered`, intro: 'Register your customers and follow their loyalty.', loading: 'Loading…',
    add: 'Add a customer', search: 'Search by name or phone…',
    cols: { customer: 'Customer', phone: 'Phone', tier: 'Tier', points: 'Points', spent: 'Total spent', last: 'Last visit' },
    view: (n) => `Open ${n}’s profile`, viewShort: 'View', empty: 'No customers yet. Add your first customer.', noMatch: 'No customer matches this search.', clear: 'Clear the search',
    prev: 'Previous', next: 'Next', page: (p, t) => `Page ${p} of ${t}`, close: 'Close', cancel: 'Cancel', never: 'Never',
    tiers: { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' }, toGold: (n) => `${n} more points to Gold`, toSilver: (n) => `${n} more points to Silver`, top: 'Highest tier',
    form: { title: 'New customer', name: 'Name', namePh: 'e.g. Mohamed Alaoui', phone: 'Phone', email: 'Email', notes: 'Notes', notesPh: 'e.g. regular, gluten-free…', optional: 'optional', save: 'Add', saving: 'Adding…' },
    detail: { spent: 'Total spent', visits: 'Visits', basket: 'Average basket', points: 'Loyalty points', lastVisit: 'Last visit', notes: 'Notes', notesPh: 'Notes about this customer…', saveNotes: 'Save notes', savedNotes: 'Notes saved', history: 'Purchase history', historyEmpty: 'No purchases recorded for this customer.', receipt: 'Receipt', items: 'Items', method: 'Payment', amount: 'Amount', date: 'Date' },
    methods: { cash: 'Cash', card: 'Card', mobile_money: 'Mobile', mixed: 'Mixed', qr: 'QR' },
    toast: { added: 'Customer added' },
    err: { name_required: 'The name is required.', phone_required: 'The phone number is required.', phone_too_short: 'This phone number is too short.', phone_already_exists: 'This number is already registered for another customer.', email_invalid: 'The email address is not valid.', not_found: 'Customer not found.', offline: 'You are offline.' },
    errGeneric: 'That did not work. Try again.', loadError: 'Could not load the customers. Try again.',
  },
};

const TIER_TONE: Record<Tier, { badge: string; bar: string; panel: string }> = {
  gold: { badge: 'bg-[#FFF8E1] text-[#7A5600] ring-[#F0B429]/50', bar: 'bg-[#F0B429]', panel: 'border-[#F0B429]/40 bg-[#FFFBEB] text-[#7A5600]' },
  silver: { badge: 'bg-[#F1F5F9] text-[#334155] ring-[#CBD5E1]', bar: 'bg-[#64748B]', panel: 'border-[#CBD5E1] bg-[#F8FAFC] text-[#334155]' },
  bronze: { badge: 'bg-[#FDF2E9] text-[#8A4B1C] ring-[#E8C4A4]', bar: 'bg-[#B5651D]', panel: 'border-[#E8C4A4] bg-[#FDF8F3] text-[#8A4B1C]' },
};

function TierBadge({ points, lang }: { points: number; lang: Lang }) {
  const t = tierOf(points);
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${TIER_TONE[t].badge}`} data-tier={t}>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" /></svg>
      {COPY[lang].tiers[t]}
    </span>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-[#F0FDF6] font-bold text-[#0F3D2A] ring-1 ring-[#D1FAE5] ${size === 'lg' ? 'h-14 w-14 text-xl' : 'h-9 w-9 text-sm'}`}>
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function CustomersPage() {
  const { lang } = useLang();
  const c = COPY[lang];
  const { toast } = usePortal();

  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [selected, setSelected] = useState<Customer | null>(null);

  const load = useCallback(() => {
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search.trim()) q.set('search', search.trim());
    setLoading(true);
    void portalJson<{ customers: Customer[]; total: number }>(`/api/portal/customers?${q}`).then((r) => {
      setLoadError(!r.ok);
      if (r.ok) { setCustomers(r.data.customers ?? []); setTotal(r.data.total ?? 0); }
      setLoading(false);
    });
  }, [page, search]);

  // One fetch path: debounced on every filter change (the old page fetched twice per keystroke)
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const list = customers ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#6B7280]" data-testid="customers-count">{customers === null ? c.loading : total > 0 ? c.count(total) : c.intro}</p>
        <button type="button" onClick={() => setAddOpen(true)} className={BTN.primary} data-testid="customer-add">
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          {c.add}
        </button>
      </div>

      <div className={`${CARD} p-3`}>
        <label className="relative block max-w-md">
          <span className="sr-only">{c.search}</span>
          <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-[#9CA3AF]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" /></svg>
          </span>
          <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={c.search} className={`${FIELD} ps-9`} data-testid="customers-search" />
        </label>
      </div>

      <section className={`${CARD} overflow-hidden`} aria-busy={loading} data-testid="customers-list">
        {customers === null && loading ? (
          <div className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-[#F3F4F6]" />)}</div>
        ) : loadError ? (
          <p className="px-5 py-12 text-center text-sm text-[#B91C1C]">{c.loadError}</p>
        ) : list.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-5 py-14 text-center" data-testid="customers-empty">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F0FDF6] text-[#0F3D2A] ring-1 ring-[#D1FAE5]">
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a3 3 0 0 0-2-2.8M17 5.2a3 3 0 0 1 0 5.6" /></svg>
            </span>
            <p className="text-sm text-[#6B7280]">{search ? c.noMatch : c.empty}</p>
            {search
              ? <button type="button" onClick={() => { setSearch(''); setPage(1); }} className={BTN.secondary}>{c.clear}</button>
              : <button type="button" onClick={() => setAddOpen(true)} className={BTN.primary}>{c.add}</button>}
          </div>
        ) : (
          <>
            <div className={`hidden overflow-x-auto md:block ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full text-sm">
                <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#6B7280]">
                  <tr>
                    {[c.cols.customer, c.cols.phone, c.cols.tier].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-5 py-3 text-start">{h}</th>)}
                    <th scope="col" className="whitespace-nowrap px-5 py-3 text-end">{c.cols.points}</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-3 text-end">{c.cols.spent}</th>
                    <th scope="col" className="whitespace-nowrap px-5 py-3 text-start">{c.cols.last}</th>
                    <th scope="col" className="px-5 py-3"><span className="sr-only">{c.viewShort}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {list.map((cu) => (
                    <tr key={cu.id} data-customer={cu.name} className="cursor-pointer transition-colors hover:bg-[#FAFAFB]" onClick={() => setSelected(cu)}>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={cu.name} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[#111827]">{cu.name}</p>
                            {cu.email && <p className="truncate text-xs text-[#9CA3AF]" dir="ltr">{cu.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-[13px] text-[#374151]"><span dir="ltr">{phoneOut(cu.phone)}</span></td>
                      <td className="px-5 py-3"><TierBadge points={cu.loyaltyPoints} lang={lang} /></td>
                      <td className="whitespace-nowrap px-5 py-3 text-end font-semibold tabular-nums text-[#0F3D2A]">{int(cu.loyaltyPoints, lang)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-end font-semibold tabular-nums text-[#111827]">{money(cu.totalSpent, lang)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-[#6B7280]">{cu.lastVisitAt ? longDate(cu.lastVisitAt, lang) : c.never}</td>
                      <td className="px-5 py-3 text-end">
                        <button type="button" onClick={(e) => { e.stopPropagation(); setSelected(cu); }} aria-label={c.view(cu.name)} className={`${BTN.secondary} min-h-[34px] px-3 text-xs`}>{c.viewShort}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className={`divide-y divide-[#F3F4F6] md:hidden ${loading ? 'opacity-60' : ''}`}>
              {list.map((cu) => (
                <li key={cu.id}>
                  <button type="button" onClick={() => setSelected(cu)} aria-label={c.view(cu.name)} className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[#FAFAFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B]">
                    <Avatar name={cu.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#111827]">{cu.name}</span>
                      <span className="block text-xs text-[#6B7280]"><span dir="ltr">{phoneOut(cu.phone)}</span> · {money(cu.totalSpent, lang)}</span>
                    </span>
                    <TierBadge points={cu.loyaltyPoints} lang={lang} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {totalPages > 1 && list.length > 0 && (
        <nav className="flex items-center justify-center gap-2" aria-label={c.page(page, totalPages)}>
          <button type="button" onClick={() => setPage((x) => Math.max(1, x - 1))} disabled={page <= 1} className={BTN.secondary}>{c.prev}</button>
          <span className="px-2 text-sm tabular-nums text-[#6B7280]">{c.page(page, totalPages)}</span>
          <button type="button" onClick={() => setPage((x) => Math.min(totalPages, x + 1))} disabled={page >= totalPages} className={BTN.secondary}>{c.next}</button>
        </nav>
      )}

      <AddCustomerDialog
        key={addOpen ? 'add-open' : 'add-closed'} open={addOpen} lang={lang}
        onClose={() => setAddOpen(false)}
        onAdded={() => { setAddOpen(false); toast('success', c.toast.added); if (page !== 1) setPage(1); else load(); }}
      />
      <CustomerDialog
        key={`detail-${selected?.id ?? 'none'}`} customer={selected} lang={lang}
        onClose={() => setSelected(null)}
        onUpdated={(cu) => { setSelected(cu); setCustomers((cs) => cs?.map((x) => (x.id === cu.id ? cu : x)) ?? cs); }}
      />
    </div>
  );
}

// ─── Add ──────────────────────────────────────────────────────────────────────
function AddCustomerDialog({ open, lang, onClose, onAdded }: { open: boolean; lang: Lang; onClose: () => void; onAdded: () => void }) {
  const c = COPY[lang];
  const [f, setF] = useState({ name: '', phone: '', email: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = async () => {
    if (!f.name.trim()) return setError(c.err.name_required);
    if (saving) return;
    if (!f.phone.trim()) return setError(c.err.phone_required);
    setSaving(true); setError('');
    const r = await portalJson('/api/portal/customers', {
      method: 'POST',
      json: { name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() || undefined, notes: f.notes.trim() || undefined },
    });
    setSaving(false);
    if (r.ok) onAdded(); else setError(c.err[r.error] ?? c.errGeneric);
  };

  return (
    <PortalDialog
      open={open} onClose={onClose} title={c.form.title} closeLabel={c.close} testId="customer-form"
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN.secondary}>{c.cancel}</button>
          <button type="button" onClick={save} aria-disabled={saving} className={BTN.primary} data-testid="customer-save">{saving ? c.form.saving : c.form.save}</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-4 sm:grid-cols-2" noValidate>
        <label className="sm:col-span-2"><span className={LABEL}>{c.form.name} *</span><input value={f.name} onChange={set('name')} placeholder={c.form.namePh} className={FIELD} autoFocus data-testid="c-name" /></label>
        <label><span className={LABEL}>{c.form.phone} *</span><input type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="06 12 34 56 78" dir="ltr" className={`${FIELD} text-end`} data-testid="c-phone" /></label>
        <label><span className={LABEL}>{c.form.email} <span className="font-normal text-[#9CA3AF]">({c.form.optional})</span></span><input type="email" value={f.email} onChange={set('email')} placeholder="client@example.com" dir="ltr" className={`${FIELD} text-end`} data-testid="c-email" /></label>
        <label className="sm:col-span-2"><span className={LABEL}>{c.form.notes} <span className="font-normal text-[#9CA3AF]">({c.form.optional})</span></span><input value={f.notes} onChange={set('notes')} placeholder={c.form.notesPh} className={FIELD} /></label>
        {error && <p role="alert" className="sm:col-span-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#B91C1C]" data-testid="customer-error">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </PortalDialog>
  );
}

// ─── Detail ───────────────────────────────────────────────────────────────────
function CustomerDialog({ customer, lang, onClose, onUpdated }: { customer: Customer | null; lang: Lang; onClose: () => void; onUpdated: (c: Customer) => void }) {
  const c = COPY[lang];
  const [notes, setNotes] = useState(customer?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [txns, setTxns] = useState<TxRow[] | null>(null);

  useEffect(() => {
    if (!customer) return;
    let alive = true;
    void portalJson<{ transactions: TxRow[] }>(`/api/portal/customers/${customer.id}/transactions?limit=20`).then((r) => {
      if (alive) setTxns(r.ok ? r.data.transactions ?? [] : []);
    });
    return () => { alive = false; };
  }, [customer]);

  const saveNotes = async () => {
    if (!customer || saving) return;
    setSaving(true); setNoteError('');
    const r = await portalJson<{ customer: Customer }>(`/api/portal/customers/${customer.id}`, { method: 'PATCH', json: { notes } });
    setSaving(false);
    if (r.ok) {
      if (r.data.customer) onUpdated(r.data.customer);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else setNoteError(c.err[r.error] ?? c.errGeneric);
  };

  if (!customer) return <PortalDialog open={false} onClose={onClose} title="" closeLabel={c.close} />;

  const pts = customer.loyaltyPoints;
  const tier = tierOf(pts);
  const pct = tier === 'gold' ? 100 : tier === 'silver' ? Math.round(((pts - SILVER) / (GOLD - SILVER)) * 100) : Math.round((pts / SILVER) * 100);
  const progressText = tier === 'gold' ? c.top : tier === 'silver' ? c.toGold(int(GOLD - pts, lang)) : c.toSilver(int(SILVER - pts, lang));
  const basket = customer.visitCount > 0 ? customer.totalSpent / customer.visitCount : 0;

  return (
    <PortalDialog
      open onClose={onClose} title={customer.name} closeLabel={c.close} size="lg" testId="customer-detail"
      description={<span className="inline-flex flex-wrap items-center gap-x-2"><span dir="ltr">{phoneOut(customer.phone)}</span>{customer.email && <><span aria-hidden="true">·</span><span dir="ltr">{customer.email}</span></>}</span>}
    >
      <div className="space-y-5">
        <div className="flex items-center gap-4">
          <Avatar name={customer.name} size="lg" />
          <TierBadge points={pts} lang={lang} />
          <p className="ms-auto text-sm text-[#6B7280]">{c.detail.lastVisit} : <span className="font-semibold text-[#374151]">{customer.lastVisitAt ? longDate(customer.lastVisitAt, lang) : c.never}</span></p>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            [c.detail.spent, money(customer.totalSpent, lang)],
            [c.detail.visits, int(customer.visitCount, lang)],
            [c.detail.basket, money(Math.round(basket * 100) / 100, lang)],
            [c.detail.points, int(pts, lang)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border border-[#F1F2F4] bg-[#F9FAFB] p-3 text-center">
              <dt className="text-xs text-[#6B7280]">{k}</dt>
              <dd className="mt-0.5 truncate text-base font-bold tabular-nums text-[#111827]">{v}</dd>
            </div>
          ))}
        </dl>

        <div className={`rounded-lg border px-4 py-3 ${TIER_TONE[tier].panel}`}>
          <div className="mb-2 flex items-center justify-between gap-3 text-[13px]">
            <span className="font-semibold">{c.tiers[tier]}</span>
            <span>{progressText}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={progressText}>
            {/* data-driven width: the only inline style on this page */}
            <div data-dynamic className={`h-full rounded-full ${TIER_TONE[tier].bar}`} style={{ width: `${pct}%` }} />
          </div>
        </div>

        <div>
          <label htmlFor="customer-notes" className={LABEL}>{c.detail.notes}</label>
          <textarea id="customer-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder={c.detail.notesPh} className={`${FIELD} min-h-[64px] resize-y`} data-testid="customer-notes" />
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <button type="button" onClick={saveNotes} aria-disabled={saving} className={BTN.primary} data-testid="customer-notes-save">{saving ? '…' : c.detail.saveNotes}</button>
            {saved && <span role="status" className="text-sm font-medium text-[#166534]">{c.detail.savedNotes}</span>}
            {noteError && <span role="alert" className="text-sm text-[#B91C1C]">{noteError}</span>}
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-bold text-[#111827]">{c.detail.history}</h3>
          {txns === null ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-[#F3F4F6]" />)}</div>
          ) : txns.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[#E5E7EB] px-4 py-6 text-center text-sm text-[#6B7280]" data-testid="customer-history-empty">{c.detail.historyEmpty}</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[#E5E7EB]">
              <table className="w-full text-[13px]">
                <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#6B7280]">
                  <tr>{[c.detail.receipt, c.detail.items, c.detail.method].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-4 py-2.5 text-start">{h}</th>)}<th scope="col" className="px-4 py-2.5 text-end">{c.detail.amount}</th><th scope="col" className="px-4 py-2.5 text-start">{c.detail.date}</th></tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {txns.map((t) => (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[#6B7280]" dir="ltr">{t.receiptNo}</td>
                      <td className="max-w-[200px] truncate px-4 py-2.5 text-[#374151]">{t.items.slice(0, 2).map((i) => i.name).join(', ')}{t.items.length > 2 ? ` +${t.items.length - 2}` : ''}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">{c.methods[t.paymentMethod] ?? t.paymentMethod}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-end font-semibold tabular-nums text-[#0F3D2A]">{money(t.total, lang)}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-[#6B7280]">{longDate(t.createdAt, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </PortalDialog>
  );
}
