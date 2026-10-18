import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match the root, locale-prefixed paths, and everything else EXCEPT
  // _next assets, _vercel internals, /api routes (server endpoints), and
  // static files (anything with a dot). Without the /api exclusion the
  // next-intl middleware redirects /api/leads → /ar/api/leads which 404s.
  matcher: ['/', '/(ar|en|fr)/:path*', '/((?!api|_next|_vercel|.*\\..*).*)'],
};
