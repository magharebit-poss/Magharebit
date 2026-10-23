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
  ar: { 'cafe-restaurant': 'مقهى / مطعم', cafe: 'مقهى', restaurant: 'مطعم', epicerie: 'بقالة', grocery: 'بقالة', boulangerie: 'مخبزة', bakery: 'مخبزة', boucherie: 'جزارة', pharmacie: 'صيدلية', pharmacy: 'صيدلية', textile: 'ملابس', electronique: 'إلكترونيات', other: 'أخرى' },
  fr: { 'cafe-restaurant': 'Café / Restaurant', cafe: 'Café', restaurant: 'Restaurant', epicerie: 'Épicerie', grocery: 'Épicerie', boulangerie: 'Boulangerie', bakery: 'Boulangerie', boucherie: 'Boucherie', pharmacie: 'Pharmacie', pharmacy: 'Pharmacie', textile: 'Textile', electronique: 'Électronique', other: 'Autre' },
  en: { 'cafe-restaurant': 'Café / Restaurant', cafe: 'Café', restaurant: 'Restaurant', epicerie: 'Grocery', grocery: 'Grocery', boulangerie: 'Bakery', bakery: 'Bakery', boucherie: 'Butcher', pharmacie: 'Pharmacy', pharmacy: 'Pharmacy', textile: 'Clothing', electronique: 'Electronics', other: 'Other' },
};

/** Filter choices (sign-up sectors). */
export const SECTOR_FILTER = ['epicerie', 'cafe-restaurant', 'boulangerie', 'boucherie', 'pharmacie', 'textile', 'electronique', 'other'] as const;
