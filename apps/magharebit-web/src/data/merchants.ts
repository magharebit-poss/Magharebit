import { SECTORS } from './sectors';

/**
 * Anonymous use cases, one per sector. These replace the former named merchants: no business, owner,
 * city, quote, rating or figure is invented. The statement is a factual description of what the product
 * does for that kind of shop (see `useCase` in sectors.ts).
 */
export interface UseCase {
  slug: string;
  sectorEmoji: string;
  name: Record<string, string>;
  statement: Record<string, string>;
}

export const USE_CASE_LABEL: Record<'ar' | 'fr' | 'en', string> = {
  ar: 'حالة استخدام',
  fr: 'Cas d’usage',
  en: 'Use case',
};

export const USE_CASES: UseCase[] = SECTORS.map((s) => ({
  slug: s.slug,
  sectorEmoji: s.emoji,
  name: s.name,
  statement: s.useCase.statement,
}));
