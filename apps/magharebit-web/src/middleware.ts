import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const intl = createMiddleware(routing);

/**
 * Cross-site request guard for the JSON API.
 *
 * Cookies are SameSite (Lax for the portal, Strict for the admin) and bodies are JSON, which already stops the usual
 * CSRF. This adds a second, independent layer: a browser always sends `Origin` (and `Sec-Fetch-Site`) on a
 * cross-origin POST/PUT/PATCH/DELETE, so a state-changing /api request that says it comes from another site is
 * refused before any handler runs. It also closes the "simple request" hole (a cross-site <form> or fetch with
 * Content-Type text/plain skips the CORS preflight, and our handlers parse the body as JSON whatever the type).
 *
 * Requests WITHOUT an Origin (curl, scripts, server-to-server, the cron) are not browser cross-site requests and
 * pass. Exempt, because their callers are the POS apps (Tauri/Capacitor webviews send their own origin) or the
 * platform: /api/licenses/* and /api/cron/*. Those are protected by their own keys/secrets and rate limits.
 */
const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const ORIGIN_EXEMPT = /^\/api\/(licenses|cron)(\/|$)/;

function crossSite(req: NextRequest): boolean {
  if (req.headers.get('sec-fetch-site') === 'cross-site') return true;
  const origin = req.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== req.headers.get('host');
  } catch {
    return true; // "null" (sandboxed frame, file://) or garbage
  }
}

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith('/api/')) {
    if (UNSAFE.has(req.method) && !ORIGIN_EXEMPT.test(pathname) && crossSite(req)) {
      return NextResponse.json({ error: 'cross_origin_blocked' }, { status: 403 });
    }
    return NextResponse.next();
  }
  return intl(req);
}

export const config = {
  // Match the root, locale-prefixed paths, the API (origin guard only: next-intl must not touch it, it would
  // redirect /api/leads → /ar/api/leads which 404s), and everything else EXCEPT _next assets, _vercel internals
  // and static files (anything with a dot).
  matcher: ['/', '/(ar|en|fr)/:path*', '/api/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
