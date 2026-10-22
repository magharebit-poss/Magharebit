'use client';

import { useState, useEffect } from 'react';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem('sticky_cta_dismissed') === '1';
}

export default function StickyCtaBar() {
  const locale = useLocale();
  const pathname = usePathname();
  const isRTL = locale === 'ar';
  const fontBody = isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Inter, sans-serif';

  const [dismissed, setDismissed] = useState(() => readDismissed());
  const [visible, setVisible] = useState(false);

  // Do not render on portal pages
  const isPortal = pathname.includes('/portal');

  useEffect(() => {
    if (isPortal || dismissed) return;

    function onScroll() {
      const scrolled = window.scrollY;
      const total = document.body.scrollHeight - window.innerHeight;
      const pct = total > 0 ? scrolled / total : 0;
      const nearBottom = window.scrollY + window.innerHeight >= document.body.scrollHeight - 200;
      setVisible(pct >= 0.80 && !nearBottom);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isPortal, dismissed]);

  function dismiss() {
    setDismissed(true);
    setVisible(false);
    sessionStorage.setItem('sticky_cta_dismissed', '1');
  }

  if (isPortal || dismissed) return null;

  const trustText =
    locale === 'ar'
      ? '✓ 14 يوم مجاناً · ✓ بدون بطاقة · ✓ دعم بالدارجة'
      : locale === 'fr'
      ? '✓ 14 j. gratuits · ✓ Sans CB · ✓ Support darija'
      : '✓ 14-day free · ✓ No card · ✓ Darija support';

  const headline =
    locale === 'ar'
      ? '🎯 ابدأ تجربتك المجانية اليوم'
      : locale === 'fr'
      ? '🎯 Commencez votre essai gratuit aujourd\'hui'
      : '🎯 Start your free trial today';

  const btnText =
    locale === 'ar' ? 'ابدأ مجاناً ←' : locale === 'fr' ? 'Essai gratuit →' : 'Start free →';

  return (
    <div
      role="banner"
      aria-label="sticky-cta"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(10,35,24,0.97)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(240,180,41,0.20)',
        padding: '14px 24px',
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        direction: isRTL ? 'rtl' : 'ltr',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.3s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Left — headline (hidden on mobile) */}
      <span
        className="hidden md:block"
        style={{
          fontFamily: fontBody,
          fontSize: '15px',
          fontWeight: 600,
          color: '#FFFFFF',
          whiteSpace: 'nowrap',
        }}
      >
        {headline}
      </span>

      {/* Center — trust badges (hidden on mobile) */}
      <span
        className="hidden md:block"
        style={{
          fontFamily: fontBody,
          fontSize: '12px',
          color: 'rgba(255,255,255,0.50)',
          flex: 1,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {trustText}
      </span>

      {/* Right — CTA + close */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <Link
          href={`/${locale}/auth/signup`}
          style={{
            background: '#F0B429',
            color: '#0A2318',
            fontFamily: fontBody,
            fontWeight: 700,
            fontSize: '14px',
            padding: '9px 20px',
            borderRadius: '999px',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 16px rgba(240,180,41,0.40)',
          }}
        >
          {btnText}
        </Link>
        <button
          onClick={dismiss}
          aria-label="close"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.40)',
            fontSize: '16px',
            padding: '4px',
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
