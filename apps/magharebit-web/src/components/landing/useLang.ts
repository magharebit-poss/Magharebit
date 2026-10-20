import { useLocale } from 'next-intl';

export type Lang = 'ar' | 'fr' | 'en';

/** Current UI language (anything unknown falls back to English) and RTL flag. */
export function useLang(): { lang: Lang; isRTL: boolean; locale: string } {
  const locale = useLocale();
  const lang: Lang = locale === 'ar' || locale === 'fr' ? locale : 'en';
  return { lang, isRTL: lang === 'ar', locale };
}
