import type { Lang } from '@/components/landing/useLang';

/** Portal formatting: Western digits in every language (design system), MAD in fr/en, درهم in Arabic. */

const NUM_LOCALE: Record<Lang, string> = { fr: 'fr-FR', en: 'en-US', ar: 'en-US' };
const DATE_LOCALE: Record<Lang, string> = { fr: 'fr-MA', en: 'en-GB', ar: 'ar-MA-u-nu-latn' };

export function money(n: number, lang: Lang): string {
  const v = new Intl.NumberFormat(NUM_LOCALE[lang], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  return lang === 'ar' ? `${v} درهم` : `${v} MAD`;
}

export function int(n: number, lang: Lang): string {
  return new Intl.NumberFormat(NUM_LOCALE[lang]).format(n);
}

export function longDate(iso: string | Date, lang: Lang): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALE[lang], { year: 'numeric', month: 'long', day: 'numeric' });
}

export function weekday(iso: string | Date, lang: Lang, style: 'short' | 'long' = 'short'): string {
  return new Date(iso).toLocaleDateString(DATE_LOCALE[lang], { weekday: style, timeZone: 'UTC' });
}

/** "il y a 5 min" / "منذ 5 دقائق" / "5 min ago" */
export function ago(iso: string, lang: Lang): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-u-nu-latn' : lang, { numeric: 'auto', style: 'short' });
  if (Math.abs(mins) < 60) return rtf.format(-mins, 'minute');
  const h = Math.round(mins / 60);
  if (Math.abs(h) < 24) return rtf.format(-h, 'hour');
  return rtf.format(-Math.round(h / 24), 'day');
}
