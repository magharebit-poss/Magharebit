import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['ar', 'en', 'fr'],
  defaultLocale: 'ar',
  // hreflang is declared per page in metadata (lib/seo.ts) and in the sitemap; do not also emit
  // next-intl's automatic Link headers, which would publish a second, conflicting set.
  alternateLinks: false,
});
