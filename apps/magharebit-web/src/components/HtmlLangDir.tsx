'use client';

import { useEffect } from 'react';

/**
 * Updates <html lang> and <html dir> on the client after hydration.
 * The root layout defaults to lang="ar" dir="rtl"; this component corrects
 * them for French and English locales without causing hydration mismatches
 * (suppressHydrationWarning is set on the <html> element in app/layout.tsx).
 */
export default function HtmlLangDir({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);
  return null;
}
