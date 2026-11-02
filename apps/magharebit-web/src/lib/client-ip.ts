/**
 * The client IP used as a rate-limit / audit key.
 *
 * Preference order: `x-vercel-forwarded-for` and `x-real-ip` (set by the hosting platform itself, a client cannot
 * choose them there), then the first `x-forwarded-for` entry. On a host that merely APPENDS to a client-supplied
 * `x-forwarded-for` that last fallback is spoofable, so an IP limit must never be the only defence: the public routes
 * also limit per recipient (phone / email) and globally (lib/public-guard.ts), which an attacker cannot rotate away.
 */
export function clientIp(req: Request): string {
  const h = req.headers
  const ip =
    h.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip')?.trim() ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  return ip.slice(0, 64)
}
