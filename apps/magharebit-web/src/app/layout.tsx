import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MAGHAREBIT | مغاربيت',
  description: 'تطبيق المغاربة في الخارج',
};

/**
 * Root layout — renders <html> and <body>.
 * lang/dir default to 'ar'; locale routes update them via [locale]/layout.tsx
 * using suppressHydrationWarning so the client-side locale update is silent.
 *
 * Performance notes:
 *  - DNS prefetch + preconnect for Google Fonts (avoids TCP round-trips)
 *  - Font stylesheet uses display=swap so text renders immediately in fallback
 *  - No render-blocking scripts in <head>
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <head>
        {/* ── Resource hints ─────────────────────────────────────────────── */}
        <link rel="dns-prefetch"  href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch"  href="https://fonts.gstatic.com" />
        <link rel="preconnect"    href="https://fonts.googleapis.com" />
        <link rel="preconnect"    href="https://fonts.gstatic.com" crossOrigin="anonymous" />

        {/* ── Google Fonts (display=swap — no layout shift) ──────────────── */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=Noto+Naskh+Arabic:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap"
        />

        {/* ── PWA ────────────────────────────────────────────────────────── */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0A2318" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MAGHAREBIT" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
