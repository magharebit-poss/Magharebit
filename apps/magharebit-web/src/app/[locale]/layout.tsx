import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import PageTransition from '@/components/PageTransition';
import WhatsAppButton from '@/components/WhatsAppButton';
import TrustBarConditional from '@/components/TrustBarConditional';
import HtmlLangDir from '@/components/HtmlLangDir';
import TrustRibbon from '@/components/TrustRibbon';
import { organizationSchema } from '@/lib/schemas';

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

  const messages = await getMessages();

  // ── Site-wide SoftwareApplication structured data ──────────────────────────
  // Renders as a JSON-LD script in <head> so Google can show rich snippets
  // (price range, app category) in SERPs. No review/rating markup until real,
  // verifiable reviews exist.
  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'MAGHAREBIT POS',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Windows, Android, Web',
    offers: {
      '@type': 'Offer',
      price: '249',
      priceCurrency: 'MAD',
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: '249',
        priceCurrency: 'MAD',
        billingDuration: 'P1M',
      },
    },
    description:
      locale === 'ar'
        ? 'نظام نقطة البيع المغربي — يعمل بدون إنترنت، واجهة عربية، إدارة مخزون'
        : locale === 'fr'
        ? 'Système de caisse marocain — hors-ligne, interface arabe, gestion de stock'
        : 'Moroccan POS system — offline-first, Arabic interface, inventory management',
  };

  return (
    <NextIntlClientProvider messages={messages}>
      <HtmlLangDir locale={locale} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema()) }}
      />
      <PageTransition>
        {children}
      </PageTransition>
      <TrustRibbon />
      <WhatsAppButton />
      <TrustBarConditional />
    </NextIntlClientProvider>
  );
}
