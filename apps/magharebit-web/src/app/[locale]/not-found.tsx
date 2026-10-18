import { getLocale } from 'next-intl/server';
import Link from 'next/link';
import Logo from '@/components/brand/Logo';

const CONTENT = {
  ar: {
    code: '404',
    title: 'الصفحة غير موجودة',
    sub: 'عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.',
    isRTL: true,
    links: [
      { label: 'الصفحة الرئيسية', path: '' },
      { label: 'الأسعار', path: '/pricing' },
      { label: 'طلب عرض تجريبي', path: '/demo' },
    ],
  },
  fr: {
    code: '404',
    title: 'Page introuvable',
    sub: "Désolé, la page que vous cherchez n'existe pas ou a été déplacée.",
    isRTL: false,
    links: [
      { label: 'Accueil', path: '' },
      { label: 'Tarifs', path: '/pricing' },
      { label: 'Demander une démo', path: '/demo' },
    ],
  },
  en: {
    code: '404',
    title: 'Page not found',
    sub: "Sorry, the page you're looking for doesn't exist or has been moved.",
    isRTL: false,
    links: [
      { label: 'Home', path: '' },
      { label: 'Pricing', path: '/pricing' },
      { label: 'Request a demo', path: '/demo' },
    ],
  },
} as const;

/**
 * Locale-specific 404 page.
 * Intentionally uses NO Navbar/Footer — those components need client-side hooks
 * that are unreliable during static prerendering of not-found pages.
 * Uses only next-intl/server (getLocale) which works correctly in this context.
 */
export default async function NotFound() {
  let locale: string = 'ar';
  try {
    locale = await getLocale();
  } catch {
    locale = 'ar';
  }

  const c = CONTENT[locale as keyof typeof CONTENT] ?? CONTENT.ar;
  const fontFamily = c.isRTL ? 'Noto Naskh Arabic, Cairo, serif' : 'Plus Jakarta Sans, Inter, sans-serif';

  return (
    <>
      {/* Minimal header — no hooks, no client components */}
      <header
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '64px',
          background: 'rgba(10,35,24,0.95)',
          borderBottom: '1px solid rgba(240,180,41,0.15)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          zIndex: 60,
          direction: c.isRTL ? 'rtl' : 'ltr',
        }}
      >
        <Link
          href={`/${locale}`}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}
        >
          <Logo height={36} on="dark" variant="horizontal" />
        </Link>
      </header>

      <main
        style={{
          background: '#0A2318',
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '120px 24px 80px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Watermark */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        >
          <svg viewBox="0 0 200 200" width="520" height="520" style={{ opacity: 0.04 }}>
            <polygon
              points="100,8 192,54 192,146 100,192 8,146 8,54"
              fill="none"
              stroke="#F0B429"
              strokeWidth="3"
            />
            <text
              x="100"
              y="128"
              textAnchor="middle"
              fontSize="90"
              fontWeight="bold"
              fill="#F0B429"
              fontFamily="Noto Naskh Arabic, serif"
            >
              م
            </text>
          </svg>
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            textAlign: 'center',
            direction: c.isRTL ? 'rtl' : 'ltr',
            maxWidth: '540px',
          }}
        >
          {/* Code */}
          <div
            style={{
              fontFamily: 'Plus Jakarta Sans, sans-serif',
              fontWeight: 900,
              fontSize: 'clamp(5rem, 18vw, 8.5rem)',
              color: '#F0B429',
              lineHeight: 1,
              letterSpacing: '-0.04em',
              marginBottom: '8px',
            }}
          >
            {c.code}
          </div>

          {/* Divider */}
          <div
            style={{
              width: '48px',
              height: '3px',
              background: 'rgba(240,180,41,0.4)',
              borderRadius: '999px',
              margin: '0 auto 28px',
            }}
          />

          {/* Title */}
          <h1
            style={{
              fontFamily,
              fontSize: 'clamp(1.4rem, 4vw, 1.85rem)',
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: '12px',
              lineHeight: 1.25,
            }}
          >
            {c.title}
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontFamily,
              fontSize: '15px',
              color: 'rgba(255,255,255,0.50)',
              lineHeight: 1.7,
              marginBottom: '40px',
            }}
          >
            {c.sub}
          </p>

          {/* Links */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            {c.links.map((link) => (
              <Link
                key={link.path}
                href={`/${locale}${link.path}`}
                style={{
                  background: 'rgba(240,180,41,0.10)',
                  border: '1px solid rgba(240,180,41,0.28)',
                  color: '#F0B429',
                  borderRadius: '999px',
                  padding: '9px 22px',
                  fontSize: '14px',
                  fontWeight: 600,
                  textDecoration: 'none',
                  fontFamily,
                  display: 'inline-block',
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </main>
    </>
  );
}
