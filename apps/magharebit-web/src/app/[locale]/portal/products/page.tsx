'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLang, type Lang } from '@/components/landing/useLang';
import { usePortal } from '@/components/portal/shell/PortalProvider';
import { portalJson } from '@/components/portal/shell/portalFetch';
import PortalDialog, { BTN, CARD, FIELD, LABEL } from '@/components/portal/PortalDialog';
import { int, money } from '@/components/portal/format';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Product {
  id: string; plu: string; name: string; category: string; price: number; costPrice: number;
  stock: number; minStock: number; unit: string; emoji: string; barcode?: string; isActive: boolean;
}
interface ProductsResponse { products: Product[]; total: number; page: number; pages: number; categories: string[] }
type Reason = 'manual_add' | 'manual_remove' | 'purchase' | 'return';

// 'litre' is what the starter catalogues store; it must be an option, or editing such a product would reset its unit.
const UNITS = ['pièce', 'kg', 'g', 'L', 'litre', 'mL', 'boîte', 'pack', 'lot', 'service'] as const;
const SECTORS = ['cafe', 'epicerie', 'restaurant', 'pharmacie', 'beaute'] as const;
const ALERT_KEY = 'inv_alert_dismissed_date';

// ─── Copy ─────────────────────────────────────────────────────────────────────
const COPY: Record<Lang, {
  count: (n: number) => string; loading: string; seed: string; export: string; add: string;
  search: string; allCats: string; lowOnly: string; lowAlert: (n: number) => string; hideAlert: string;
  cols: { product: string; category: string; price: string; cost: string; stock: string; actions: string };
  low: string; adjust: string; edit: string; del: string; empty: string; noMatch: string; seedCta: string; clear: string;
  prev: string; next: string; page: (p: number, t: number) => string; legend: string; close: string; cancel: string;
  form: { titleNew: string; titleEdit: string; name: string; namePh: string; category: string; categoryPh: string; emoji: string; price: string; cost: string; stock: string; min: string; unit: string; save: string; saving: string };
  adj: { title: string; current: (n: string) => string; qty: string; qtyHelp: string; reason: string; reasons: Record<Reason, string>; confirm: string };
  seedDlg: { title: string; sub: string; sector: string; pick: string; sectors: Record<(typeof SECTORS)[number], string>; force: string; run: string; running: string };
  delDlg: { title: string; body: (n: string) => string; confirm: string };
  units: Record<(typeof UNITS)[number], string>;
  toast: { created: string; updated: string; deleted: string; adjusted: string; lowAfter: (n: string) => string; seeded: (n: number) => string };
  err: Record<string, string>; errGeneric: string; csv: string[];
}> = {
  fr: {
    count: (n) => `${n} produit${n > 1 ? 's' : ''} au catalogue`, loading: 'Chargement…', seed: 'Catalogue type', export: 'Exporter CSV', add: 'Ajouter un produit',
    search: 'Rechercher par nom ou PLU…', allCats: 'Toutes les catégories', lowOnly: 'Stock bas uniquement',
    lowAlert: (n) => `${n} produit${n > 1 ? 's sont' : ' est'} sous le seuil d’alerte. Pensez à réapprovisionner.`, hideAlert: 'Masquer pour aujourd’hui',
    cols: { product: 'Produit', category: 'Catégorie', price: 'Prix', cost: 'Coût', stock: 'Stock', actions: 'Actions' },
    low: 'Stock bas', adjust: 'Ajuster le stock', edit: 'Modifier', del: 'Supprimer',
    empty: 'Aucun produit pour l’instant.', noMatch: 'Aucun produit ne correspond à ces filtres.', seedCta: 'Partir d’un catalogue type', clear: 'Effacer les filtres',
    prev: 'Précédent', next: 'Suivant', page: (p, t) => `Page ${p} sur ${t}`, legend: 'Les lignes ambrées sont sous le seuil d’alerte.', close: 'Fermer', cancel: 'Annuler',
    form: { titleNew: 'Nouveau produit', titleEdit: 'Modifier le produit', name: 'Nom du produit', namePh: 'Ex. : Thé à la menthe', category: 'Catégorie', categoryPh: 'Ex. : Boissons', emoji: 'Icône', price: 'Prix de vente (MAD)', cost: 'Prix d’achat (MAD)', stock: 'Stock initial', min: 'Seuil d’alerte', unit: 'Unité', save: 'Enregistrer', saving: 'Enregistrement…' },
    adj: { title: 'Ajuster le stock', current: (n) => `Stock actuel : ${n}`, qty: 'Quantité', qtyHelp: 'Positive pour ajouter, négative pour retirer (ex. 10 ou -5).', reason: 'Motif', reasons: { manual_add: 'Ajout manuel', manual_remove: 'Retrait manuel', purchase: 'Achat fournisseur', return: 'Retour client' }, confirm: 'Valider' },
    seedDlg: { title: 'Partir d’un catalogue type', sub: 'Une liste de produits courants avec des prix en dirhams, selon votre secteur. Vous pourrez tout modifier ensuite.', sector: 'Secteur', pick: 'Choisir un secteur', sectors: { cafe: 'Café', epicerie: 'Épicerie', restaurant: 'Restaurant', pharmacie: 'Pharmacie', beaute: 'Beauté' }, force: 'Remplacer les produits existants (ils seront archivés)', run: 'Créer les produits', running: 'Création…' },
    delDlg: { title: 'Supprimer ce produit ?', body: (n) => `« ${n} » sera retiré du catalogue.`, confirm: 'Supprimer' },
    units: { 'pièce': 'pièce', kg: 'kg', g: 'g', L: 'L', litre: 'litre', mL: 'mL', 'boîte': 'boîte', pack: 'pack', lot: 'lot', service: 'service' },
    toast: { created: 'Produit ajouté', updated: 'Produit mis à jour', deleted: 'Produit supprimé', adjusted: 'Stock ajusté', lowAfter: (n) => `Stock bas : ${n}`, seeded: (n) => `${n} produits créés` },
    err: { stock_would_be_negative: 'Le stock ne peut pas devenir négatif : retirez au plus la quantité disponible.', name_required: 'Le nom est obligatoire.', category_required: 'La catégorie est obligatoire.', price_invalid: 'Le prix doit être un nombre positif.', plu_already_exists: 'Ce PLU existe déjà.', delta_must_be_nonzero: 'Saisissez une quantité différente de zéro.', invalid_sector: 'Secteur inconnu.', products_already_exist: 'Vous avez déjà des produits : cochez « Remplacer » pour continuer.', template_empty: 'Ce catalogue type est vide.', not_found: 'Produit introuvable.', offline: 'Vous êtes hors ligne.' },
    errGeneric: 'L’opération a échoué. Réessayez.', csv: ['PLU', 'Nom', 'Catégorie', 'Prix', 'Coût', 'Stock', 'Seuil'],
  },
  ar: {
    count: (n) => `${n} ${n === 1 ? 'منتج' : n === 2 ? 'منتجان' : n <= 10 ? 'منتجات' : 'منتجاً'} في الكتالوج`, loading: 'جارٍ التحميل…', seed: 'كتالوج جاهز', export: 'تصدير CSV', add: 'إضافة منتج',
    search: 'ابحث بالاسم أو PLU…', allCats: 'كل الفئات', lowOnly: 'المخزون المنخفض فقط',
    lowAlert: (n) => `${n} ${n === 1 ? 'منتج تحت' : 'منتجات تحت'} حد التنبيه. يُنصح بإعادة التموين.`, hideAlert: 'إخفاء لليوم',
    cols: { product: 'المنتج', category: 'الفئة', price: 'السعر', cost: 'التكلفة', stock: 'المخزون', actions: 'إجراءات' },
    low: 'مخزون منخفض', adjust: 'تعديل المخزون', edit: 'تعديل', del: 'حذف',
    empty: 'لا توجد منتجات بعد.', noMatch: 'لا توجد منتجات مطابقة لهذه الفلاتر.', seedCta: 'ابدأ من كتالوج جاهز', clear: 'مسح الفلاتر',
    prev: 'السابق', next: 'التالي', page: (p, t) => `الصفحة ${p} من ${t}`, legend: 'الصفوف الكهرمانية تحت حد التنبيه.', close: 'إغلاق', cancel: 'إلغاء',
    form: { titleNew: 'منتج جديد', titleEdit: 'تعديل المنتج', name: 'اسم المنتج', namePh: 'مثال: أتاي بالنعناع', category: 'الفئة', categoryPh: 'مثال: مشروبات', emoji: 'الأيقونة', price: 'سعر البيع (درهم)', cost: 'سعر الشراء (درهم)', stock: 'المخزون الأولي', min: 'حد التنبيه', unit: 'الوحدة', save: 'حفظ', saving: 'جارٍ الحفظ…' },
    adj: { title: 'تعديل المخزون', current: (n) => `المخزون الحالي: ${n}`, qty: 'الكمية', qtyHelp: 'موجبة للإضافة، سالبة للإزالة (مثال 10 أو -5).', reason: 'السبب', reasons: { manual_add: 'إضافة يدوية', manual_remove: 'إزالة يدوية', purchase: 'شراء من المورد', return: 'مرتجع زبون' }, confirm: 'تأكيد' },
    seedDlg: { title: 'ابدأ من كتالوج جاهز', sub: 'قائمة منتجات شائعة بأسعار بالدرهم حسب قطاعك. يمكنك تعديل كل شيء لاحقاً.', sector: 'القطاع', pick: 'اختر القطاع', sectors: { cafe: 'مقهى', epicerie: 'بقالة', restaurant: 'مطعم', pharmacie: 'صيدلية', beaute: 'تجميل' }, force: 'استبدال المنتجات الحالية (ستُؤرشف)', run: 'إنشاء المنتجات', running: 'جارٍ الإنشاء…' },
    delDlg: { title: 'حذف هذا المنتج؟', body: (n) => `سيُحذف «${n}» من الكتالوج.`, confirm: 'حذف' },
    units: { 'pièce': 'قطعة', kg: 'كغ', g: 'غ', L: 'ل', litre: 'لتر', mL: 'مل', 'boîte': 'علبة', pack: 'رزمة', lot: 'مجموعة', service: 'خدمة' },
    toast: { created: 'تمت إضافة المنتج', updated: 'تم تحديث المنتج', deleted: 'تم حذف المنتج', adjusted: 'تم تعديل المخزون', lowAfter: (n) => `مخزون منخفض: ${n}`, seeded: (n) => `تم إنشاء ${n} منتجاً` },
    err: { stock_would_be_negative: 'لا يمكن أن يصبح المخزون سالباً: اسحب الكمية المتوفرة كحد أقصى.', name_required: 'الاسم مطلوب.', category_required: 'الفئة مطلوبة.', price_invalid: 'يجب أن يكون السعر رقماً موجباً.', plu_already_exists: 'رمز PLU هذا موجود.', delta_must_be_nonzero: 'أدخل كمية غير الصفر.', invalid_sector: 'قطاع غير معروف.', products_already_exist: 'لديك منتجات بالفعل: فعّل «استبدال» للمتابعة.', template_empty: 'هذا الكتالوج فارغ.', not_found: 'المنتج غير موجود.', offline: 'أنت غير متصل.' },
    errGeneric: 'فشلت العملية. أعد المحاولة.', csv: ['PLU', 'الاسم', 'الفئة', 'السعر', 'التكلفة', 'المخزون', 'الحد الأدنى'],
  },
  en: {
    count: (n) => `${n} product${n === 1 ? '' : 's'} in the catalogue`, loading: 'Loading…', seed: 'Starter catalogue', export: 'Export CSV', add: 'Add a product',
    search: 'Search by name or PLU…', allCats: 'All categories', lowOnly: 'Low stock only',
    lowAlert: (n) => `${n} product${n === 1 ? ' is' : 's are'} below the alert level. Consider restocking.`, hideAlert: 'Hide for today',
    cols: { product: 'Product', category: 'Category', price: 'Price', cost: 'Cost', stock: 'Stock', actions: 'Actions' },
    low: 'Low stock', adjust: 'Adjust stock', edit: 'Edit', del: 'Delete',
    empty: 'No products yet.', noMatch: 'No products match these filters.', seedCta: 'Start from a starter catalogue', clear: 'Clear filters',
    prev: 'Previous', next: 'Next', page: (p, t) => `Page ${p} of ${t}`, legend: 'Amber rows are below the alert level.', close: 'Close', cancel: 'Cancel',
    form: { titleNew: 'New product', titleEdit: 'Edit product', name: 'Product name', namePh: 'e.g. Mint tea', category: 'Category', categoryPh: 'e.g. Drinks', emoji: 'Icon', price: 'Sale price (MAD)', cost: 'Cost price (MAD)', stock: 'Opening stock', min: 'Alert level', unit: 'Unit', save: 'Save', saving: 'Saving…' },
    adj: { title: 'Adjust stock', current: (n) => `Current stock: ${n}`, qty: 'Quantity', qtyHelp: 'Positive to add, negative to remove (e.g. 10 or -5).', reason: 'Reason', reasons: { manual_add: 'Manual addition', manual_remove: 'Manual removal', purchase: 'Supplier purchase', return: 'Customer return' }, confirm: 'Confirm' },
    seedDlg: { title: 'Start from a starter catalogue', sub: 'A list of common products with prices in dirhams for your sector. You can change everything afterwards.', sector: 'Sector', pick: 'Choose a sector', sectors: { cafe: 'Café', epicerie: 'Grocery', restaurant: 'Restaurant', pharmacie: 'Pharmacy', beaute: 'Beauty' }, force: 'Replace the existing products (they will be archived)', run: 'Create products', running: 'Creating…' },
    delDlg: { title: 'Delete this product?', body: (n) => `“${n}” will be removed from the catalogue.`, confirm: 'Delete' },
    units: { 'pièce': 'piece', kg: 'kg', g: 'g', L: 'L', litre: 'litre', mL: 'mL', 'boîte': 'box', pack: 'pack', lot: 'lot', service: 'service' },
    toast: { created: 'Product added', updated: 'Product updated', deleted: 'Product deleted', adjusted: 'Stock adjusted', lowAfter: (n) => `Low stock: ${n}`, seeded: (n) => `${n} products created` },
    err: { stock_would_be_negative: 'Stock cannot go negative: remove at most the quantity available.', name_required: 'The name is required.', category_required: 'The category is required.', price_invalid: 'The price must be a positive number.', plu_already_exists: 'This PLU already exists.', delta_must_be_nonzero: 'Enter a quantity other than zero.', invalid_sector: 'Unknown sector.', products_already_exist: 'You already have products: tick “Replace” to continue.', template_empty: 'This starter catalogue is empty.', not_found: 'Product not found.', offline: 'You are offline.' },
    errGeneric: 'That did not work. Try again.', csv: ['PLU', 'Name', 'Category', 'Price', 'Cost', 'Stock', 'Alert level'],
  },
};

const ICONS = {
  plus: 'M12 5v14M5 12h14',
  download: 'M12 3v12M7 10l5 5 5-5M4 21h16',
  sprout: 'M12 20v-8M12 12c0-4 3-7 8-7 0 5-3 8-8 7zM12 14c0-3-2-5-6-5 0 4 2 6 6 5z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5',
  adjust: 'M12 5v14M5 12h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  warn: 'M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
};
function Icon({ d, className = 'h-4 w-4' }: { d: string; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const { lang } = useLang();
  const c = COPY[lang];
  const { toast, refreshMe } = usePortal();

  const [data, setData] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [alertHidden, setAlertHidden] = useState(true);
  const [ready, setReady] = useState(false);

  // dialogs
  const [form, setForm] = useState<{ open: boolean; edit: Product | null }>({ open: false, edit: null });
  const [adjust, setAdjust] = useState<Product | null>(null);
  const [del, setDel] = useState<Product | null>(null);
  const [seedOpen, setSeedOpen] = useState(false);

  const errText = (code: string) => c.err[code] ?? c.errGeneric;

  // Initial filters: ?lowStock=1 (dashboard link) and today's alert dismissal, read once after hydration
  useEffect(() => {
    const t = setTimeout(() => {
      if (new URLSearchParams(window.location.search).get('lowStock') === '1') setLowOnly(true);
      try { setAlertHidden(localStorage.getItem(ALERT_KEY) === new Date().toDateString()); } catch { setAlertHidden(false); }
      setReady(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const load = useCallback(() => {
    const q = new URLSearchParams({ page: String(page), limit: '20' });
    if (search.trim()) q.set('search', search.trim());
    if (category) q.set('category', category);
    if (lowOnly) q.set('lowStock', 'true');
    setLoading(true);
    void portalJson<ProductsResponse>(`/api/portal/products?${q}`).then((r) => {
      setLoadError(!r.ok);
      if (r.ok) setData(r.data);
      setLoading(false);
    });
  }, [page, search, category, lowOnly]);

  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(load, 250); // debounce typing
    return () => clearTimeout(t);
  }, [load, ready]);

  const reload = () => { load(); refreshMe(); };
  const products = data?.products ?? [];
  const categories = data?.categories ?? [];
  const totalPages = Math.max(1, data?.pages ?? 1);
  const lowCount = products.filter((p) => p.stock <= p.minStock).length;
  const filtered = Boolean(search || category || lowOnly);
  const unit = (u: string) => (c.units as Record<string, string>)[u] ?? u;

  const exportCsv = () => {
    if (!products.length) return;
    const rows = products.map((p) => [p.plu, p.name, p.category, String(p.price), String(p.costPrice), String(p.stock), String(p.minStock)]);
    const csv = [c.csv, ...rows].map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'products.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#6B7280]" data-testid="products-count">{data ? c.count(data.total) : c.loading}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setSeedOpen(true)} className={BTN.secondary}><Icon d={ICONS.sprout} />{c.seed}</button>
          <button type="button" onClick={exportCsv} disabled={!products.length} className={BTN.secondary}><Icon d={ICONS.download} />{c.export}</button>
          <button type="button" onClick={() => setForm({ open: true, edit: null })} className={BTN.primary} data-testid="product-add"><Icon d={ICONS.plus} />{c.add}</button>
        </div>
      </div>

      {/* low-stock alert */}
      {!alertHidden && lowCount > 0 && (
        <div role="status" className="flex flex-wrap items-start gap-x-3 gap-y-1 rounded-xl border border-[#F0B429]/50 bg-[#FFF8E1] px-4 py-3 text-sm text-[#7A5600]" data-testid="low-alert">
          <Icon d={ICONS.warn} className="mt-0.5 h-5 w-5 text-[#B8860B]" />
          <span className="min-w-0 flex-1 basis-[calc(100%-2rem)] font-medium sm:basis-0">{c.lowAlert(lowCount)}</span>
          <button
            type="button"
            onClick={() => { try { localStorage.setItem(ALERT_KEY, new Date().toDateString()); } catch { /* ignore */ } setAlertHidden(true); }}
            className="ms-8 shrink-0 rounded-md py-0.5 text-xs font-semibold underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B] sm:ms-0 sm:px-2"
          >
            {c.hideAlert}
          </button>
        </div>
      )}

      {/* filters */}
      <div className={`${CARD} flex flex-wrap items-center gap-3 p-3`}>
        <label className="relative min-w-[220px] flex-1">
          <span className="sr-only">{c.search}</span>
          <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-[#9CA3AF]"><Icon d={ICONS.search} /></span>
          <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={c.search} className={`${FIELD} ps-9`} data-testid="products-search" />
        </label>
        <label className="w-full sm:w-auto sm:min-w-[180px]">
          <span className="sr-only">{c.cols.category}</span>
          <select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} className={`${FIELD} cursor-pointer`}>
            <option value="">{c.allCats}</option>
            {categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </label>
        <label className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-[#374151]">
          <input type="checkbox" checked={lowOnly} onChange={(e) => { setLowOnly(e.target.checked); setPage(1); }} className="h-4 w-4 rounded border-[#D1D5DB] accent-[#0F3D2A]" data-testid="products-low" />
          {c.lowOnly}
        </label>
      </div>

      {/* list */}
      <section className={`${CARD} overflow-hidden`} aria-busy={loading} data-testid="products-list">
        {loading && !data ? (
          <div className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-[#F3F4F6]" />)}</div>
        ) : loadError ? (
          <div className="px-5 py-12 text-center text-sm text-[#B91C1C]">{c.errGeneric}</div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center gap-4 px-5 py-14 text-center" data-testid="products-empty">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F0FDF6] text-[#0F3D2A] ring-1 ring-[#D1FAE5]"><Icon d={filtered ? ICONS.search : 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8'} className="h-6 w-6" /></span>
            <p className="text-sm text-[#6B7280]">{filtered ? c.noMatch : c.empty}</p>
            {filtered
              ? <button type="button" onClick={() => { setSearch(''); setCategory(''); setLowOnly(false); setPage(1); }} className={BTN.secondary}>{c.clear}</button>
              : <button type="button" onClick={() => setSeedOpen(true)} className={BTN.primary}><Icon d={ICONS.sprout} />{c.seedCta}</button>}
          </div>
        ) : (
          <>
            {/* desktop table */}
            <div className={`hidden overflow-x-auto transition-opacity md:block ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full text-sm">
                <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#6B7280]">
                  <tr>
                    {[c.cols.product, c.cols.category, c.cols.price, c.cols.cost, c.cols.stock].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-5 py-3 text-start">{h}</th>)}
                    <th scope="col" className="px-5 py-3 text-end">{c.cols.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {products.map((p) => {
                    const isLow = p.stock <= p.minStock;
                    return (
                      <tr key={p.id} data-product={p.name} className={`transition-colors ${isLow ? 'bg-[#FFFBEB] hover:bg-[#FFF5D6]' : 'hover:bg-[#FAFAFB]'}`}>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#F3F4F6] text-lg" aria-hidden="true">{p.emoji || '📦'}</span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-[#111827]">{p.name}</p>
                              <p className="font-mono text-xs text-[#9CA3AF]" dir="ltr">{p.plu}</p>
                            </div>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3"><span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-medium text-[#374151]">{p.category}</span></td>
                        <td className="whitespace-nowrap px-5 py-3 font-semibold tabular-nums text-[#111827]">{money(p.price, lang)}</td>
                        <td className="whitespace-nowrap px-5 py-3 tabular-nums text-[#6B7280]">{money(p.costPrice, lang)}</td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <span className={`font-semibold tabular-nums ${isLow ? 'text-[#92400E]' : 'text-[#166534]'}`}>{int(p.stock, lang)} {unit(p.unit)}</span>
                          {isLow && <span className="ms-2 rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-semibold text-[#92400E] ring-1 ring-[#F0B429]/40">{c.low}</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex justify-end gap-1">
                            <RowAction label={c.adjust} d={ICONS.adjust} onClick={() => setAdjust(p)} />
                            <RowAction label={c.edit} d={ICONS.edit} onClick={() => setForm({ open: true, edit: p })} />
                            <RowAction label={c.del} d={ICONS.trash} danger onClick={() => setDel(p)} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* phone cards */}
            <ul className={`divide-y divide-[#F3F4F6] md:hidden ${loading ? 'opacity-60' : ''}`}>
              {products.map((p) => {
                const isLow = p.stock <= p.minStock;
                return (
                  <li key={p.id} className={`flex items-center gap-3 px-4 py-3 ${isLow ? 'bg-[#FFFBEB]' : ''}`}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#F3F4F6] text-lg" aria-hidden="true">{p.emoji || '📦'}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[#111827]">{p.name}</p>
                      <p className="text-xs text-[#6B7280]">{money(p.price, lang)} · <span className={isLow ? 'font-semibold text-[#92400E]' : ''}>{int(p.stock, lang)} {unit(p.unit)}</span></p>
                    </div>
                    <div className="flex gap-0.5">
                      <RowAction label={c.adjust} d={ICONS.adjust} onClick={() => setAdjust(p)} />
                      <RowAction label={c.edit} d={ICONS.edit} onClick={() => setForm({ open: true, edit: p })} />
                      <RowAction label={c.del} d={ICONS.trash} danger onClick={() => setDel(p)} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* pagination + legend */}
      {products.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs text-[#6B7280]"><span aria-hidden="true" className="h-3 w-3 rounded-sm bg-[#FFFBEB] ring-1 ring-[#F0B429]/60" />{c.legend}</p>
          {totalPages > 1 && (
            <nav className="flex items-center gap-2" aria-label={c.page(page, totalPages)}>
              <button type="button" onClick={() => setPage((x) => Math.max(1, x - 1))} disabled={page <= 1} className={BTN.secondary}>{c.prev}</button>
              <span className="px-2 text-sm tabular-nums text-[#6B7280]">{c.page(page, totalPages)}</span>
              <button type="button" onClick={() => setPage((x) => Math.min(totalPages, x + 1))} disabled={page >= totalPages} className={BTN.secondary}>{c.next}</button>
            </nav>
          )}
        </div>
      )}

      <ProductForm
        // keys are per dialog: both can refer to the same product id, and siblings must not share a key
        key={`form-${form.edit?.id ?? (form.open ? 'new' : 'closed')}`}
        open={form.open} edit={form.edit} lang={lang} categories={categories}
        onClose={() => setForm({ open: false, edit: null })}
        onSaved={(created) => { setForm({ open: false, edit: null }); toast('success', created ? c.toast.created : c.toast.updated); reload(); }}
        errText={errText}
      />
      <AdjustDialog
        key={`adjust-${adjust?.id ?? 'none'}`} product={adjust} lang={lang}
        onClose={() => setAdjust(null)}
        onDone={(name, isLow) => { setAdjust(null); toast(isLow ? 'warning' : 'success', isLow ? c.toast.lowAfter(name) : c.toast.adjusted); reload(); }}
        errText={errText}
      />
      <PortalDialog
        open={del !== null} onClose={() => setDel(null)} title={c.delDlg.title} closeLabel={c.close} size="sm" testId="product-delete"
        description={del ? c.delDlg.body(del.name) : undefined}
        footer={
          <>
            <button type="button" onClick={() => setDel(null)} className={BTN.secondary}>{c.cancel}</button>
            <button
              type="button" className={BTN.danger} data-testid="product-delete-confirm"
              onClick={async () => {
                if (!del) return;
                const r = await portalJson(`/api/portal/products/${del.id}`, { method: 'DELETE' });
                setDel(null);
                if (r.ok) { toast('success', c.toast.deleted); reload(); } else if (r.error !== 'offline') toast('error', errText(r.error));
              }}
            >
              {c.delDlg.confirm}
            </button>
          </>
        }
      />
      <SeedDialog
        open={seedOpen} lang={lang} onClose={() => setSeedOpen(false)}
        onDone={(n) => { setSeedOpen(false); toast('success', c.toast.seeded(n)); reload(); }}
        errText={errText}
      />
    </div>
  );
}

function RowAction({ label, d, onClick, danger = false }: { label: string; d: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={label} title={label}
      className={`grid h-9 w-9 place-items-center rounded-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B] ${danger ? 'text-[#DC2626] hover:bg-[#FEF2F2]' : 'text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]'}`}
    >
      <Icon d={d} />
    </button>
  );
}

// ─── Add / edit ───────────────────────────────────────────────────────────────
function ProductForm({ open, edit, lang, categories, onClose, onSaved, errText }: {
  open: boolean; edit: Product | null; lang: Lang; categories: string[];
  onClose: () => void; onSaved: (created: boolean) => void; errText: (code: string) => string;
}) {
  const c = COPY[lang];
  const [f, setF] = useState({
    name: edit?.name ?? '', category: edit?.category ?? '', emoji: edit?.emoji ?? '📦',
    price: edit ? String(edit.price) : '', cost: edit ? String(edit.costPrice) : '',
    stock: edit ? String(edit.stock) : '0', min: edit ? String(edit.minStock) : '5', unit: edit?.unit ?? 'pièce',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  const save = async () => {
    if (!f.name.trim()) return setError(c.err.name_required);
    if (!f.category.trim()) return setError(c.err.category_required);
    const price = Number(f.price);
    if (f.price === '' || !Number.isFinite(price) || price < 0) return setError(c.err.price_invalid);
    setSaving(true); setError('');
    const r = await portalJson(edit ? `/api/portal/products/${edit.id}` : '/api/portal/products', {
      method: edit ? 'PATCH' : 'POST',
      json: {
        name: f.name.trim(), category: f.category.trim(), emoji: f.emoji || '📦', unit: f.unit,
        price, costPrice: Number(f.cost || 0), stock: parseInt(f.stock || '0', 10), minStock: parseInt(f.min || '5', 10),
      },
    });
    setSaving(false);
    if (r.ok) onSaved(!edit); else setError(errText(r.error));
  };

  return (
    <PortalDialog
      open={open} onClose={onClose} title={edit ? c.form.titleEdit : c.form.titleNew} closeLabel={c.close} size="lg" testId="product-form"
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN.secondary}>{c.cancel}</button>
          <button type="button" onClick={save} disabled={saving} className={BTN.primary} data-testid="product-save">{saving ? c.form.saving : c.form.save}</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2 grid grid-cols-[1fr_88px] gap-3">
          <label><span className={LABEL}>{c.form.name} *</span><input value={f.name} onChange={set('name')} placeholder={c.form.namePh} className={FIELD} data-testid="f-name" autoFocus /></label>
          <label><span className={LABEL}>{c.form.emoji}</span><input value={f.emoji} onChange={set('emoji')} maxLength={4} className={`${FIELD} text-center text-lg`} /></label>
        </div>
        <label>
          <span className={LABEL}>{c.form.category} *</span>
          <input value={f.category} onChange={set('category')} placeholder={c.form.categoryPh} list="product-categories" className={FIELD} data-testid="f-category" />
          <datalist id="product-categories">{categories.map((x) => <option key={x} value={x} />)}</datalist>
        </label>
        <label>
          <span className={LABEL}>{c.form.unit}</span>
          <select value={f.unit} onChange={set('unit')} className={`${FIELD} cursor-pointer`}>
            {UNITS.map((u) => <option key={u} value={u}>{c.units[u]}</option>)}
          </select>
        </label>
        <label><span className={LABEL}>{c.form.price} *</span><input type="number" inputMode="decimal" min="0" step="0.5" value={f.price} onChange={set('price')} dir="ltr" className={`${FIELD} text-end`} data-testid="f-price" /></label>
        <label><span className={LABEL}>{c.form.cost}</span><input type="number" inputMode="decimal" min="0" step="0.5" value={f.cost} onChange={set('cost')} dir="ltr" className={`${FIELD} text-end`} /></label>
        <label><span className={LABEL}>{c.form.stock}</span><input type="number" inputMode="numeric" min="0" value={f.stock} onChange={set('stock')} dir="ltr" className={`${FIELD} text-end`} disabled={!!edit} /></label>
        <label><span className={LABEL}>{c.form.min}</span><input type="number" inputMode="numeric" min="0" value={f.min} onChange={set('min')} dir="ltr" className={`${FIELD} text-end`} /></label>
        {error && <p role="alert" className="sm:col-span-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#B91C1C]" data-testid="form-error">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </PortalDialog>
  );
}

// ─── Adjust stock ─────────────────────────────────────────────────────────────
function AdjustDialog({ product, lang, onClose, onDone, errText }: {
  product: Product | null; lang: Lang; onClose: () => void; onDone: (name: string, isLow: boolean) => void; errText: (code: string) => string;
}) {
  const c = COPY[lang];
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState<Reason>('manual_add');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!product) return;
    const n = parseInt(delta, 10);
    if (!n) return setError(c.err.delta_must_be_nonzero);
    setSaving(true); setError('');
    const r = await portalJson<{ isLowStock?: boolean }>(`/api/portal/products/${product.id}/adjust`, { method: 'POST', json: { delta: n, reason } });
    setSaving(false);
    if (r.ok) onDone(product.name, Boolean(r.data.isLowStock)); else setError(errText(r.error));
  };

  return (
    <PortalDialog
      open={product !== null} onClose={onClose} title={c.adj.title} closeLabel={c.close} size="sm" testId="product-adjust"
      description={product ? <span>{product.emoji} {product.name} · {c.adj.current(int(product.stock, lang))}</span> : undefined}
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN.secondary}>{c.cancel}</button>
          <button type="button" onClick={submit} disabled={saving} className={BTN.primary} data-testid="adjust-confirm">{saving ? '…' : c.adj.confirm}</button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} className="space-y-4" noValidate>
        <label className="block">
          <span className={LABEL}>{c.adj.qty}</span>
          <input type="number" inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} dir="ltr" className={`${FIELD} text-center text-lg font-semibold`} data-testid="adjust-delta" autoFocus />
          <span className="mt-1.5 block text-xs text-[#6B7280]">{c.adj.qtyHelp}</span>
        </label>
        <label className="block">
          <span className={LABEL}>{c.adj.reason}</span>
          <select value={reason} onChange={(e) => setReason(e.target.value as Reason)} className={`${FIELD} cursor-pointer`}>
            {(Object.keys(c.adj.reasons) as Reason[]).map((k) => <option key={k} value={k}>{c.adj.reasons[k]}</option>)}
          </select>
        </label>
        {error && <p role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#B91C1C]">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </PortalDialog>
  );
}

// ─── Starter catalogue ────────────────────────────────────────────────────────
function SeedDialog({ open, lang, onClose, onDone, errText }: {
  open: boolean; lang: Lang; onClose: () => void; onDone: (n: number) => void; errText: (code: string) => string;
}) {
  const c = COPY[lang];
  const [sector, setSector] = useState('');
  const [force, setForce] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setRunning(true); setError('');
    const r = await portalJson<{ seeded: number }>('/api/portal/products/seed', { method: 'POST', json: { sector, force } });
    setRunning(false);
    if (r.ok) { setSector(''); setForce(false); onDone(r.data.seeded); return; }
    if (r.status === 409) setForce(true);
    setError(errText(r.error));
  };

  return (
    <PortalDialog
      open={open} onClose={onClose} title={c.seedDlg.title} description={c.seedDlg.sub} closeLabel={c.close} testId="product-seed"
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN.secondary}>{c.cancel}</button>
          <button type="button" onClick={run} disabled={!sector || running} className={BTN.primary} data-testid="seed-run">{running ? c.seedDlg.running : c.seedDlg.run}</button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="block">
          <span className={LABEL}>{c.seedDlg.sector}</span>
          <select value={sector} onChange={(e) => setSector(e.target.value)} className={`${FIELD} cursor-pointer`} data-testid="seed-sector">
            <option value="" disabled>{c.seedDlg.pick}</option>
            {SECTORS.map((s) => <option key={s} value={s}>{c.seedDlg.sectors[s]}</option>)}
          </select>
        </label>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-[#374151]">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-[#0F3D2A]" />
          {c.seedDlg.force}
        </label>
        {error && <p role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#B91C1C]">{error}</p>}
      </div>
    </PortalDialog>
  );
}
