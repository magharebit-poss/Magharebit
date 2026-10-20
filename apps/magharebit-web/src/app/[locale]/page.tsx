import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

// ─── above-the-fold: static imports (SSR, no bundle split needed) ─────────────
import AOSInit from '@/components/AOSInit';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import ProofStrip from '@/components/landing/ProofStrip';
import IntentCards from '@/components/landing/IntentCards';

// ─── below-the-fold: dynamic imports (code splitting) ─────────────────────────
const FeatureStories        = dynamic(() => import('@/components/landing/FeatureStories'));
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
    alternates: { canonical: `/${locale}` },
    openGraph: { title, description },
  };
}

export default function LandingPage() {
  return (
    <>
      <AOSInit />
      <Navbar />
      <main id="main-content">
        <HeroSection />
        <ProofStrip />
        <IntentCards />
        <FeatureStories />
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
