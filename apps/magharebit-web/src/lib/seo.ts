/**
 * SEO helpers shared by every page: canonical + hreflang alternates and Open Graph basics.
 * Morocco targeting: Arabic and French pages declare ar-MA / fr-MA; English is the international fallback.
 */

import { routing } from '@/i18n/routing';

export const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? 'https://magharebit.com').replace(/\/+$/, '');

export type SiteLocale = (typeof routing.locales)[number];

export const HREFLANG: Record<SiteLocale, string> = { ar: 'ar-MA', fr: 'fr-MA', en: 'en' };
export const OG_LOCALE: Record<SiteLocale, string> = { ar: 'ar_MA', fr: 'fr_MA', en: 'en_US' };

function asLocale(raw: string): SiteLocale {
  return (routing.locales as readonly string[]).includes(raw) ? (raw as SiteLocale) : routing.defaultLocale;
}

/**
 * `path` is the page path without the locale ("", "/pricing", "/sectors/boulangerie").
 * Relative URLs are resolved against metadataBase.
 */
export function pageAlternates(locale: string, path: string) {
  const languages: Record<string, string> = {};
  for (const l of routing.locales) languages[HREFLANG[l]] = `/${l}${path}`;
  languages['x-default'] = `/${routing.defaultLocale}${path}`;
  return { canonical: `/${asLocale(locale)}${path}`, languages };
}

/** Spread into a page's openGraph: Next replaces (does not merge) the parent's openGraph object. */
export function ogBase(locale: string) {
  const l = asLocale(locale);
  return {
    type: 'website' as const,
    siteName: 'MAGHAREBIT POS',
    locale: OG_LOCALE[l],
    alternateLocale: routing.locales.filter((x) => x !== l).map((x) => OG_LOCALE[x]),
  };
}
