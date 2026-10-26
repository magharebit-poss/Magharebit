import type { Metadata } from 'next';
import { getTranslations, getLocale, setRequestLocale } from 'next-intl/server';
import { pageAlternates, ogBase } from '@/lib/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  setRequestLocale((await params).locale);
  const t = await getTranslations('pricing');
  const locale = await getLocale();
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: pageAlternates(locale, `/pricing`),
    openGraph: { ...ogBase(locale), title: t('meta_title'),
      description: t('meta_desc'),
    },
  };
}

export default async function PricingLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  return <>{children}</>;
}
