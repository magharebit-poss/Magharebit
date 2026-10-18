'use client';

import Link from 'next/link';

/**
 * Root-level global error boundary — replaces the root layout when active.
 * Must include <html> and <body> (unlike not-found.tsx which renders inside root layout).
 * No next-intl hooks — renders without NextIntlClientProvider context.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>خطأ — MAGHAREBIT</title>
        <style>{`
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #0A2318; color: #fff; }
        `}</style>
      </head>
      <body
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          textAlign: 'center',
          padding: '24px',
        }}
      >
        <div>
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
            500
          </div>

          <div
            style={{
              width: '48px',
              height: '3px',
              background: 'rgba(240,180,41,0.4)',
              borderRadius: '999px',
              margin: '0 auto 28px',
            }}
          />

          <h1
            style={{
              fontFamily: 'Noto Naskh Arabic, Cairo, serif',
              fontSize: 'clamp(1.4rem, 4vw, 1.85rem)',
              fontWeight: 700,
              color: '#FFFFFF',
              marginBottom: '12px',
              lineHeight: 1.25,
            }}
          >
            حدث خطأ في الخادم
          </h1>

          <p
            style={{
              fontFamily: 'Noto Naskh Arabic, Cairo, serif',
              fontSize: '15px',
              color: 'rgba(255,255,255,0.50)',
              lineHeight: 1.7,
              marginBottom: '40px',
            }}
          >
            عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.
          </p>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={reset}
              style={{
                background: 'rgba(240,180,41,0.10)',
                border: '1px solid rgba(240,180,41,0.28)',
                color: '#F0B429',
                borderRadius: '999px',
                padding: '9px 22px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'Noto Naskh Arabic, Cairo, serif',
              }}
            >
              إعادة المحاولة
            </button>
            <Link
              href="/ar"
              style={{
                background: 'rgba(240,180,41,0.10)',
                border: '1px solid rgba(240,180,41,0.28)',
                color: '#F0B429',
                borderRadius: '999px',
                padding: '9px 22px',
                fontSize: '14px',
                fontWeight: 600,
                textDecoration: 'none',
                fontFamily: 'Noto Naskh Arabic, Cairo, serif',
                display: 'inline-block',
              }}
            >
              الصفحة الرئيسية
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
