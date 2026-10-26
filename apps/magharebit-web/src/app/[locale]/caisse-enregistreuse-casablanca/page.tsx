import type { Metadata } from 'next';
import CityPageContent, { generateCityMetadata } from '@/components/CityPageContent';
import { setRequestLocale } from 'next-intl/server';

const CITY_SLUG = 'casablanca';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  setRequestLocale((await params).locale);
  const { locale } = await params;
  return generateCityMetadata(locale, CITY_SLUG);
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  setRequestLocale((await params).locale);
  const { locale } = await params;
  return <CityPageContent locale={locale} citySlug={CITY_SLUG} />;
}
