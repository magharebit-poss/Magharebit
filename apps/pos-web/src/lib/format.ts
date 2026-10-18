import type { Lang } from './i18n';

const LOCALES: Record<Lang, string> = { ar: 'ar-MA', fr: 'fr-MA', en: 'en-GB' };

// Amount is in MAD (not piastres). Arabic: "12.50 د.م" (suffix). fr/en: "MAD 12.50".
export function formatMoney(amount: number, lang: Lang, fractionDigits = 2): string {
  const n = new Intl.NumberFormat(LOCALES[lang], {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
  return lang === 'ar' ? `${n} د.م` : `MAD ${n}`;
}
