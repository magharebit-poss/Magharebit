import type { Metadata } from 'next';
import CityPageContent, { generateCityMetadata } from '@/components/CityPageContent';

const CITY_SLUG = 'marrakech';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return generateCityMetadata(locale, CITY_SLUG);
}

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <CityPageContent locale={locale} citySlug={CITY_SLUG} />;
}
