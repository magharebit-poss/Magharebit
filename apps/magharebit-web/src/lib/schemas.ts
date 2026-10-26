import { SITE_URL, HREFLANG, type SiteLocale } from './seo'

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

// ── Site-wide graph (Organization + WebSite + SoftwareApplication) ───────────────────────────────
// One linked @graph per locale. Facts only: no ratings, reviews or counts until they can be evidenced.
// Morocco targeting: areaServed + audience.geographicArea, and inLanguage ar-MA / fr-MA / en.

const MOROCCO = { '@type': 'Country', name: 'Morocco', identifier: 'MA' }

export function siteGraph(locale: SiteLocale) {
  const org = `${SITE_URL}/#organization`
  const site = `${SITE_URL}/#website`
  const app = `${SITE_URL}/#software`
  const copy = {
    ar: {
      desc: 'نظام نقطة البيع المغربي — يعمل بدون إنترنت، واجهة عربية، إدارة مخزون وتقارير واتساب يومية',
      audience: 'تجار التجزئة والمقاهي والمطاعم والمخابز في المغرب',
      features: ['يعمل بدون إنترنت', 'تقرير واتساب يومي', 'واجهة بالعربية والفرنسية', 'إدارة المخزون', 'طباعة الفواتير الحرارية'],
    },
    fr: {
      desc: 'Système de caisse marocain : hors ligne, interface arabe, gestion de stock et rapport WhatsApp quotidien',
      audience: 'Commerçants, cafés, restaurants et boulangeries du Maroc',
      features: ['Fonctionne hors ligne', 'Rapport WhatsApp quotidien', 'Interface arabe et française', 'Gestion de stock', 'Impression de tickets thermiques'],
    },
    en: {
      desc: 'Moroccan POS system: offline-first, Arabic interface, inventory management and a daily WhatsApp report',
      audience: 'Retailers, cafés, restaurants and bakeries in Morocco',
      features: ['Works offline', 'Daily WhatsApp report', 'Arabic and French interface', 'Inventory management', 'Thermal receipt printing'],
    },
  }[locale]

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': org,
        name: 'MAGHAREBIT',
        url: SITE_URL,
        logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon-512.png`, width: 512, height: 512 },
        areaServed: MOROCCO,
        foundingLocation: MOROCCO,
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: '+212619522487',
          contactType: 'customer service',
          areaServed: 'MA',
          availableLanguage: ['Arabic', 'French', 'English'],
        },
        sameAs: [
          'https://www.linkedin.com/in/magharebit-team-15a025414/',
          'https://www.facebook.com/profile.php?id=61590535894132',
          'https://x.com/teamMagharebit',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': site,
        url: `${SITE_URL}/${locale}`,
        name: 'MAGHAREBIT POS',
        inLanguage: HREFLANG[locale],
        publisher: { '@id': org },
      },
      {
        '@type': 'SoftwareApplication',
        '@id': app,
        name: 'MAGHAREBIT POS',
        description: copy.desc,
        applicationCategory: 'BusinessApplication',
        applicationSubCategory: 'Point of sale',
        operatingSystem: 'Windows, Android',
        inLanguage: ['ar-MA', 'fr-MA', 'en'],
        featureList: copy.features,
        publisher: { '@id': org },
        areaServed: MOROCCO,
        audience: { '@type': 'BusinessAudience', audienceType: copy.audience, geographicArea: MOROCCO },
        isAccessibleForFree: false,
        offers: {
          '@type': 'Offer',
          price: '249',
          priceCurrency: 'MAD',
          eligibleRegion: MOROCCO,
          priceSpecification: { '@type': 'UnitPriceSpecification', price: '249', priceCurrency: 'MAD', billingDuration: 'P1M' },
        },
      },
    ],
  }
}

/** BreadcrumbList for inner pages. `items` are [name, path-without-locale], home first. */
export function breadcrumbSchema(locale: SiteLocale, items: Array<[string, string]>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: `${SITE_URL}/${locale}${path}`,
    })),
  }
}
