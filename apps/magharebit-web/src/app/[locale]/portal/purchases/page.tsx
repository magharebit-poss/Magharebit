'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang, type Lang } from '@/components/landing/useLang';
import { usePortal } from '@/components/portal/shell/PortalProvider';
import { portalJson } from '@/components/portal/shell/portalFetch';
import PortalDialog, { BTN, CARD, FIELD, LABEL } from '@/components/portal/PortalDialog';
import { int, longDate, money } from '@/components/portal/format';

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = 'draft' | 'ordered' | 'partial' | 'received' | 'cancelled';
type Tab = 'orders' | 'suppliers';

interface Supplier { id: string; name: string; phone?: string; email?: string; address?: string; notes?: string; isActive: boolean }
interface OrderItem { productId: string; productName: string; productPlu?: string; qtyOrdered: number; qtyReceived: number; unitCost: number }
interface Order {
  id: string; supplierId: string; supplierName: string; status: Status; items: OrderItem[];
  totalCost: number; notes?: string; expectedAt?: string; createdAt: string;
}
interface Product { id: string; name: string; plu: string; costPrice?: number }

const LIMIT = 20;
const STATUSES: Status[] = ['draft', 'ordered', 'partial', 'received', 'cancelled'];
const ref = (id: string) => `#${id.slice(-6).toUpperCase()}`;

// ─── Copy ─────────────────────────────────────────────────────────────────────
type Copy = {
  intro: string; loading: string; tabs: Record<Tab, string>;
  kpi: { draft: string; pending: string; received: string };
  status: Record<Status, string>; allStatuses: string; statusFilter: string;
  newOrder: string; addSupplier: string;
  oc: { ref: string; supplier: string; lines: string; cost: string; status: string; expected: string; created: string };
  lines: (n: number) => string; view: string; viewLabel: (r: string) => string; send: string; receive: string;
  ordersEmpty: string; ordersNoMatch: string; showAll: string; loadError: string; retry: string;
  prev: string; next: string; page: (p: number, t: number) => string; close: string; cancel: string; back: string;
  detail: { title: (r: string) => string; product: string; ordered: string; received: string; unitCost: string; total: string; grandTotal: string; notes: string; expected: string; sendToSupplier: string; receive: string; cancelOrder: string; confirmCancel: string; cancelWarn: string };
  rcv: { title: string; warn: string; product: string; remaining: string; now: string; all: string; submit: string; nothing: string };
  form: { title: string; supplier: string; chooseSupplier: string; expected: string; notes: string; notesPh: string; items: string; addLine: string; product: string; chooseProduct: string; qty: string; unitCost: string; remove: string; noLines: string; total: string; create: string; noSuppliers: string; goSuppliers: string; optional: string };
  sc: { name: string; phone: string; email: string; address: string; status: string };
  active: string; inactive: string; edit: string; editLabel: (n: string) => string; search: string;
  suppliersEmpty: string; suppliersNoMatch: string; clear: string; suppliersCount: (n: number) => string;
  sform: { add: string; edit: string; name: string; namePh: string; phone: string; email: string; address: string; addressPh: string; notes: string; notesPh: string; active: string; activeHint: string; save: string; create: string };
  toast: { orderCreated: string; sent: string; received: string; cancelled: string; supplierAdded: string; supplierSaved: string };
  err: Record<string, string>; errGeneric: string;
};

const COPY: Record<Lang, Copy> = {
  fr: {
    intro: 'Gérez vos fournisseurs et vos bons de commande ; la réception met votre stock à jour.', loading: 'Chargement…',
    tabs: { orders: 'Bons de commande', suppliers: 'Fournisseurs' },
    kpi: { draft: 'Brouillons à envoyer', pending: 'En attente de livraison', received: 'Commandes reçues' },
    status: { draft: 'Brouillon', ordered: 'Envoyée', partial: 'Partielle', received: 'Reçue', cancelled: 'Annulée' }, allStatuses: 'Toutes', statusFilter: 'Filtrer par statut',
    newOrder: 'Nouveau bon de commande', addSupplier: 'Ajouter un fournisseur',
    oc: { ref: 'Réf.', supplier: 'Fournisseur', lines: 'Articles', cost: 'Coût', status: 'Statut', expected: 'Livraison prévue', created: 'Créée le' },
    lines: (n) => `${n} article${n > 1 ? 's' : ''}`, view: 'Voir', viewLabel: (r) => `Voir la commande ${r}`, send: 'Envoyer', receive: 'Réceptionner',
    ordersEmpty: 'Aucun bon de commande. Créez votre premier achat auprès d’un fournisseur.', ordersNoMatch: 'Aucune commande avec ce statut.', showAll: 'Tout afficher',
    loadError: 'Impossible de charger les données.', retry: 'Réessayer',
    prev: 'Précédent', next: 'Suivant', page: (p, t) => `Page ${p} sur ${t}`, close: 'Fermer', cancel: 'Annuler', back: 'Retour',
    detail: { title: (r) => `Commande ${r}`, product: 'Article', ordered: 'Commandé', received: 'Reçu', unitCost: 'Coût unitaire', total: 'Total', grandTotal: 'Total de la commande', notes: 'Notes', expected: 'Livraison prévue', sendToSupplier: 'Marquer comme envoyée', receive: 'Réceptionner', cancelOrder: 'Annuler la commande', confirmCancel: 'Confirmer l’annulation', cancelWarn: 'La commande sera annulée. Le stock déjà reçu reste en place.' },
    rcv: { title: 'Réception de marchandise', warn: 'Les quantités confirmées sont ajoutées directement à votre stock. Comptez la livraison avant de valider.', product: 'Article', remaining: 'Restant', now: 'Reçu maintenant', all: 'Tout recevoir', submit: 'Valider la réception', nothing: 'Saisissez au moins une quantité.' },
    form: { title: 'Nouveau bon de commande', supplier: 'Fournisseur', chooseSupplier: 'Choisir un fournisseur', expected: 'Livraison prévue', notes: 'Notes', notesPh: 'Conditions, référence fournisseur…', items: 'Articles', addLine: 'Ajouter un article', product: 'Article', chooseProduct: 'Choisir un article', qty: 'Quantité', unitCost: 'Coût unitaire (MAD)', remove: 'Retirer la ligne', noLines: 'Ajoutez au moins un article à commander.', total: 'Total', create: 'Créer le brouillon', noSuppliers: 'Aucun fournisseur actif. Ajoutez-en un avant de commander.', goSuppliers: 'Aller aux fournisseurs', optional: 'facultatif' },
    sc: { name: 'Nom', phone: 'Téléphone', email: 'E-mail', address: 'Adresse', status: 'Statut' },
    active: 'Actif', inactive: 'Inactif', edit: 'Modifier', editLabel: (n) => `Modifier ${n}`, search: 'Rechercher un fournisseur…',
    suppliersEmpty: 'Aucun fournisseur. Ajoutez votre premier fournisseur.', suppliersNoMatch: 'Aucun fournisseur ne correspond à cette recherche.', clear: 'Effacer la recherche',
    suppliersCount: (n) => `${n} fournisseur${n > 1 ? 's' : ''}`,
    sform: { add: 'Nouveau fournisseur', edit: 'Modifier le fournisseur', name: 'Nom', namePh: 'Ex. : Primeurs du Souss', phone: 'Téléphone', email: 'E-mail', address: 'Adresse', addressPh: 'Ex. : Marché de gros, Casablanca', notes: 'Notes', notesPh: 'Délais, conditions de paiement…', active: 'Fournisseur actif', activeHint: 'Un fournisseur inactif ne peut plus recevoir de commandes.', save: 'Enregistrer', create: 'Ajouter' },
    toast: { orderCreated: 'Bon de commande créé', sent: 'Commande marquée comme envoyée', received: 'Réception enregistrée — stock mis à jour', cancelled: 'Commande annulée', supplierAdded: 'Fournisseur ajouté', supplierSaved: 'Fournisseur enregistré' },
    err: {
      supplierId_required: 'Choisissez un fournisseur.', items_required: 'Ajoutez au moins un article.', item_missing_productId: 'Choisissez un article sur chaque ligne.',
      item_qty_must_be_positive_integer: 'Les quantités doivent être des nombres entiers positifs.', item_unitCost_invalid: 'Le coût unitaire n’est pas valide.',
      supplier_not_found: 'Fournisseur introuvable.', supplier_inactive: 'Ce fournisseur est inactif.', product_not_found: 'Un article n’existe plus.', expectedAt_invalid_date: 'La date de livraison n’est pas valide.',
      nothing_to_receive: 'Plus rien à réceptionner sur cette commande.', order_not_receivable: 'Cette commande ne peut plus être réceptionnée.', invalid_transition: 'Action impossible avec ce statut.',
      name_required: 'Le nom est obligatoire.', name_too_long: 'Le nom est trop long (120 caractères max.).', email_invalid: 'L’adresse e-mail n’est pas valide.', name_already_exists: 'Un fournisseur porte déjà ce nom.',
      not_found: 'Élément introuvable.', offline: 'Vous êtes hors ligne.', duplicate_product: 'Chaque article ne peut figurer qu’une fois.',
    },
    errGeneric: 'L’opération a échoué. Réessayez.',
  },
  ar: {
    intro: 'أدِر مورّديك وطلبات الشراء؛ تسجيل الاستلام يحدّث مخزونك.', loading: 'جارٍ التحميل…',
    tabs: { orders: 'طلبات الشراء', suppliers: 'الموردون' },
    kpi: { draft: 'مسودات للإرسال', pending: 'في انتظار التسليم', received: 'طلبات مستلمة' },
    status: { draft: 'مسودة', ordered: 'مُرسَل', partial: 'جزئي', received: 'مُستلَم', cancelled: 'ملغى' }, allStatuses: 'الكل', statusFilter: 'التصفية حسب الحالة',
    newOrder: 'طلب شراء جديد', addSupplier: 'إضافة مورد',
    oc: { ref: 'المرجع', supplier: 'المورد', lines: 'المنتجات', cost: 'التكلفة', status: 'الحالة', expected: 'التسليم المتوقع', created: 'تاريخ الإنشاء' },
    lines: (n) => (n === 1 ? 'منتج واحد' : n === 2 ? 'منتجان' : n <= 10 ? `${n} منتجات` : `${n} منتجاً`), view: 'عرض', viewLabel: (r) => `عرض الطلب ${r}`, send: 'إرسال', receive: 'استلام',
    ordersEmpty: 'لا توجد طلبات شراء. أنشئ أول طلب لدى مورد.', ordersNoMatch: 'لا توجد طلبات بهذه الحالة.', showAll: 'عرض الكل',
    loadError: 'تعذّر تحميل البيانات.', retry: 'أعد المحاولة',
    prev: 'السابق', next: 'التالي', page: (p, t) => `الصفحة ${p} من ${t}`, close: 'إغلاق', cancel: 'إلغاء', back: 'رجوع',
    detail: { title: (r) => `الطلب ${r}`, product: 'المنتج', ordered: 'المطلوب', received: 'المستلم', unitCost: 'سعر التكلفة', total: 'المجموع', grandTotal: 'مجموع الطلب', notes: 'ملاحظات', expected: 'التسليم المتوقع', sendToSupplier: 'تحديد كمُرسَل', receive: 'تسجيل الاستلام', cancelOrder: 'إلغاء الطلب', confirmCancel: 'تأكيد الإلغاء', cancelWarn: 'سيُلغى الطلب. المخزون المستلم سابقاً يبقى كما هو.' },
    rcv: { title: 'تسجيل الاستلام', warn: 'الكميات المؤكدة تُضاف مباشرة إلى مخزونك. عُدّ البضاعة قبل التأكيد.', product: 'المنتج', remaining: 'المتبقي', now: 'المستلم الآن', all: 'استلام الكل', submit: 'تأكيد الاستلام', nothing: 'أدخل كمية واحدة على الأقل.' },
    form: { title: 'طلب شراء جديد', supplier: 'المورد', chooseSupplier: 'اختر مورداً', expected: 'التسليم المتوقع', notes: 'ملاحظات', notesPh: 'شروط، مرجع المورد…', items: 'المنتجات', addLine: 'إضافة منتج', product: 'المنتج', chooseProduct: 'اختر منتجاً', qty: 'الكمية', unitCost: 'سعر التكلفة (درهم)', remove: 'حذف السطر', noLines: 'أضف منتجاً واحداً على الأقل.', total: 'المجموع', create: 'إنشاء المسودة', noSuppliers: 'لا يوجد مورد نشط. أضف مورداً قبل الطلب.', goSuppliers: 'الذهاب إلى الموردين', optional: 'اختياري' },
    sc: { name: 'الاسم', phone: 'الهاتف', email: 'البريد الإلكتروني', address: 'العنوان', status: 'الحالة' },
    active: 'نشط', inactive: 'غير نشط', edit: 'تعديل', editLabel: (n) => `تعديل ${n}`, search: 'ابحث عن مورد…',
    suppliersEmpty: 'لا يوجد موردون. أضف أول مورد.', suppliersNoMatch: 'لا يوجد مورد مطابق لهذا البحث.', clear: 'مسح البحث',
    suppliersCount: (n) => (n === 1 ? 'مورد واحد' : n === 2 ? 'موردان' : n <= 10 ? `${n} موردين` : `${n} مورداً`),
    sform: { add: 'مورد جديد', edit: 'تعديل المورد', name: 'الاسم', namePh: 'مثال: خضر سوس', phone: 'الهاتف', email: 'البريد الإلكتروني', address: 'العنوان', addressPh: 'مثال: سوق الجملة، الدار البيضاء', notes: 'ملاحظات', notesPh: 'آجال التسليم، شروط الدفع…', active: 'مورد نشط', activeHint: 'لا يمكن إرسال طلبات إلى مورد غير نشط.', save: 'حفظ', create: 'إضافة' },
    toast: { orderCreated: 'تم إنشاء طلب الشراء', sent: 'تم تحديد الطلب كمُرسَل', received: 'تم تسجيل الاستلام وتحديث المخزون', cancelled: 'تم إلغاء الطلب', supplierAdded: 'تمت إضافة المورد', supplierSaved: 'تم حفظ المورد' },
    err: {
      supplierId_required: 'اختر مورداً.', items_required: 'أضف منتجاً واحداً على الأقل.', item_missing_productId: 'اختر منتجاً في كل سطر.',
      item_qty_must_be_positive_integer: 'يجب أن تكون الكميات أعداداً صحيحة موجبة.', item_unitCost_invalid: 'سعر التكلفة غير صالح.',
      supplier_not_found: 'المورد غير موجود.', supplier_inactive: 'هذا المورد غير نشط.', product_not_found: 'أحد المنتجات لم يعد موجوداً.', expectedAt_invalid_date: 'تاريخ التسليم غير صالح.',
      nothing_to_receive: 'لم يتبقَّ شيء للاستلام في هذا الطلب.', order_not_receivable: 'لم يعد بالإمكان استلام هذا الطلب.', invalid_transition: 'لا يمكن تنفيذ هذا الإجراء بهذه الحالة.',
      name_required: 'الاسم مطلوب.', name_too_long: 'الاسم طويل جداً (120 حرفاً كحد أقصى).', email_invalid: 'البريد الإلكتروني غير صحيح.', name_already_exists: 'يوجد مورد بهذا الاسم.',
      not_found: 'العنصر غير موجود.', offline: 'أنت غير متصل.', duplicate_product: 'لا يمكن تكرار المنتج نفسه.',
    },
    errGeneric: 'فشلت العملية. أعد المحاولة.',
  },
  en: {
    intro: 'Manage your suppliers and purchase orders; receiving updates your stock.', loading: 'Loading…',
    tabs: { orders: 'Purchase orders', suppliers: 'Suppliers' },
    kpi: { draft: 'Drafts to send', pending: 'Awaiting delivery', received: 'Received orders' },
    status: { draft: 'Draft', ordered: 'Sent', partial: 'Partial', received: 'Received', cancelled: 'Cancelled' }, allStatuses: 'All', statusFilter: 'Filter by status',
    newOrder: 'New purchase order', addSupplier: 'Add a supplier',
    oc: { ref: 'Ref.', supplier: 'Supplier', lines: 'Items', cost: 'Cost', status: 'Status', expected: 'Expected', created: 'Created' },
    lines: (n) => `${n} item${n === 1 ? '' : 's'}`, view: 'View', viewLabel: (r) => `View order ${r}`, send: 'Send', receive: 'Receive',
    ordersEmpty: 'No purchase orders yet. Create your first order with a supplier.', ordersNoMatch: 'No order with this status.', showAll: 'Show all',
    loadError: 'Could not load the data.', retry: 'Try again',
    prev: 'Previous', next: 'Next', page: (p, t) => `Page ${p} of ${t}`, close: 'Close', cancel: 'Cancel', back: 'Back',
    detail: { title: (r) => `Order ${r}`, product: 'Item', ordered: 'Ordered', received: 'Received', unitCost: 'Unit cost', total: 'Total', grandTotal: 'Order total', notes: 'Notes', expected: 'Expected delivery', sendToSupplier: 'Mark as sent', receive: 'Receive goods', cancelOrder: 'Cancel the order', confirmCancel: 'Confirm cancellation', cancelWarn: 'The order will be cancelled. Stock already received stays in place.' },
    rcv: { title: 'Receive goods', warn: 'Confirmed quantities are added straight to your stock. Count the delivery before confirming.', product: 'Item', remaining: 'Remaining', now: 'Received now', all: 'Receive everything', submit: 'Confirm receipt', nothing: 'Enter at least one quantity.' },
    form: { title: 'New purchase order', supplier: 'Supplier', chooseSupplier: 'Choose a supplier', expected: 'Expected delivery', notes: 'Notes', notesPh: 'Terms, supplier reference…', items: 'Items', addLine: 'Add an item', product: 'Item', chooseProduct: 'Choose an item', qty: 'Quantity', unitCost: 'Unit cost (MAD)', remove: 'Remove the line', noLines: 'Add at least one item to order.', total: 'Total', create: 'Create the draft', noSuppliers: 'No active supplier. Add one before ordering.', goSuppliers: 'Go to suppliers', optional: 'optional' },
    sc: { name: 'Name', phone: 'Phone', email: 'Email', address: 'Address', status: 'Status' },
    active: 'Active', inactive: 'Inactive', edit: 'Edit', editLabel: (n) => `Edit ${n}`, search: 'Search suppliers…',
    suppliersEmpty: 'No suppliers yet. Add your first supplier.', suppliersNoMatch: 'No supplier matches this search.', clear: 'Clear the search',
    suppliersCount: (n) => `${n} supplier${n === 1 ? '' : 's'}`,
    sform: { add: 'New supplier', edit: 'Edit supplier', name: 'Name', namePh: 'e.g. Souss Fresh Produce', phone: 'Phone', email: 'Email', address: 'Address', addressPh: 'e.g. Wholesale market, Casablanca', notes: 'Notes', notesPh: 'Lead times, payment terms…', active: 'Active supplier', activeHint: 'An inactive supplier cannot receive new orders.', save: 'Save', create: 'Add' },
    toast: { orderCreated: 'Purchase order created', sent: 'Order marked as sent', received: 'Receipt recorded — stock updated', cancelled: 'Order cancelled', supplierAdded: 'Supplier added', supplierSaved: 'Supplier saved' },
    err: {
      supplierId_required: 'Choose a supplier.', items_required: 'Add at least one item.', item_missing_productId: 'Choose an item on every line.',
      item_qty_must_be_positive_integer: 'Quantities must be positive whole numbers.', item_unitCost_invalid: 'The unit cost is not valid.',
      supplier_not_found: 'Supplier not found.', supplier_inactive: 'This supplier is inactive.', product_not_found: 'An item no longer exists.', expectedAt_invalid_date: 'The delivery date is not valid.',
      nothing_to_receive: 'Nothing left to receive on this order.', order_not_receivable: 'This order can no longer be received.', invalid_transition: 'That action is not possible with this status.',
      name_required: 'The name is required.', name_too_long: 'The name is too long (120 characters max).', email_invalid: 'The email address is not valid.', name_already_exists: 'A supplier already has this name.',
      not_found: 'Not found.', offline: 'You are offline.', duplicate_product: 'Each item can only appear once.',
    },
    errGeneric: 'That did not work. Try again.',
  },
};

/** API error codes, incl. the parameterised ones ("product_not_found:<id>") */
const errText = (c: Copy, code: string) => c.err[code] ?? c.err[code.split(':')[0]] ?? c.errGeneric;

const STATUS_TONE: Record<Status, string> = {
  draft: 'bg-[#F3F4F6] text-[#374151] ring-[#E5E7EB]',
  ordered: 'bg-[#EFF6FF] text-[#1E40AF] ring-[#BFDBFE]',
  partial: 'bg-[#FFFBEB] text-[#7A5600] ring-[#F0B429]/50',
  received: 'bg-[#F0FDF6] text-[#0F3D2A] ring-[#BBF7D0]',
  cancelled: 'bg-[#FEF2F2] text-[#991B1B] ring-[#FECACA]',
};

function StatusBadge({ status, lang }: { status: Status; lang: Lang }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${STATUS_TONE[status]}`} data-status={status}>{COPY[lang].status[status]}</span>;
}

function ActiveBadge({ active, lang }: { active: boolean; lang: Lang }) {
  const c = COPY[lang];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${active ? 'bg-[#F0FDF6] text-[#0F3D2A] ring-[#BBF7D0]' : 'bg-[#F3F4F6] text-[#6B7280] ring-[#E5E7EB]'}`} data-active={active ? '1' : '0'}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-[#16A34A]' : 'bg-[#9CA3AF]'}`} />
      {active ? c.active : c.inactive}
    </span>
  );
}

function Skeleton() {
  return <div className="space-y-2 p-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-[#F3F4F6]" />)}</div>;
}

function Empty({ icon, text, action }: { icon: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 px-5 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#F0FDF6] text-[#0F3D2A] ring-1 ring-[#D1FAE5]">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={icon} /></svg>
      </span>
      <p className="max-w-sm text-sm text-[#6B7280]">{text}</p>
      {action}
    </div>
  );
}

function Pager({ page, totalPages, onPage, lang, testId }: { page: number; totalPages: number; onPage: (p: number) => void; lang: Lang; testId: string }) {
  const c = COPY[lang];
  if (totalPages <= 1) return null;
  return (
    <nav className="flex items-center justify-center gap-2" aria-label={c.page(page, totalPages)} data-testid={testId}>
      <button type="button" onClick={() => onPage(Math.max(1, page - 1))} aria-disabled={page <= 1} className={BTN.secondary}>{c.prev}</button>
      <span className="px-2 text-sm tabular-nums text-[#6B7280]">{c.page(page, totalPages)}</span>
      <button type="button" onClick={() => onPage(Math.min(totalPages, page + 1))} aria-disabled={page >= totalPages} className={BTN.secondary}>{c.next}</button>
    </nav>
  );
}

const ICON_TRUCK = 'M3 6h11v9H3zM14 9h4l3 3v3h-7M7 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17 18.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z';
const ICON_STORE = 'M3 9l1.5-5h15L21 9M3 9h18M3 9v11h18V9M9 20v-6h6v6';

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PurchasesPage() {
  const { lang } = useLang();
  const c = COPY[lang];
  const [tab, setTab] = useState<Tab>('orders');
  const [counts, setCounts] = useState<Record<Status, number> | null>(null);
  const [version, setVersion] = useState(0); // bumps after every write → KPIs and lists reload
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [supplierEdit, setSupplierEdit] = useState<Supplier | 'new' | null>(null);
  const bump = () => setVersion((v) => v + 1);

  // KPIs from the API totals (one count per status), not from the page that happens to be loaded
  useEffect(() => {
    let alive = true;
    void Promise.all(STATUSES.map((s) => portalJson<{ total: number }>(`/api/portal/purchase-orders?status=${s}&limit=1`))).then((rs) => {
      if (!alive) return;
      if (rs.every((r) => r.ok)) setCounts(Object.fromEntries(STATUSES.map((s, i) => [s, (rs[i] as { data: { total: number } }).data.total ?? 0])) as Record<Status, number>);
    });
    return () => { alive = false; };
  }, [version]);

  const kpis = [
    { key: 'draft', label: c.kpi.draft, value: counts?.draft, tone: 'text-[#374151]' },
    { key: 'pending', label: c.kpi.pending, value: counts ? counts.ordered + counts.partial : undefined, tone: 'text-[#1E40AF]' },
    { key: 'received', label: c.kpi.received, value: counts?.received, tone: 'text-[#0F3D2A]' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#6B7280]">{c.intro}</p>
        {tab === 'orders'
          ? <button type="button" onClick={() => setNewOrderOpen(true)} className={BTN.primary} data-testid="order-new"><Plus />{c.newOrder}</button>
          : <button type="button" onClick={() => setSupplierEdit('new')} className={BTN.primary} data-testid="supplier-add"><Plus />{c.addSupplier}</button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.key} className={`${CARD} px-5 py-4`} data-testid={`kpi-${k.key}`}>
            <p className="text-xs font-semibold text-[#6B7280]">{k.label}</p>
            {k.value === undefined
              ? <div className="mt-2 h-7 w-12 animate-pulse rounded bg-[#F3F4F6]" />
              : <p className={`mt-1 text-2xl font-bold tabular-nums ${k.tone}`}>{int(k.value, lang)}</p>}
          </div>
        ))}
      </div>

      <div role="tablist" aria-label={c.tabs.orders + ' / ' + c.tabs.suppliers} className="inline-flex rounded-xl bg-[#F3F4F6] p-1">
        {(['orders', 'suppliers'] as const).map((t) => (
          <button
            key={t} type="button" role="tab" id={`tab-${t}`} aria-selected={tab === t} aria-controls={`panel-${t}`} onClick={() => setTab(t)} data-testid={`tab-${t}`}
            className={`min-h-[40px] rounded-lg px-4 text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B] ${tab === t ? 'bg-white text-[#0F3D2A] shadow-sm' : 'text-[#6B7280] hover:text-[#111827]'}`}
          >
            {c.tabs[t]}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'orders'
          ? <OrdersPanel lang={lang} version={version} onChanged={bump} onNew={() => setNewOrderOpen(true)} />
          : <SuppliersPanel lang={lang} version={version} onAdd={() => setSupplierEdit('new')} onEdit={setSupplierEdit} />}
      </div>

      <NewOrderDialog
        key={newOrderOpen ? 'order-open' : 'order-closed'} open={newOrderOpen} lang={lang}
        onClose={() => setNewOrderOpen(false)} onCreated={() => { setNewOrderOpen(false); bump(); }}
        onGoSuppliers={() => { setNewOrderOpen(false); setTab('suppliers'); }}
      />
      <SupplierDialog
        key={supplierEdit === null ? 'supplier-closed' : supplierEdit === 'new' ? 'supplier-new' : `supplier-${supplierEdit.id}`}
        supplier={supplierEdit} lang={lang} onClose={() => setSupplierEdit(null)} onSaved={() => { setSupplierEdit(null); bump(); }}
      />
    </div>
  );
}

function Plus() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>;
}

// ─── Orders ───────────────────────────────────────────────────────────────────
function OrdersPanel({ lang, version, onChanged, onNew }: { lang: Lang; version: number; onChanged: () => void; onNew: () => void }) {
  const c = COPY[lang];
  const { toast } = usePortal();
  const [status, setStatus] = useState<Status | ''>('');
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [detail, setDetail] = useState<Order | null>(null);
  const [receiving, setReceiving] = useState<Order | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const seq = useRef(0);

  const load = useCallback(() => {
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (status) q.set('status', status);
    const mine = ++seq.current;
    setLoading(true);
    void portalJson<{ orders: Order[]; total: number }>(`/api/portal/purchase-orders?${q}`).then((r) => {
      if (mine !== seq.current) return;
      setLoadError(!r.ok);
      if (r.ok) { setOrders(r.data.orders ?? []); setTotal(r.data.total ?? 0); }
      setLoading(false);
    });
  }, [page, status]);

  useEffect(() => {
    const t = setTimeout(load, 0);
    return () => clearTimeout(t);
  }, [load, version]);

  const transition = async (o: Order, next: 'ordered' | 'cancelled') => {
    if (busy) return;
    setBusy(o.id);
    const r = await portalJson<{ order: Order }>(`/api/portal/purchase-orders/${o.id}`, { method: 'PATCH', json: { status: next } });
    setBusy(null);
    if (!r.ok) { toast('error', errText(c, r.error)); return; }
    toast('success', next === 'ordered' ? c.toast.sent : c.toast.cancelled);
    if (detail?.id === o.id) setDetail(r.data.order);
    onChanged();
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const list = orders ?? [];

  return (
    <div className="space-y-4">
      <div role="group" aria-label={c.statusFilter} className="flex flex-wrap gap-2" data-testid="order-filters">
        {(['', ...STATUSES] as const).map((s) => (
          <button
            key={s || 'all'} type="button" aria-pressed={status === s} onClick={() => { setStatus(s); setPage(1); }} data-testid={`status-${s || 'all'}`}
            className={`min-h-[36px] rounded-full border px-3.5 text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B] ${status === s ? 'border-[#0F3D2A] bg-[#0F3D2A] text-white' : 'border-[#E5E7EB] bg-white text-[#374151] hover:border-[#D1D5DB]'}`}
          >
            {s ? c.status[s] : c.allStatuses}
          </button>
        ))}
      </div>

      <section className={`${CARD} overflow-hidden`} aria-busy={loading} data-testid="orders-list">
        {orders === null && loading ? <Skeleton /> : loadError ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <p className="text-sm text-[#B91C1C]">{c.loadError}</p>
            <button type="button" onClick={load} className={BTN.secondary}>{c.retry}</button>
          </div>
        ) : list.length === 0 ? (
          <div data-testid="orders-empty">
            <Empty icon={ICON_TRUCK} text={status ? c.ordersNoMatch : c.ordersEmpty} action={status
              ? <button type="button" onClick={() => { setStatus(''); setPage(1); }} className={BTN.secondary}>{c.showAll}</button>
              : <button type="button" onClick={onNew} className={BTN.primary}>{c.newOrder}</button>} />
          </div>
        ) : (
          <>
            <div className={`hidden overflow-x-auto md:block ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full text-sm">
                <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#6B7280]">
                  <tr>
                    {[c.oc.ref, c.oc.supplier, c.oc.lines].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-5 py-3 text-start">{h}</th>)}
                    <th scope="col" className="whitespace-nowrap px-5 py-3 text-end">{c.oc.cost}</th>
                    {[c.oc.status, c.oc.expected, c.oc.created].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-5 py-3 text-start">{h}</th>)}
                    <th scope="col" className="px-5 py-3"><span className="sr-only">{c.view}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {list.map((o) => (
                    <tr key={o.id} data-order={o.id} className="cursor-pointer transition-colors hover:bg-[#FAFAFB]" onClick={() => setDetail(o)}>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-[13px] text-[#6B7280]" dir="ltr">{ref(o.id)}</td>
                      <td className="max-w-[14rem] truncate px-5 py-3 font-medium text-[#111827]">{o.supplierName}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-[#6B7280]">{c.lines(o.items.length)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-end font-semibold tabular-nums text-[#111827]">{money(o.totalCost, lang)}</td>
                      <td className="px-5 py-3"><StatusBadge status={o.status} lang={lang} /></td>
                      <td className="whitespace-nowrap px-5 py-3 text-[#6B7280]">{o.expectedAt ? longDate(o.expectedAt, lang) : '—'}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-[#6B7280]">{longDate(o.createdAt, lang)}</td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          {o.status === 'draft' && <button type="button" onClick={() => void transition(o, 'ordered')} aria-disabled={busy === o.id} className={`${BTN.secondary} min-h-[34px] px-3 text-xs`} data-testid="order-send">{c.send}</button>}
                          {(o.status === 'ordered' || o.status === 'partial') && <button type="button" onClick={() => setReceiving(o)} className={`${BTN.primary} min-h-[34px] px-3 text-xs`} data-testid="order-receive">{c.receive}</button>}
                          <button type="button" onClick={() => setDetail(o)} aria-label={c.viewLabel(ref(o.id))} className={`${BTN.secondary} min-h-[34px] px-3 text-xs`}>{c.view}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className={`divide-y divide-[#F3F4F6] md:hidden ${loading ? 'opacity-60' : ''}`}>
              {list.map((o) => (
                <li key={o.id} data-order={o.id}>
                  <button type="button" onClick={() => setDetail(o)} aria-label={c.viewLabel(ref(o.id))} className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[#FAFAFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#111827]">{o.supplierName}</span>
                      <span className="block text-xs text-[#6B7280]"><span className="font-mono" dir="ltr">{ref(o.id)}</span> · {c.lines(o.items.length)} · {longDate(o.createdAt, lang)}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold tabular-nums text-[#111827]">{money(o.totalCost, lang)}</span>
                      <StatusBadge status={o.status} lang={lang} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {list.length > 0 && <Pager page={page} totalPages={totalPages} onPage={setPage} lang={lang} testId="orders-pagination" />}

      <OrderDialog
        key={`detail-${detail?.id ?? 'none'}`} order={detail} lang={lang} busy={!!detail && busy === detail.id}
        onClose={() => setDetail(null)}
        onSend={(o) => void transition(o, 'ordered')}
        onCancelOrder={(o) => void transition(o, 'cancelled')}
        onReceive={(o) => { setDetail(null); setReceiving(o); }}
      />
      <ReceiveDialog
        key={`receive-${receiving?.id ?? 'none'}`} order={receiving} lang={lang}
        onClose={() => setReceiving(null)}
        onDone={(o) => { setReceiving(null); setDetail(o); toast('success', c.toast.received); onChanged(); }}
      />
    </div>
  );
}

function OrderDialog({ order, lang, busy, onClose, onSend, onCancelOrder, onReceive }: {
  order: Order | null; lang: Lang; busy: boolean; onClose: () => void;
  onSend: (o: Order) => void; onCancelOrder: (o: Order) => void; onReceive: (o: Order) => void;
}) {
  const c = COPY[lang];
  const d = c.detail;
  const [confirming, setConfirming] = useState(false);
  if (!order) return null;
  const open = order.status === 'ordered' || order.status === 'partial';
  const cancellable = order.status === 'draft' || open;

  return (
    <PortalDialog
      open onClose={onClose} title={d.title(ref(order.id))} size="lg" closeLabel={c.close} testId="order-detail"
      description={<span className="flex flex-wrap items-center gap-2"><span className="font-medium text-[#374151]">{order.supplierName}</span><StatusBadge status={order.status} lang={lang} /><span>{longDate(order.createdAt, lang)}</span></span>}
      footer={confirming ? (
        <>
          <p className="me-auto text-sm text-[#B91C1C]">{d.cancelWarn}</p>
          <button type="button" onClick={() => setConfirming(false)} className={BTN.secondary}>{c.back}</button>
          <button type="button" onClick={() => onCancelOrder(order)} aria-disabled={busy} className={BTN.danger} data-testid="order-cancel-confirm">{d.confirmCancel}</button>
        </>
      ) : (
        <>
          {cancellable && <button type="button" onClick={() => setConfirming(true)} className={`${BTN.secondary} me-auto text-[#B91C1C]`} data-testid="order-cancel">{d.cancelOrder}</button>}
          {order.status === 'draft' && <button type="button" onClick={() => onSend(order)} aria-disabled={busy} className={BTN.primary} data-testid="order-detail-send">{d.sendToSupplier}</button>}
          {open && <button type="button" onClick={() => onReceive(order)} className={BTN.primary} data-testid="order-detail-receive">{d.receive}</button>}
          {!cancellable && <button type="button" onClick={onClose} className={BTN.secondary}>{c.close}</button>}
        </>
      )}
    >
      <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
        <table className="w-full text-sm" data-testid="order-items">
          <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#6B7280]">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-start">{d.product}</th>
              <th scope="col" className="px-3 py-2.5 text-end">{d.ordered}</th>
              <th scope="col" className="px-3 py-2.5 text-end">{d.received}</th>
              <th scope="col" className="hidden px-3 py-2.5 text-end sm:table-cell">{d.unitCost}</th>
              <th scope="col" className="px-4 py-2.5 text-end">{d.total}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {order.items.map((it) => {
              const done = it.qtyReceived >= it.qtyOrdered;
              return (
                <tr key={it.productId} data-product={it.productName}>
                  <td className="px-4 py-2.5">
                    <span className="block font-medium text-[#111827]">{it.productName}</span>
                    {it.productPlu && <span className="block font-mono text-xs text-[#9CA3AF]" dir="ltr">{it.productPlu}</span>}
                  </td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-[#374151]">{int(it.qtyOrdered, lang)}</td>
                  <td className={`px-3 py-2.5 text-end font-semibold tabular-nums ${done ? 'text-[#0F7A45]' : it.qtyReceived > 0 ? 'text-[#B45309]' : 'text-[#9CA3AF]'}`} data-received={it.qtyReceived}>
                    {int(it.qtyReceived, lang)}{done && <span aria-hidden="true"> ✓</span>}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 text-end tabular-nums text-[#6B7280] sm:table-cell">{money(it.unitCost, lang)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end font-semibold tabular-nums text-[#111827]">{money(it.unitCost * it.qtyOrdered, lang)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-[#E5E7EB] bg-[#F9FAFB]">
            <tr>
              <td colSpan={2} className="px-4 py-3 font-bold text-[#111827] sm:hidden">{d.grandTotal}</td>
              <td colSpan={4} className="hidden px-4 py-3 font-bold text-[#111827] sm:table-cell">{d.grandTotal}</td>
              <td className="whitespace-nowrap px-4 py-3 text-end font-bold tabular-nums text-[#0F3D2A]" data-testid="order-total">{money(order.totalCost, lang)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {(order.expectedAt || order.notes) && (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {order.expectedAt && <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5"><dt className="text-xs text-[#6B7280]">{d.expected}</dt><dd className="mt-1 text-sm font-semibold text-[#111827]">{longDate(order.expectedAt, lang)}</dd></div>}
          {order.notes && <div className="rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5"><dt className="text-xs text-[#6B7280]">{d.notes}</dt><dd className="mt-1 whitespace-pre-line text-sm text-[#111827]">{order.notes}</dd></div>}
        </dl>
      )}
    </PortalDialog>
  );
}

function ReceiveDialog({ order, lang, onClose, onDone }: { order: Order | null; lang: Lang; onClose: () => void; onDone: (o: Order) => void }) {
  const c = COPY[lang];
  const r = c.rcv;
  const lines = (order?.items ?? []).filter((i) => i.qtyReceived < i.qtyOrdered);
  const [qty, setQty] = useState<Record<string, string>>(() => Object.fromEntries(lines.map((i) => [i.productId, String(i.qtyOrdered - i.qtyReceived)])));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (!order) return null;

  const submit = async () => {
    if (saving) return; // never post the same delivery twice
    const items = lines
      .map((i) => ({ productId: i.productId, qtyReceive: Math.min(i.qtyOrdered - i.qtyReceived, Math.max(0, Math.floor(Number(qty[i.productId]) || 0))) }))
      .filter((i) => i.qtyReceive > 0);
    if (items.length === 0) { setError(r.nothing); return; }
    setSaving(true); setError('');
    const res = await portalJson<{ order: Order }>(`/api/portal/purchase-orders/${order.id}/receive`, { method: 'POST', json: { items } });
    setSaving(false);
    if (res.ok) onDone(res.data.order); else setError(errText(c, res.error));
  };

  return (
    <PortalDialog
      open onClose={onClose} title={r.title} description={`${order.supplierName} · ${ref(order.id)}`} size="md" closeLabel={c.close} testId="order-receive-dialog"
      footer={<>
        <button type="button" onClick={onClose} className={BTN.secondary}>{c.cancel}</button>
        <button type="button" onClick={() => void submit()} aria-disabled={saving} className={BTN.primary} data-testid="receive-submit">{saving ? '…' : r.submit}</button>
      </>}
    >
      <p className="mb-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-2.5 text-sm text-[#7A5600]">{r.warn}</p>
      <div className="overflow-hidden rounded-xl border border-[#E5E7EB]">
        <table className="w-full text-sm">
          <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#6B7280]">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-start">{r.product}</th>
              <th scope="col" className="px-3 py-2.5 text-end">{r.remaining}</th>
              <th scope="col" className="w-28 px-4 py-2.5 text-end">{r.now}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {lines.map((i) => {
              const remaining = i.qtyOrdered - i.qtyReceived;
              return (
                <tr key={i.productId}>
                  <td className="px-4 py-2.5 font-medium text-[#111827]">{i.productName}</td>
                  <td className="px-3 py-2.5 text-end tabular-nums text-[#6B7280]">{int(remaining, lang)}</td>
                  <td className="px-4 py-2">
                    <label className="sr-only" htmlFor={`rcv-${i.productId}`}>{`${r.now} — ${i.productName}`}</label>
                    <input
                      id={`rcv-${i.productId}`} type="number" inputMode="numeric" min={0} max={remaining} step={1} dir="ltr"
                      value={qty[i.productId] ?? ''} onChange={(e) => setQty((q) => ({ ...q, [i.productId]: e.target.value }))}
                      className={`${FIELD} min-h-[40px] text-center tabular-nums`} data-testid="receive-qty" data-product={i.productName}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && <p role="alert" className="mt-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#B91C1C]" data-testid="receive-error">{error}</p>}
    </PortalDialog>
  );
}

interface Line { key: number; productId: string; qty: string; unitCost: string }

function NewOrderDialog({ open, lang, onClose, onCreated, onGoSuppliers }: { open: boolean; lang: Lang; onClose: () => void; onCreated: () => void; onGoSuppliers: () => void }) {
  const c = COPY[lang];
  const f = c.form;
  const { toast } = usePortal();
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [expected, setExpected] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const nextKey = useRef(1);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void Promise.all([
      portalJson<{ suppliers: Supplier[] }>('/api/portal/suppliers?limit=100'),
      portalJson<{ products: Product[] }>('/api/portal/products?limit=100'),
    ]).then(([s, p]) => {
      if (!alive) return;
      setSuppliers(s.ok ? (s.data.suppliers ?? []).filter((x) => x.isActive) : []);
      setProducts(p.ok ? p.data.products ?? [] : []);
    });
    return () => { alive = false; };
  }, [open]);

  const addLine = () => setLines((ls) => [...ls, { key: nextKey.current++, productId: '', qty: '1', unitCost: '' }]);
  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => {
    if (l.key !== key) return l;
    const next = { ...l, ...patch };
    // Pre-fill the cost from the catalogue when an item is picked and no cost was typed yet
    if (patch.productId && !l.unitCost) {
      const cost = products.find((p) => p.id === patch.productId)?.costPrice;
      if (cost) next.unitCost = String(cost);
    }
    return next;
  }));
  const total = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0), 0);

  const save = async () => {
    if (saving) return;
    if (!supplierId) return setError(c.err.supplierId_required);
    if (lines.length === 0) return setError(c.err.items_required);
    if (lines.some((l) => !l.productId)) return setError(c.err.item_missing_productId);
    if (new Set(lines.map((l) => l.productId)).size !== lines.length) return setError(c.err.duplicate_product);
    if (lines.some((l) => !/^\d+$/.test(l.qty.trim()) || Number(l.qty) < 1)) return setError(c.err.item_qty_must_be_positive_integer);
    if (lines.some((l) => l.unitCost.trim() !== '' && !(Number(l.unitCost) >= 0))) return setError(c.err.item_unitCost_invalid);
    setSaving(true); setError('');
    const r = await portalJson('/api/portal/purchase-orders', {
      method: 'POST',
      json: {
        supplierId,
        items: lines.map((l) => ({ productId: l.productId, qtyOrdered: Number(l.qty), unitCost: Number(l.unitCost) || 0 })),
        notes: notes.trim() || undefined,
        expectedAt: expected || undefined,
      },
    });
    setSaving(false);
    if (r.ok) { toast('success', c.toast.orderCreated); onCreated(); } else setError(errText(c, r.error));
  };

  const chosen = new Set(lines.map((l) => l.productId));
  return (
    <PortalDialog
      open={open} onClose={onClose} title={f.title} size="xl" closeLabel={c.close} testId="order-form"
      footer={<>
        <p className="me-auto text-sm text-[#6B7280]">{f.total} : <span className="font-bold tabular-nums text-[#0F3D2A]" data-testid="order-form-total">{money(total, lang)}</span></p>
        <button type="button" onClick={onClose} className={BTN.secondary}>{c.cancel}</button>
        <button type="button" onClick={() => void save()} aria-disabled={saving} className={BTN.primary} data-testid="order-save">{saving ? '…' : f.create}</button>
      </>}
    >
      {suppliers !== null && suppliers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center" data-testid="order-form-no-suppliers">
          <p className="text-sm text-[#6B7280]">{f.noSuppliers}</p>
          <button type="button" onClick={onGoSuppliers} className={BTN.secondary}>{f.goSuppliers}</button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="sm:col-span-1"><span className={LABEL}>{f.supplier} *</span>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={FIELD} data-testid="order-supplier" autoFocus>
                <option value="">{suppliers === null ? c.loading : f.chooseSupplier}</option>
                {(suppliers ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label><span className={LABEL}>{f.expected} <span className="font-normal text-[#9CA3AF]">({f.optional})</span></span>
              <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)} className={FIELD} data-testid="order-expected" />
            </label>
            <label><span className={LABEL}>{f.notes} <span className="font-normal text-[#9CA3AF]">({f.optional})</span></span>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={f.notesPh} className={FIELD} data-testid="order-notes" />
            </label>
          </div>

          <fieldset>
            <div className="mb-2 flex items-center justify-between gap-3">
              <legend className={`${LABEL} mb-0`}>{f.items} *</legend>
              <button type="button" onClick={addLine} className={`${BTN.secondary} min-h-[36px] px-3 text-xs`} data-testid="order-add-line"><Plus />{f.addLine}</button>
            </div>
            {lines.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#D1D5DB] px-4 py-6 text-center text-sm text-[#9CA3AF]">{f.noLines}</p>
            ) : (
              <ul className="space-y-2" data-testid="order-lines">
                {lines.map((l, idx) => (
                  <li key={l.key} className="grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-[#E5E7EB] p-3 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_auto] sm:items-end">
                    <label className="col-span-2 sm:col-span-1"><span className={`${LABEL} text-xs`}>{f.product}</span>
                      <select value={l.productId} onChange={(e) => setLine(l.key, { productId: e.target.value })} className={FIELD} data-testid="line-product" aria-label={`${f.product} ${idx + 1}`}>
                        <option value="">{f.chooseProduct}</option>
                        {products.map((p) => <option key={p.id} value={p.id} disabled={p.id !== l.productId && chosen.has(p.id)}>{p.name} ({p.plu})</option>)}
                      </select>
                    </label>
                    <label><span className={`${LABEL} text-xs`}>{f.qty}</span>
                      <input type="number" inputMode="numeric" min={1} step={1} dir="ltr" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} className={`${FIELD} text-center tabular-nums`} data-testid="line-qty" />
                    </label>
                    <label><span className={`${LABEL} text-xs`}>{f.unitCost}</span>
                      <input type="number" inputMode="decimal" min={0} step="0.01" dir="ltr" value={l.unitCost} onChange={(e) => setLine(l.key, { unitCost: e.target.value })} placeholder="0.00" className={`${FIELD} text-end tabular-nums`} data-testid="line-cost" />
                    </label>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label={`${f.remove} ${idx + 1}`} className="col-start-2 row-start-2 grid h-10 w-10 place-items-center self-end rounded-lg text-[#B91C1C] transition-colors hover:bg-[#FEF2F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B] sm:col-start-auto sm:row-start-auto" data-testid="line-remove">
                      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
          {error && <p role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#B91C1C]" data-testid="order-error">{error}</p>}
        </div>
      )}
    </PortalDialog>
  );
}

// ─── Suppliers ────────────────────────────────────────────────────────────────
function SuppliersPanel({ lang, version, onAdd, onEdit }: { lang: Lang; version: number; onAdd: () => void; onEdit: (s: Supplier) => void }) {
  const c = COPY[lang];
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [suppliers, setSuppliers] = useState<Supplier[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const seq = useRef(0);

  const load = useCallback(() => {
    const q = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (search.trim()) q.set('search', search.trim());
    const mine = ++seq.current;
    setLoading(true);
    void portalJson<{ suppliers: Supplier[]; total: number }>(`/api/portal/suppliers?${q}`).then((r) => {
      if (mine !== seq.current) return;
      setLoadError(!r.ok);
      if (r.ok) { setSuppliers(r.data.suppliers ?? []); setTotal(r.data.total ?? 0); }
      setLoading(false);
    });
  }, [page, search]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load, version]);

  const list = suppliers ?? [];
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-4">
      <div className={`${CARD} flex flex-wrap items-center justify-between gap-3 p-3`}>
        <label className="relative block w-full max-w-md">
          <span className="sr-only">{c.search}</span>
          <span className="pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-[#9CA3AF]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.5-3.5" /></svg>
          </span>
          <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={c.search} className={`${FIELD} ps-9`} data-testid="suppliers-search" />
        </label>
        {suppliers !== null && total > 0 && <p className="pe-2 text-sm text-[#6B7280]" data-testid="suppliers-count">{c.suppliersCount(total)}</p>}
      </div>

      <section className={`${CARD} overflow-hidden`} aria-busy={loading} data-testid="suppliers-list">
        {suppliers === null && loading ? <Skeleton /> : loadError ? (
          <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
            <p className="text-sm text-[#B91C1C]">{c.loadError}</p>
            <button type="button" onClick={load} className={BTN.secondary}>{c.retry}</button>
          </div>
        ) : list.length === 0 ? (
          <div data-testid="suppliers-empty">
            <Empty icon={ICON_STORE} text={search ? c.suppliersNoMatch : c.suppliersEmpty} action={search
              ? <button type="button" onClick={() => { setSearch(''); setPage(1); }} className={BTN.secondary}>{c.clear}</button>
              : <button type="button" onClick={onAdd} className={BTN.primary}>{c.addSupplier}</button>} />
          </div>
        ) : (
          <>
            <div className={`hidden overflow-x-auto md:block ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full text-sm">
                <thead className="bg-[#F9FAFB] text-xs font-semibold text-[#6B7280]">
                  <tr>
                    {[c.sc.name, c.sc.phone, c.sc.email, c.sc.address, c.sc.status].map((h) => <th key={h} scope="col" className="whitespace-nowrap px-5 py-3 text-start">{h}</th>)}
                    <th scope="col" className="px-5 py-3"><span className="sr-only">{c.edit}</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {list.map((s) => (
                    <tr key={s.id} data-supplier={s.name} className={s.isActive ? '' : 'bg-[#FAFAFB]'}>
                      <td className="max-w-[14rem] truncate px-5 py-3 font-medium text-[#111827]">{s.name}</td>
                      <td className="whitespace-nowrap px-5 py-3 font-mono text-[13px] text-[#374151]"><span dir="ltr">{s.phone || '—'}</span></td>
                      <td className="max-w-[14rem] truncate px-5 py-3 text-[#6B7280]" dir={s.email ? 'ltr' : undefined}>{s.email || '—'}</td>
                      <td className="max-w-[16rem] truncate px-5 py-3 text-[#6B7280]">{s.address || '—'}</td>
                      <td className="px-5 py-3"><ActiveBadge active={s.isActive} lang={lang} /></td>
                      <td className="px-5 py-3 text-end">
                        <button type="button" onClick={() => onEdit(s)} aria-label={c.editLabel(s.name)} className={`${BTN.secondary} min-h-[34px] px-3 text-xs`} data-testid="supplier-edit">{c.edit}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className={`divide-y divide-[#F3F4F6] md:hidden ${loading ? 'opacity-60' : ''}`}>
              {list.map((s) => (
                <li key={s.id} data-supplier={s.name}>
                  <button type="button" onClick={() => onEdit(s)} aria-label={c.editLabel(s.name)} className="flex w-full items-center gap-3 px-4 py-3 text-start transition-colors hover:bg-[#FAFAFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#B8860B]">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[#111827]">{s.name}</span>
                      <span className="block truncate text-xs text-[#6B7280]"><span dir="ltr">{s.phone || s.email || '—'}</span></span>
                    </span>
                    <ActiveBadge active={s.isActive} lang={lang} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {list.length > 0 && <Pager page={page} totalPages={totalPages} onPage={setPage} lang={lang} testId="suppliers-pagination" />}
    </div>
  );
}

function SupplierDialog({ supplier, lang, onClose, onSaved }: { supplier: Supplier | 'new' | null; lang: Lang; onClose: () => void; onSaved: () => void }) {
  const c = COPY[lang];
  const s = c.sform;
  const { toast } = usePortal();
  const editing = supplier && supplier !== 'new' ? supplier : null;
  const [f, setF] = useState({
    name: editing?.name ?? '', phone: editing?.phone ?? '', email: editing?.email ?? '',
    address: editing?.address ?? '', notes: editing?.notes ?? '', isActive: editing?.isActive ?? true,
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (!supplier) return null;
  const set = (k: 'name' | 'phone' | 'email' | 'address' | 'notes') => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  const save = async () => {
    if (saving) return;
    if (!f.name.trim()) return setError(c.err.name_required);
    setSaving(true); setError('');
    const body = {
      name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), address: f.address.trim(), notes: f.notes.trim(),
      ...(editing ? { isActive: f.isActive } : {}),
    };
    // New suppliers: omit empty optional fields; edits send them so a field can be cleared
    const json = editing ? body : Object.fromEntries(Object.entries(body).filter(([, v]) => v !== ''));
    const r = await portalJson(editing ? `/api/portal/suppliers/${editing.id}` : '/api/portal/suppliers', { method: editing ? 'PATCH' : 'POST', json });
    setSaving(false);
    if (r.ok) { toast('success', editing ? c.toast.supplierSaved : c.toast.supplierAdded); onSaved(); } else setError(errText(c, r.error));
  };

  return (
    <PortalDialog
      open onClose={onClose} title={editing ? s.edit : s.add} closeLabel={c.close} testId="supplier-form"
      footer={<>
        <button type="button" onClick={onClose} className={BTN.secondary}>{c.cancel}</button>
        <button type="button" onClick={() => void save()} aria-disabled={saving} className={BTN.primary} data-testid="supplier-save">{saving ? '…' : editing ? s.save : s.create}</button>
      </>}
    >
      <form onSubmit={(e) => { e.preventDefault(); void save(); }} className="grid gap-4 sm:grid-cols-2" noValidate>
        <label className="sm:col-span-2"><span className={LABEL}>{s.name} *</span><input value={f.name} onChange={set('name')} placeholder={s.namePh} maxLength={120} className={FIELD} autoFocus data-testid="s-name" /></label>
        <label><span className={LABEL}>{s.phone}</span><input type="tel" inputMode="tel" value={f.phone} onChange={set('phone')} placeholder="05 22 00 00 00" dir="ltr" className={`${FIELD} text-end`} data-testid="s-phone" /></label>
        <label><span className={LABEL}>{s.email}</span><input type="email" value={f.email} onChange={set('email')} placeholder="contact@fournisseur.ma" dir="ltr" className={`${FIELD} text-end`} data-testid="s-email" /></label>
        <label className="sm:col-span-2"><span className={LABEL}>{s.address}</span><input value={f.address} onChange={set('address')} placeholder={s.addressPh} className={FIELD} data-testid="s-address" /></label>
        <label className="sm:col-span-2"><span className={LABEL}>{s.notes}</span><input value={f.notes} onChange={set('notes')} placeholder={s.notesPh} className={FIELD} /></label>
        {editing && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-3 sm:col-span-2">
            <input type="checkbox" checked={f.isActive} onChange={(e) => setF((x) => ({ ...x, isActive: e.target.checked }))} className="mt-0.5 h-5 w-5 shrink-0 accent-[#0F3D2A]" data-testid="s-active" />
            <span><span className="block text-sm font-semibold text-[#111827]">{s.active}</span><span className="block text-xs text-[#6B7280]">{s.activeHint}</span></span>
          </label>
        )}
        {error && <p role="alert" className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#B91C1C] sm:col-span-2" data-testid="supplier-error">{error}</p>}
        <button type="submit" className="hidden" />
      </form>
    </PortalDialog>
  );
}
