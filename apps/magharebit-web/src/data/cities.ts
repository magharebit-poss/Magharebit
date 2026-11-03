export interface City {
  slug: string;
  name: string;
  region: string;
  positioning: { ar: string; fr: string; en: string };
  topSectors: string[];
}

export const CITIES: City[] = [
  {
    slug: 'casablanca',
    name: 'Casablanca',
    region: 'Casablanca-Settat',
    positioning: {
      ar: 'مصممة لإيقاع التجارة السريع في الدار البيضاء، مع دعم متعدد الفروع للسلاسل المحلية',
      fr: 'Adapté au rythme rapide du commerce casablancais, multi-branches pour les chaînes locales',
      en: 'Built for the fast pace of Casablanca commerce, multi-branch support for local chains',
    },
    topSectors: ['boulangerie', 'cafe-restaurant', 'boutique-vetements'],
  },
  {
    slug: 'rabat',
    name: 'Rabat',
    region: 'Rabat-Salé-Kénitra',
    positioning: {
      ar: 'استقرار وموثوقية لتجار وسط المدينة وسلا، مع إدارة إدارية مبسطة',
      fr: 'Stabilité et fiabilité pour les commerces du centre-ville et de Salé, gestion administrative simplifiée',
      en: 'Stability and reliability for downtown and Salé merchants, simplified administrative management',
    },
    topSectors: ['pharmacie', 'epicerie', 'salon-beaute'],
  },
  {
    slug: 'marrakech',
    name: 'Marrakech',
    region: 'Marrakech-Safi',
    positioning: {
      ar: 'متعدد اللغات (فرنسي، عربي، إنجليزي) لتجار المدينة القديمة والمناطق السياحية',
      fr: 'Multi-langues (français, arabe, anglais) pour les commerces touristiques de la médina',
      en: 'Multi-language (French, Arabic, English) for tourist commerce in the medina',
    },
    topSectors: ['cafe-restaurant', 'boutique-vetements', 'boulangerie'],
  },
];
