import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control',   value: 'on' },
  { key: 'X-Frame-Options',          value: 'DENY' },
  { key: 'X-Content-Type-Options',   value: 'nosniff' },
  { key: 'X-XSS-Protection',         value: '1; mode=block' },
  { key: 'Referrer-Policy',          value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
];

// Long-lived immutable asset cache
const immutableCache = [
  { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  compress: true,

  // ── Image optimisation ─────────────────────────────────────────────────
  images: {
    formats: ['image/avif', 'image/webp'],   // AVIF first — 30-50% smaller than WebP
    minimumCacheTTL: 60 * 60 * 24 * 30,     // 30-day browser cache
    deviceSizes: [375, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  async headers() {
    return [
      // Security on every route
      { source: '/(.*)',              headers: securityHeaders },
      // Immutable cache for Next.js static chunks. Production only: dev chunks are
      // NOT content-hashed (main-app.js, app/[locale]/page.js ...), so caching them
      // as immutable makes the browser reuse stale chunks after a restart and
      // crash with "Cannot read properties of undefined (reading 'call')".
      ...(process.env.NODE_ENV === 'production'
        ? [{ source: '/_next/static/(.*)', headers: immutableCache }]
        : []),
      // Video range + cache headers
      {
        source: '/(.*)\\.mp4',
        headers: [
          { key: 'Accept-Ranges', value: 'bytes' },
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
      {
        source: '/(.*)\\.webm',
        headers: [
          { key: 'Accept-Ranges', value: 'bytes' },
          { key: 'Cache-Control', value: 'public, max-age=86400' },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
