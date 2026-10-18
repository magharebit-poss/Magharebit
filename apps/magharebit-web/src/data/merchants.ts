export interface Merchant {
  slug: string;
  name: string;
  logo?: string;
  city: 'Casablanca' | 'Rabat' | 'Marrakech' | 'Tanger' | 'Fès' | 'Agadir' | 'Salé' | 'Kénitra';
  sector: 'bakery' | 'cafe' | 'restaurant' | 'grocery' | 'beauty' | 'fashion' | 'pharmacy' | 'other';
  sectorEmoji: string;
  since: string;
  branches: number;
  testimonial?: {
    quote: { ar: string; fr: string; en: string };
    author: string;
    role: { ar: string; fr: string; en: string };
  };
  metrics?: {
    salesIncrease?: string;
    wasteReduction?: string;
    timesSaved?: string;
  };
}

export const MERCHANTS: Merchant[] = [
  {
    slug: 'boulangerie-al-amrani',
    name: 'Boulangerie Al Amrani',
    city: 'Casablanca',
    sector: 'bakery',
    sectorEmoji: '🥖',
    since: '2024',
    branches: 1,
    testimonial: {
      quote: {
        ar: 'منذ استخدامنا لـ MAGHAREBIT POS، أصبح تتبع المخزون أسهل بكثير ونوفر وقتاً كبيراً كل يوم.',
        fr: 'Depuis que nous utilisons MAGHAREBIT POS, le suivi des stocks est devenu beaucoup plus facile.',
        en: 'Since using MAGHAREBIT POS, inventory tracking has become much easier.',
      },
      author: 'Mohammed El Amrani',
      role: { ar: 'صاحب مخبزة الأمراني', fr: 'Propriétaire', en: 'Owner' },
    },
    metrics: { wasteReduction: '-23%', timesSaved: '2h/jour' },
  },
  {
    slug: 'cafe-medina',
    name: 'Café Medina',
    city: 'Marrakech',
    sector: 'cafe',
    sectorEmoji: '☕',
    since: '2024',
    branches: 2,
  },
  {
    slug: 'epicerie-hassan',
    name: 'Épicerie Hassan',
    city: 'Rabat',
    sector: 'grocery',
    sectorEmoji: '🛒',
    since: '2025',
    branches: 1,
  },
];
