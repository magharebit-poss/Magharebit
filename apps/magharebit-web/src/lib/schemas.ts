// JSON-LD schema generators for MAGHAREBIT pages.
// Import and call these in layout.tsx / page.tsx to inject structured data
// that helps Google show rich snippets in search results.

export function softwareApplicationSchema(locale: string) {
  const descriptions: Record<string, string> = {
    ar: 'نظام نقطة البيع المغربي — يعمل بدون إنترنت، واجهة عربية RTL، إدارة مخزون ذكية',
    fr: 'Système de caisse marocain — hors-ligne, interface arabe native, gestion de stock intelligente',
    en: 'Moroccan POS system — offline-first, native Arabic RTL interface, intelligent inventory management',
  }
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'MAGHAREBIT POS',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Windows, Android, Web Browser',
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
    description: descriptions[locale] ?? descriptions.fr,
    inLanguage: ['ar', 'fr', 'en'],
    url: `https://magharebit.com/${locale}`,
  }
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MAGHAREBIT',
    url: 'https://magharebit.com',
    logo: 'https://magharebit.com/icon.svg',
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+212619522487',
      contactType: 'customer service',
      availableLanguage: ['Arabic', 'French', 'English'],
    },
    sameAs: [
      'https://www.linkedin.com/in/magharebit-team-15a025414/',
      'https://www.facebook.com/profile.php?id=61590535894132',
      'https://x.com/teamMagharebit',
    ],
    foundingCountry: 'MA',
    description:
      'Moroccan POS and retail management software — Arabic-first, offline-capable, AI-powered.',
  }
}

export function localBusinessSchema(
  cityName: string,
  citySlug: string,
  locale: string,
  description: string,
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': `https://magharebit.com/${locale}/caisse-enregistreuse-${citySlug}`,
    name: 'MAGHAREBIT',
    description,
    url: `https://magharebit.com/${locale}/caisse-enregistreuse-${citySlug}`,
    telephone: '+212619522487',
    address: {
      '@type': 'PostalAddress',
      addressLocality: cityName,
      addressCountry: 'MA',
    },
    areaServed: cityName,
    priceRange: '249-749 MAD/mois',
  }
}

export function faqSchema(items: Array<{ question: string; answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }
}
