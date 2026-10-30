import type { Metadata } from 'next';
import dynamic from 'next/dynamic';
import { preload } from 'react-dom';
import { setRequestLocale } from 'next-intl/server';

// ─── above-the-fold: static imports (SSR, no bundle split needed) ─────────────
import AOSInit from '@/components/AOSInit';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import ProofStrip from '@/components/landing/ProofStrip';
import { pageAlternates, ogBase } from '@/lib/seo';

// ─── below-the-fold: dynamic imports (code splitting) ─────────────────────────
const VideoSection          = dynamic(() => import('@/components/landing/VideoSection'));
const FeatureBento          = dynamic(() => import('@/components/landing/FeatureBento'));
const ProductShowcase       = dynamic(() => import('@/components/landing/ProductShowcase'));
const HardwareShowcase      = dynamic(() => import('@/components/landing/HardwareShowcase'));
const ComparisonSection     = dynamic(() => import('@/components/landing/ComparisonSection'));
const WhatsAppReportPreview = dynamic(() => import('@/components/landing/WhatsAppReportPreview'));
const WasteCalculator       = dynamic(() => import('@/components/landing/WasteCalculator'));
const PricingSection        = dynamic(() => import('@/components/landing/PricingSection'));
const Testimonial           = dynamic(() => import('@/components/landing/Testimonial'));
const HomeFaqSection        = dynamic(() => import('@/components/landing/HomeFaqSection'));
const DemoForm              = dynamic(() => import('@/components/landing/DemoForm'));
const Footer                = dynamic(() => import('@/components/landing/Footer'));
const StickyCtaBar          = dynamic(() => import('@/components/landing/StickyCtaBar'));

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  setRequestLocale((await params).locale);
  const { locale } = await params;

  const titles: Record<string, string> = {
    ar: 'MAGHAREBIT POS | نظام إدارة المتاجر المغربي',
    fr: 'MAGHAREBIT POS | Caisse marocaine professionnelle',
    en: 'MAGHAREBIT POS | Moroccan Retail Management System',
  };
  const descs: Record<string, string> = {
    ar: 'نظام نقطة بيع وإدارة مخزون مصمم للتجار المغاربة. يعمل بدون إنترنت، واجهة عربية أصلية. تجربة مجانية 14 يوماً.',
    fr: "Caisse et gestion de stocks conçues pour les commerçants marocains. Fonctionne hors ligne. Essai gratuit 14 jours.",
    en: 'Offline-first POS and inventory management designed for Moroccan merchants. Free 14-day trial.',
  };

  const title = titles[locale] ?? titles.en;
  const description = descs[locale] ?? descs.en;

  return {
    title,
    description,
    alternates: pageAlternates(locale, ``),
    openGraph: { ...ogBase(locale), title, description },
  };
}

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  // The hero backdrop is a CSS background inside a client component, so the browser would
  // only discover it after the stylesheet and script; hint it from the HTML head instead.
  preload('/media/a1-hero.webp', { as: 'image', fetchPriority: 'high' });
  return (
    <>
      <AOSInit />
      <Navbar />
      <main id="main-content">
        <HeroSection />
        <ProofStrip />
        <VideoSection />
        {/* id="products": the navbar's /#products lands here */}
        <FeatureBento />
        <ProductShowcase />
        <HardwareShowcase />
        <ComparisonSection />
        <WhatsAppReportPreview />
        <WasteCalculator />
        <PricingSection />
        <Testimonial />
        <HomeFaqSection />
        <DemoForm />
      </main>
      <Footer />
      <StickyCtaBar />
    </>
  );
}
