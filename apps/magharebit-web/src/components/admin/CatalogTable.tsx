'use client';

import { useEffect, useState } from 'react';
import { useAdmin } from './AdminShell';
import AdminDialog from './AdminDialog';
import AdminSwitch from './AdminSwitch';
import { BTN, BTN_PRIMARY, FIELD, type Lang } from './adminUi';

export type CatalogKind = 'shop-type' | 'cuisine' | 'banner';
interface Item { id: string; name: string; description: string; imageUrl: string; active: boolean }

const LIMIT = 25;

/** Wording per kind. `add` is the button label ("+ Add shop type"), `one` the singular used in messages. */
const KIND_COPY: Record<CatalogKind, Record<Lang, { title: string; subtitle: string; add: string; one: string; namePh: string; nameCol: string }>> = {
  'shop-type': {
    ar: { title: 'أنواع المتاجر', subtitle: 'تصنيفات الأنشطة التجارية التي يختارها التجار', add: 'إضافة نوع متجر', one: 'نوع المتجر', namePh: 'مثال: مخبزة', nameCol: 'الاسم' },
    fr: { title: 'Types de commerce', subtitle: 'Catégories d’activité proposées aux commerçants', add: 'Ajouter un type de commerce', one: 'type de commerce', namePh: 'ex. Boulangerie', nameCol: 'Nom' },
    en: { title: 'Shop types', subtitle: 'Business categories merchants choose from', add: 'Add shop type', one: 'shop type', namePh: 'e.g. Bakery', nameCol: 'Name' },
  },
  cuisine: {
    ar: { title: 'المطابخ', subtitle: 'أنواع المطابخ لمحلات الأكل والمطاعم', add: 'إضافة مطبخ', one: 'المطبخ', namePh: 'مثال: مغربي', nameCol: 'الاسم' },
    fr: { title: 'Cuisines', subtitle: 'Types de cuisine pour les commerces de restauration', add: 'Ajouter une cuisine', one: 'cuisine', namePh: 'ex. Marocaine', nameCol: 'Nom' },
    en: { title: 'Cuisines', subtitle: 'Cuisine types for food merchants', add: 'Add cuisine', one: 'cuisine', namePh: 'e.g. Moroccan', nameCol: 'Name' },
  },
  banner: {
    ar: { title: 'اللافتات', subtitle: 'لافتات إعلانية تظهر للتجار والزبائن', add: 'إضافة لافتة', one: 'اللافتة', namePh: 'مثال: عرض رمضان', nameCol: 'العنوان' },
    fr: { title: 'Bannières', subtitle: 'Bannières promotionnelles affichées aux commerçants et clients', add: 'Ajouter une bannière', one: 'bannière', namePh: 'ex. Offre Ramadan', nameCol: 'Titre' },
    en: { title: 'Banners', subtitle: 'Promotional banners shown to merchants and customers', add: 'Add banner', one: 'banner', namePh: 'e.g. Ramadan offer', nameCol: 'Title' },
  },
};

const COPY: Record<Lang, {
  search: string; apply: string; refresh: string; image: string; description: string; status: string; actions: string; edit: string; active: string; inactive: string;
  empty: string; loading: string; error: string; unavailable: string; total: string; prev: string; next: string; page: string; close: string;
  descLabel: string; imageLabel: string; imageHint: string; activeLabel: string; saveNew: string; saveEdit: string; saving: string; preview: string;
  invalidName: string; invalidImage: string; forbidden: string; failed: string; auditFail: string; readOnly: string; switchOn: (n: string) => string; switchOff: (n: string) => string; editTitle: string;
}> = {
  ar: {
    search: 'بحث بالاسم', apply: 'تطبيق', refresh: 'تحديث', image: 'الصورة', description: 'الوصف', status: 'الحالة', actions: 'إجراءات', edit: 'تعديل', active: 'نشط', inactive: 'متوقف',
    empty: 'لا توجد عناصر', loading: 'جارٍ التحميل…', error: 'تعذّر تحميل القائمة', unavailable: 'قاعدة البيانات غير متاحة', total: 'عنصر', prev: 'السابق', next: 'التالي', page: 'صفحة', close: 'إغلاق',
    descLabel: 'الوصف (اختياري)', imageLabel: 'رابط الصورة (اختياري)', imageHint: 'رابط https أو مسار يبدأ بـ /', activeLabel: 'نشط', saveNew: 'إضافة', saveEdit: 'حفظ التعديلات', saving: 'جارٍ الحفظ…', preview: 'معاينة',
    invalidName: 'الاسم من حرفين إلى 80 حرفاً', invalidImage: 'رابط الصورة غير صالح (https أو مسار يبدأ بـ /)', forbidden: 'ليست لديك صلاحية التعديل', failed: 'تعذّر الحفظ', auditFail: 'تحذير: لم يُسجَّل في سجل التدقيق',
    readOnly: 'حسابك للقراءة فقط', switchOn: (n) => `إيقاف ${n}`, switchOff: (n) => `تفعيل ${n}`, editTitle: 'تعديل',
  },
  fr: {
    search: 'Rechercher par nom', apply: 'Appliquer', refresh: 'Actualiser', image: 'Image', description: 'Description', status: 'Statut', actions: 'Actions', edit: 'Modifier', active: 'Actif', inactive: 'Inactif',
    empty: 'Aucun élément', loading: 'Chargement…', error: 'Impossible de charger la liste', unavailable: 'Base de données indisponible', total: 'éléments', prev: 'Précédent', next: 'Suivant', page: 'Page', close: 'Fermer',
    descLabel: 'Description (facultatif)', imageLabel: 'URL de l’image (facultatif)', imageHint: 'Lien https ou chemin commençant par /', activeLabel: 'Actif', saveNew: 'Ajouter', saveEdit: 'Enregistrer', saving: 'Enregistrement…', preview: 'Aperçu',
    invalidName: 'Le nom doit faire de 2 à 80 caractères', invalidImage: 'URL d’image invalide (https ou chemin commençant par /)', forbidden: 'Vous n’avez pas le droit de modifier', failed: 'Enregistrement impossible', auditFail: 'Attention : non inscrit au journal d’audit',
    readOnly: 'Votre compte est en lecture seule', switchOn: (n) => `Désactiver ${n}`, switchOff: (n) => `Activer ${n}`, editTitle: 'Modifier',
  },
  en: {
    search: 'Search by name', apply: 'Apply', refresh: 'Refresh', image: 'Image', description: 'Description', status: 'Status', actions: 'Actions', edit: 'Edit', active: 'Active', inactive: 'Inactive',
    empty: 'Nothing here yet', loading: 'Loading…', error: 'Could not load the list', unavailable: 'Database unavailable', total: 'items', prev: 'Previous', next: 'Next', page: 'Page', close: 'Close',
    descLabel: 'Description (optional)', imageLabel: 'Image URL (optional)', imageHint: 'An https link or a path starting with /', activeLabel: 'Active', saveNew: 'Add', saveEdit: 'Save changes', saving: 'Saving…', preview: 'Preview',
    invalidName: 'Name must be 2 to 80 characters', invalidImage: 'Invalid image URL (https or a path starting with /)', forbidden: 'You are not allowed to edit', failed: 'Could not save', auditFail: 'Warning: not recorded in the audit log',
    readOnly: 'Your account is read-only', switchOn: (n) => `Disable ${n}`, switchOff: (n) => `Enable ${n}`, editTitle: 'Edit',
  },
};

function Thumb({ item }: { item: { name: string; imageUrl: string } }) {
  const [failed, setFailed] = useState(false);
  const showImg = item.imageUrl && !failed;
  return (
    <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-head)] text-base font-extrabold text-[var(--adm-muted)]">
      {showImg
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={item.imageUrl} alt={item.name} width={48} height={48} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
        : <span aria-hidden="true">{item.name.trim().charAt(0).toUpperCase() || '?'}</span>}
    </span>
  );
}

export default function CatalogTable({ kind }: { kind: CatalogKind }) {
  const { lang, actor, isRTL } = useAdmin();
  const c = COPY[lang];
  const k = KIND_COPY[kind][lang];
  const canWrite = actor.role !== 'viewer';

  const [rows, setRows] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<'loading' | 'ok' | 'error' | 'unavailable'>('loading');
  const [notice, setNotice] = useState<string | null>(null);

  const [dialog, setDialog] = useState<null | { mode: 'add' } | { mode: 'edit'; item: Item }>(null);
  const [form, setForm] = useState({ name: '', description: '', imageUrl: '', active: true });
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const p = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (appliedQ) p.set('q', appliedQ);
    type Result = { state: 'ok'; items: Item[]; total: number } | { state: 'error' | 'unavailable' };
    fetch(`/api/admin/catalog/${kind}?${p}`)
      .then(async (r): Promise<Result> => {
        if (r.status === 503) return { state: 'unavailable' };
        if (!r.ok) return { state: 'error' };
        const d = (await r.json()) as { items: Item[]; total: number };
        return { state: 'ok', items: d.items, total: d.total };
      })
      .catch((): Result => ({ state: 'error' }))
      .then((res) => {
        if (cancelled) return;
        if (res.state === 'ok') { setRows(res.items); setTotal(res.total); }
        setState(res.state);
      });
    return () => { cancelled = true; };
  }, [kind, page, appliedQ, tick]);

  function reload(nextPage = page, nextQ = appliedQ) {
    setState('loading');
    setPage(nextPage);
    setAppliedQ(nextQ);
    setTick((t) => t + 1);
  }

  function openAdd() {
    setForm({ name: '', description: '', imageUrl: '', active: true });
    setFormError('');
    setDialog({ mode: 'add' });
  }
  function openEdit(item: Item) {
    setForm({ name: item.name, description: item.description, imageUrl: item.imageUrl, active: item.active });
    setFormError('');
    setDialog({ mode: 'edit', item });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2 || form.name.trim().length > 80) { setFormError(c.invalidName); return; }
    setBusy(true);
    setFormError('');
    try {
      const body = { name: form.name.trim(), description: form.description.trim(), imageUrl: form.imageUrl.trim(), active: form.active };
      const r = dialog?.mode === 'edit'
        ? await fetch(`/api/admin/catalog/${kind}/${dialog.item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        : await fetch(`/api/admin/catalog/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = (await r.json().catch(() => ({}))) as { auditRecorded?: boolean; error?: string };
      if (r.ok) {
        setDialog(null);
        setNotice(d.auditRecorded === false ? c.auditFail : null);
        reload(dialog?.mode === 'add' ? 1 : page, dialog?.mode === 'add' ? '' : appliedQ);
        if (dialog?.mode === 'add') setQ('');
      } else {
        setFormError(r.status === 403 ? c.forbidden : r.status === 422 ? (/image/i.test(d.error ?? '') ? c.invalidImage : c.invalidName) : c.failed);
      }
    } catch {
      setFormError(c.failed);
    } finally {
      setBusy(false);
    }
  }

  async function toggle(item: Item, next: boolean) {
    setNotice(null);
    setRows((cur) => cur.map((x) => (x.id === item.id ? { ...x, active: next } : x)));
    const r = await fetch(`/api/admin/catalog/${kind}/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: next }) }).catch(() => null);
    if (!r?.ok) {
      setRows((cur) => cur.map((x) => (x.id === item.id ? { ...x, active: !next } : x)));
      setNotice(r?.status === 403 ? c.forbidden : c.failed);
    }
  }

  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <section aria-labelledby={`${kind}-title`}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 id={`${kind}-title`} className="text-2xl font-bold text-[var(--adm-text)]">{k.title}</h1>
          <p className="text-sm text-[var(--adm-muted)]">{k.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => reload()} className={BTN}>{c.refresh}</button>
          {canWrite && <button type="button" onClick={openAdd} className={BTN_PRIMARY}>+ {k.add}</button>}
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); reload(1, q.trim()); }} className="mb-4 flex flex-wrap items-end gap-3 rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)] p-3">
        <label className="flex min-w-0 flex-1 basis-[220px] flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.search}
          <input className={`${FIELD} sm:w-full`} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <button type="submit" className={BTN_PRIMARY}>{c.apply}</button>
      </form>

      {!canWrite && <p className="mb-3 text-sm text-[var(--adm-muted)]">{c.readOnly}</p>}
      {notice && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{notice}</p>}
      {state === 'error' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.error}</p>}
      {state === 'unavailable' && <p role="alert" className="mb-3 text-sm text-[var(--adm-error)]">{c.unavailable}</p>}

      <div className="overflow-x-auto rounded-[8px] border border-[var(--adm-border)] bg-[var(--adm-surface)]">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <caption className="sr-only">{k.title}</caption>
          <thead>
            <tr className="bg-[var(--adm-head)] text-xs uppercase tracking-wide text-[var(--adm-muted)]">
              {[c.image, k.nameCol, c.description, c.status, c.actions].map((h) => <th key={h} scope="col" className="px-3 py-3 text-start font-semibold">{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {state === 'loading' && <tr><td colSpan={5} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.loading}</td></tr>}
            {state === 'ok' && rows.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-[var(--adm-muted)]">{c.empty}</td></tr>}
            {state === 'ok' && rows.map((it) => (
              <tr key={it.id} className="border-t border-[var(--adm-border)] align-middle">
                <td className="px-3 py-3"><Thumb item={it} /></td>
                <td className="px-3 py-3 font-semibold text-[var(--adm-text)]">{it.name}</td>
                <td className="max-w-[320px] px-3 py-3 text-[var(--adm-muted)]">{it.description || '—'}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <AdminSwitch checked={it.active} disabled={!canWrite} label={it.active ? c.switchOn(it.name) : c.switchOff(it.name)} onChange={(n) => void toggle(it, n)} />
                    <span className="text-xs font-semibold text-[var(--adm-text)]">{it.active ? c.active : c.inactive}</span>
                  </div>
                </td>
                <td className="px-3 py-3">{canWrite && <button type="button" onClick={() => openEdit(it)} className={BTN} aria-label={`${c.edit}: ${it.name}`}>{c.edit}</button>}</td>
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
        <AdminDialog title={dialog.mode === 'add' ? `+ ${k.add}` : `${c.editTitle}: ${dialog.item.name}`} closeLabel={c.close} onClose={() => setDialog(null)}>
          <form onSubmit={(e) => void submit(e)} noValidate className="grid gap-4">
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{k.nameCol}
              <input autoFocus className={`${FIELD} sm:w-full`} value={form.name} maxLength={80} placeholder={k.namePh} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.descLabel}
              <textarea rows={3} maxLength={300} className={`${FIELD} min-h-[88px] py-2 sm:w-full`} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div>
              <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--adm-muted)]">{c.imageLabel}
                <input dir="ltr" className={`${FIELD} sm:w-full`} value={form.imageUrl} maxLength={500} placeholder="https://…" onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
              </label>
              <p className="mt-1 text-xs text-[var(--adm-muted)]">{c.imageHint}</p>
              {form.imageUrl.trim() && (
                <div className="mt-2 flex items-center gap-2 text-xs text-[var(--adm-muted)]"><Thumb key={form.imageUrl} item={{ name: form.name || '?', imageUrl: form.imageUrl.trim() }} />{c.preview}</div>
              )}
            </div>
            <label className="flex items-center gap-3 text-sm font-semibold text-[var(--adm-text)]">
              <input type="checkbox" className="h-5 w-5" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              {c.activeLabel}
            </label>
            {formError && <p role="alert" className="text-sm text-[var(--adm-error)]">{formError}</p>}
            <div className="flex justify-end gap-2">
              <button type="submit" disabled={busy} className={`${BTN_PRIMARY} min-w-[140px]`}>{busy ? c.saving : dialog.mode === 'add' ? c.saveNew : c.saveEdit}</button>
            </div>
          </form>
        </AdminDialog>
      )}
    </section>
  );
}
