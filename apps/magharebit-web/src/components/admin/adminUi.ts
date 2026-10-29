// Small helpers shared by the admin tables (kept separate from the components so they stay pure).

export type Lang = 'ar' | 'fr' | 'en';

/** Form control used across the admin tables (theme variables, 44px touch target). */
export const FIELD =
  'min-h-[44px] w-full rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-field)] px-3 text-sm text-[var(--adm-text)] ' +
  'focus:border-[var(--adm-accent)] focus:outline-none focus:ring-2 focus:ring-[#F0B429]/40 sm:w-auto';

export const BTN =
  'min-h-[44px] rounded-[4px] border border-[var(--adm-border)] bg-[var(--adm-surface)] px-4 text-sm font-semibold text-[var(--adm-text)] ' +
  'hover:border-[var(--adm-accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--adm-accent)] disabled:opacity-50';

export const BTN_PRIMARY =
  'min-h-[44px] rounded-[4px] bg-[var(--adm-primary)] px-4 text-sm font-bold text-[var(--adm-primary-text)] ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--adm-accent)] disabled:opacity-60';

/** dd/mm/yyyy in every language (Western digits; Arabic locales add bidi marks that scramble it). */
export function fmtDate(value: string | Date | undefined | null, lang: Lang): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'fr-FR');
}

/**
 * The `?q=` of the current URL, so a global-search result can open a table already filtered.
 * Admin pages render only after the client-side session check, so `window` always exists here.
 */
export function initialQuery(): string {
  if (typeof window === 'undefined') return '';
  return (new URLSearchParams(window.location.search).get('q') ?? '').slice(0, 100);
}

/** Text folded for loose matching: lower case, no accents or tashkeel, Arabic letter variants unified. */
export function foldText(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .toLowerCase().replace(/\s+/g, ' ').trim();
}

export function daysLeft(value: string | Date | undefined | null): number | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export const PLANS = ['Starter', 'Business', 'Enterprise'] as const;
export const DURATIONS = [1, 3, 6, 12, 24] as const;

export const PLAN_STYLE: Record<string, string> = {
  Starter: 'bg-[#E0E7FF] text-[#3730A3]',
  Business: 'bg-[#DCFCE7] text-[#166534]',
  Enterprise: 'bg-[#FEF3C7] text-[#92400E]',
};

/** Shop types: the sign-up sectors plus the lead business types. */
export const SECTOR_LABEL: Record<Lang, Record<string, string>> = {
  ar: { 'cafe-restaurant': 'مقهى / مطعم', cafe: 'مقهى', restaurant: 'مطعم', epicerie: 'بقالة', grocery: 'بقالة', boulangerie: 'مخبزة', bakery: 'مخبزة', boucherie: 'جزارة', pharmacie: 'صيدلية', pharmacy: 'صيدلية', textile: 'ملابس', fashion: 'ملابس', electronique: 'إلكترونيات', beauty: 'تجميل', vegetables: 'خضر وفواكه', general: 'متجر عام', multi: 'متعدد الأنشطة', other: 'أخرى' },
  fr: { 'cafe-restaurant': 'Café / Restaurant', cafe: 'Café', restaurant: 'Restaurant', epicerie: 'Épicerie', grocery: 'Épicerie', boulangerie: 'Boulangerie', bakery: 'Boulangerie', boucherie: 'Boucherie', pharmacie: 'Pharmacie', pharmacy: 'Pharmacie', textile: 'Textile', fashion: 'Mode', electronique: 'Électronique', beauty: 'Beauté', vegetables: 'Fruits et légumes', general: 'Commerce général', multi: 'Multi-activités', other: 'Autre' },
  en: { 'cafe-restaurant': 'Café / Restaurant', cafe: 'Café', restaurant: 'Restaurant', epicerie: 'Grocery', grocery: 'Grocery', boulangerie: 'Bakery', bakery: 'Bakery', boucherie: 'Butcher', pharmacie: 'Pharmacy', pharmacy: 'Pharmacy', textile: 'Clothing', fashion: 'Fashion', electronique: 'Electronics', beauty: 'Beauty', vegetables: 'Fruit and vegetables', general: 'General store', multi: 'Multi-activity', other: 'Other' },
};

/** Record statuses, worded as the tables show them. Shared by the tables and the Ctrl+K search results. */
export type StatusKind = 'merchant' | 'license' | 'lead' | 'coupon';
export const STATUS_LABEL: Record<Lang, Record<StatusKind, Record<string, string>>> = {
  ar: {
    merchant: { approved: 'نشط', pending: 'قيد الانتظار', suspended: 'معلّق' },
    license: { active: 'نشط', expired: 'منتهي', revoked: 'ملغى' },
    lead: { new: 'جديد', contacted: 'تم التواصل', converted: 'محوّل', rejected: 'مرفوض', activated: 'مُفعَّل' },
    coupon: { active: 'نشطة', inactive: 'متوقفة' },
  },
  fr: {
    merchant: { approved: 'Actif', pending: 'En attente', suspended: 'Suspendu' },
    license: { active: 'Active', expired: 'Expirée', revoked: 'Révoquée' },
    lead: { new: 'Nouveau', contacted: 'Contacté', converted: 'Converti', rejected: 'Refusé', activated: 'Activé' },
    coupon: { active: 'Actif', inactive: 'Désactivé' },
  },
  en: {
    merchant: { approved: 'Active', pending: 'Pending', suspended: 'Suspended' },
    license: { active: 'Active', expired: 'Expired', revoked: 'Revoked' },
    lead: { new: 'New', contacted: 'Contacted', converted: 'Converted', rejected: 'Rejected', activated: 'Activated' },
    coupon: { active: 'Active', inactive: 'Disabled' },
  },
};

/** Filter choices (sign-up sectors). */
export const SECTOR_FILTER = ['epicerie', 'cafe-restaurant', 'boulangerie', 'boucherie', 'pharmacie', 'textile', 'electronique', 'other'] as const;
