/**
 * Root-level not-found page — renders inside app/layout.tsx (which provides html/body).
 * No next-intl dependency — defaults to Arabic since it renders without locale context.
 * Locale-specific 404s are handled by [locale]/not-found.tsx.
 */
import Link from 'next/link';

export default function GlobalNotFound() {
  return (
    <main
      style={{
        background: '#0A2318',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
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
          direction: 'rtl',
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
          ٤٠٤
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
            fontFamily: 'Noto Naskh Arabic, Cairo, serif',
            fontSize: 'clamp(1.4rem, 4vw, 1.85rem)',
            fontWeight: 700,
            color: '#FFFFFF',
            marginBottom: '12px',
            lineHeight: 1.25,
          }}
        >
          الصفحة غير موجودة
        </h1>

        {/* Subtitle */}
        <p
          style={{
            fontFamily: 'Noto Naskh Arabic, Cairo, serif',
            fontSize: '15px',
            color: 'rgba(255,255,255,0.50)',
            lineHeight: 1.7,
            marginBottom: '40px',
          }}
        >
          عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
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
          {[
            { label: 'الصفحة الرئيسية', href: '/ar' },
            { label: 'الأسعار', href: '/ar/pricing' },
            { label: 'طلب عرض تجريبي', href: '/ar/demo' },
          ].map(({ label, href }) => (
            <Link
              key={href}
              href={href}
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
              {label}
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
