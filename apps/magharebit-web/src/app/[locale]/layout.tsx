import { preload } from 'react-dom';
import { staticParams } from '@/lib/static-params';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import WhatsAppButton from '@/components/WhatsAppButton';
import TrustBarConditional from '@/components/TrustBarConditional';
import TrustRibbon from '@/components/TrustRibbon';
import LeadModalHost from '@/components/leads/LeadModalHost';
import SiteChrome from '@/components/SiteChrome';
import { siteGraph } from '@/lib/schemas';
import { FONT_FILES } from '@/lib/font-files';

// Prerender every locale at build time. With setRequestLocale() here and in each page,
// next-intl takes the locale from params instead of request headers, so marketing pages
// are served as static HTML instead of being rendered on every request.
export function generateStaticParams() {
  return staticParams(routing.locales.map((locale) => ({ locale })));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Reject unknown locales → 404
  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }
  setRequestLocale(locale);
  const loc = locale as (typeof routing.locales)[number];

  // The hero headline uses font-arabic (Noto Naskh Arabic) in every language. Fetch the one
  // subset this locale shows from the head, so it is usually ready before first paint and the
  // headline does not jump when the font swaps in (Naskh is much taller than the fallback).
  preload(
    loc === 'ar' ? FONT_FILES['noto-naskh-arabic-arabic'] : FONT_FILES['noto-naskh-arabic-latin'],
    { as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
  );

  const messages = await getMessages();

  return (
    // lang and dir are rendered here, per locale, so the static HTML is correct for crawlers,
    // screen readers and the first paint (no script needed).
    <html lang={loc} dir={loc === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {/* One linked graph: Organization + WebSite + SoftwareApplication, localized, Morocco-targeted.
              No ratings or review markup until real, verifiable reviews exist. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(siteGraph(loc)) }}
          />
          {/* No JS-gated page fade: content must paint before hydration (LCP). */}
          {children}
          <SiteChrome>
            <TrustRibbon />
            <WhatsAppButton />
            <TrustBarConditional />
            <LeadModalHost />
          </SiteChrome>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
