import { MetadataRoute } from 'next';
import { HREFLANG } from '@/lib/seo';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://magharebit.com';
const LOCALES = ['ar', 'fr', 'en'] as const;

const SECTOR_SLUGS = [
  'boulangerie',
  'epicerie',
  'cafe-restaurant',
  'salon-beaute',
  'boutique-vetements',
  'pharmacie',
  'boucherie',
  'snack-shawarma',
  'traiteur',
];

const CITY_SLUGS = ['casablanca', 'rabat', 'marrakech'];

const PAGES: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }> = [
  { path: '',             priority: 1.0,  changeFrequency: 'weekly'  },
  { path: '/features',    priority: 0.9,  changeFrequency: 'monthly' },
  { path: '/pricing',     priority: 0.9,  changeFrequency: 'monthly' },
  { path: '/sectors',     priority: 0.8,  changeFrequency: 'monthly' },
  { path: '/clients',     priority: 0.9,  changeFrequency: 'monthly' },
  { path: '/comparaison', priority: 0.85, changeFrequency: 'monthly' },
  { path: '/materiel',    priority: 0.8,  changeFrequency: 'monthly' },
  { path: '/about',       priority: 0.7,  changeFrequency: 'monthly' },
  { path: '/demo',        priority: 0.9,  changeFrequency: 'monthly' },
  { path: '/download',    priority: 0.8,  changeFrequency: 'monthly' },
  { path: '/blog',        priority: 0.8,  changeFrequency: 'weekly'  },
  { path: '/status',      priority: 0.5,  changeFrequency: 'monthly' },
  { path: '/changelog',   priority: 0.5,  changeFrequency: 'monthly' },
  { path: '/faq',         priority: 0.8,  changeFrequency: 'monthly' },
  { path: '/privacy',     priority: 0.3,  changeFrequency: 'yearly'  },
  ...SECTOR_SLUGS.map((slug) => ({
    path: `/sectors/${slug}` as string,
    priority: 0.75 as number,
    changeFrequency: 'monthly' as MetadataRoute.Sitemap[number]['changeFrequency'],
  })),
  ...CITY_SLUGS.map((slug) => ({
    path: `/caisse-enregistreuse-${slug}` as string,
    priority: 0.85 as number,
    changeFrequency: 'monthly' as MetadataRoute.Sitemap[number]['changeFrequency'],
  })),
];

export default function sitemap(): MetadataRoute.Sitemap {
  const entries: MetadataRoute.Sitemap = [];
  const lastModified = new Date();

  for (const locale of LOCALES) {
    for (const page of PAGES) {
      // hreflang cluster: every language version lists all of its siblings (and x-default),
      // so Google serves the Moroccan Arabic / French / English page to the right searcher.
      const languages: Record<string, string> = {};
      for (const l of LOCALES) languages[HREFLANG[l]] = `${BASE_URL}/${l}${page.path}`;
      languages['x-default'] = `${BASE_URL}/ar${page.path}`;
      entries.push({
        url: `${BASE_URL}/${locale}${page.path}`,
        lastModified,
        changeFrequency: page.changeFrequency,
        priority: page.priority,
        alternates: { languages },
      });
    }
  }

  return entries;
}
