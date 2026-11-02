import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// ── Content-Security-Policy ──────────────────────────────────────────────────
// Built from what the site really loads: its own scripts/styles/fonts/images (fonts are self-hosted, no Google
// Fonts), YouTube-nocookie / Vimeo iframes for the demo video modal (loaded only after a click), and a Cloudinary
// video/poster if marketing uses one. Everything else is refused: no other script origin, no plugins, no <base>
// hijack, forms only to ourselves, no framing by anyone (frame-ancestors, the modern X-Frame-Options).
//
// 'unsafe-inline' stays on script-src because Next.js streams its hydration data in inline <script> tags and the
// pages are statically rendered, so a per-request nonce is not available. That keeps the policy from stopping an
// injected inline script; it still blocks remote script loading, data exfiltration to other origins (connect-src),
// form hijacking, <object>/<base> abuse and clickjacking. A nonce-based policy is the follow-up (SEC-11 in
// docs/security-audit-web-phase2.md). 'unsafe-eval' is development only (React/HMR need it there).
const isProd = process.env.NODE_ENV === 'production';
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProd ? '' : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self' blob: https://res.cloudinary.com",
  'frame-src https://www.youtube-nocookie.com https://player.vimeo.com',
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isProd ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy',  value: contentSecurityPolicy },
  { key: 'X-DNS-Prefetch-Control',   value: 'on' },
  { key: 'X-Frame-Options',          value: 'DENY' },
  { key: 'X-Content-Type-Options',   value: 'nosniff' },
  // 0 = off: the legacy browser XSS filter is removed from every modern browser and was itself exploitable
  { key: 'X-XSS-Protection',         value: '0' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
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

// ── Canonical site URL ───────────────────────────────────────────────────────
// Canonical links, hreflang, sitemap, robots and JSON-LD are all built from NEXT_PUBLIC_BASE_URL at BUILD time.
// A developer's .env.local usually says http://localhost:3004; that value must never reach a production build, or
// Google would be told the live site's canonical is localhost. So in production builds an unset or local value is
// replaced by the live domain (a real staging domain is respected). ALLOW_LOCAL_BASE_URL=1 keeps a local value for
// QA of a production build on your own machine.
const LIVE_SITE_URL = 'https://magharebit.com';
const LOCAL_HOST = /^(https?:\/\/)?(localhost|127\.\d+\.\d+\.\d+|0\.0\.0\.0|\[::1\]|192\.168\.|10\.)/i;

function resolveBaseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, '');
  if (process.env.NODE_ENV !== 'production') return configured || 'http://localhost:3004';
  if (configured && !LOCAL_HOST.test(configured)) return configured;
  if (configured && process.env.ALLOW_LOCAL_BASE_URL === '1') return configured;
  if (configured) console.warn(`[config] NEXT_PUBLIC_BASE_URL="${configured}" is a local address: using ${LIVE_SITE_URL} for this production build.`);
  return LIVE_SITE_URL;
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BASE_URL: resolveBaseUrl() },

  // This app is its own project: dependencies come from its own node_modules (installed from its own
  // package-lock.json, exactly as Vercel does) and Next must not trace or resolve files above this folder.
  // A checkout whose node_modules linked to another worktree made Next follow the link out of the workspace.
  outputFileTracingRoot: __dirname,

  // Lets a second dev server (tests, review) run beside the main one without
  // sharing and corrupting the same .next cache: NEXT_DIST_DIR=.next-test next dev -p 3020
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  compress: true,

  // ── Image optimisation ─────────────────────────────────────────────────
  images: {
    formats: ['image/avif', 'image/webp'],   // AVIF first — 30-50% smaller than WebP
    minimumCacheTTL: 60 * 60 * 24 * 30,     // 30-day browser cache
    deviceSizes: [375, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  async redirects() {
    return [
      // The audit log is now /admin/audit-logs (timeline + table). A real 308, so old links and bookmarks keep working.
      { source: '/:locale(ar|fr|en)/admin/audit-log', destination: '/:locale/admin/audit-logs', permanent: true },
    ];
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
      // Self-hosted fonts: the version is in the file name (scripts/fonts/sync-fonts.mjs),
      // so a new version gets a new URL and these can be cached forever.
      { source: '/fonts/(.*)\\.woff2', headers: immutableCache },
      // Images in public/ are not versioned: cache for a day, then revalidate in the background.
      {
        source: '/:dir(media|brand)/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
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
