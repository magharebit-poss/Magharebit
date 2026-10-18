import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

// ─── above-the-fold: static imports (SSR, no bundle split needed) ─────────────
import AOSInit from '@/components/AOSInit';
import Navbar from '@/components/Navbar';
import HeroSection from '@/components/landing/HeroSection';
import ProofBar from '@/components/landing/ProofBar';
import ProductsSection from '@/components/landing/ProductsSection';
import HowItWorks from '@/components/landing/HowItWorks';

// ─── below-the-fold: dynamic imports (code splitting) ─────────────────────────
const WasteCalculator    = dynamic(() => import('@/components/landing/WasteCalculator'));
const ComparisonSection  = dynamic(() => import('@/components/landing/ComparisonSection'));
const SalesFlowDiagram   = dynamic(() => import('@/components/landing/SalesFlowDiagram'));
const RoiTeaser          = dynamic(() => import('@/components/landing/RoiTeaser'));
const WhyNotCompetitors       = dynamic(() => import('@/components/landing/WhyNotCompetitors'));
const WasteTracker            = dynamic(() => import('@/components/landing/WasteTracker'));
const LoyverseCounter         = dynamic(() => import('@/components/landing/LoyverseCounter'));
const DifferentiatorBand      = dynamic(() => import('@/components/landing/DifferentiatorBand'));
const WhatsAppReportPreview   = dynamic(() => import('@/components/landing/WhatsAppReportPreview'));
const SectorsPreview     = dynamic(() => import('@/components/landing/SectorsPreview'));
const PricingSection     = dynamic(() => import('@/components/landing/PricingSection'));
const PricingCalculator  = dynamic(() => import('@/components/landing/PricingCalculator'));
const DemoForm           = dynamic(() => import('@/components/landing/DemoForm'));
const Testimonial        = dynamic(() => import('@/components/landing/Testimonial'));
const MetricsSection     = dynamic(() => import('@/components/landing/MetricsSection'));
const HomeFaqSection     = dynamic(() => import('@/components/landing/HomeFaqSection'));
const CTASection         = dynamic(() => import('@/components/landing/CTASection'));
const Footer             = dynamic(() => import('@/components/landing/Footer'));
const StickyCtaBar       = dynamic(() => import('@/components/landing/StickyCtaBar'));

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
        <WasteCalculator />
        <ComparisonSection />
        <SalesFlowDiagram />
        <ProofBar />
        <RoiTeaser />
        <WasteTracker />
        <WhyNotCompetitors />
        <LoyverseCounter />
        <ProductsSection />
        <DifferentiatorBand />
        <WhatsAppReportPreview />
        <HowItWorks />
        <SectorsPreview />
        <PricingSection />
        <PricingCalculator />
        <DemoForm />
        <Testimonial />
        <MetricsSection />
        <HomeFaqSection />
        <CTASection />
      </main>
      <Footer />
      <StickyCtaBar />
    </>
  );
}
