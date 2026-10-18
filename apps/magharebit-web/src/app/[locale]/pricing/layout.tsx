import type { Metadata } from 'next';
import { getTranslations, getLocale } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('pricing');
  const locale = await getLocale();
  return {
    title: t('meta_title'),
    description: t('meta_desc'),
    alternates: { canonical: `/${locale}/pricing` },
    openGraph: {
      title: t('meta_title'),
      description: t('meta_desc'),
    },
  };
}

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
