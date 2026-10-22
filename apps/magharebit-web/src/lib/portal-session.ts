/**
 * portal-session.ts
 *
 * Merchant portal session helpers.
 * Cookie: `portal_session` — HttpOnly, SameSite=lax, Path=/
 * Payload: { merchantId: string, exp: number }
 *
 * merchantId = MongoDB _id.toString() of the merchant document.
 * The payload is signed with NEXTAUTH_SECRET using the same HMAC
 * scheme used by `mgh_session` (see otp.ts).
 */

import { createHash, timingSafeEqual } from 'crypto'
import { getAuthSecret, requireAuthSecret } from './secret'
import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'portal_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ── Token signing (same algorithm as otp.ts mgh_session) ─────────────────────

function sign(payload: Record<string, unknown>): string {
  const secret = requireAuthSecret()
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHash('sha256').update(`${encoded}:${secret}`).digest('hex')
  return `${encoded}.${sig}`
}

function verify(token: string): Record<string, unknown> | null {
  try {
    const [encoded, sig] = token.split('.')
    if (!encoded || !sig) return null
    const secret = getAuthSecret()
    if (!secret) return null
    const expected = createHash('sha256')
      .update(`${encoded}:${secret}`)
      .digest('hex')
    const bs = Buffer.from(sig)
    const be = Buffer.from(expected)
    if (bs.length !== be.length || !timingSafeEqual(bs, be)) return null
    const payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString()
    ) as Record<string, unknown>
    const exp = payload.exp as number | undefined
    if (exp && exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface PortalSession {
  merchantId: string
  /** normalised phone or email — for logging / display */
  identifier: string
}

/**
 * Read + verify the portal session from the incoming request.
 * Returns null if cookie is absent, expired, or tampered.
 */
export function getPortalSession(req: NextRequest): PortalSession | null {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  const payload = verify(token)
  if (!payload) return null
  const merchantId  = typeof payload.merchantId  === 'string' ? payload.merchantId  : null
  const identifier  = typeof payload.identifier  === 'string' ? payload.identifier  : ''
  if (!merchantId) return null
  return { merchantId, identifier }
}

/**
 * Attach a new portal session cookie to a NextResponse.
 * Call this after successful login.
 */
export function setPortalSessionCookie(
  res: NextResponse,
  session: PortalSession
): void {
  const payload = {
    merchantId:  session.merchantId,
    identifier:  session.identifier,
    exp:         Date.now() + SESSION_TTL_MS,
  }
  const token = sign(payload)
  res.cookies.set({
    name:     COOKIE_NAME,
    value:    token,
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   SESSION_TTL_MS / 1000,
    secure:   process.env.NODE_ENV === 'production',
  })
}

/**
 * Clear the portal session cookie (logout).
 */
export function clearPortalSessionCookie(res: NextResponse): void {
  res.cookies.set({
    name:     COOKIE_NAME,
    value:    '',
    httpOnly: true,
    sameSite: 'lax',
    path:     '/',
    maxAge:   0,
  })
}

/**
 * Return a 401 JSON response. Convenience wrapper for portal route guards.
 */
export function unauthorizedResponse(reason = 'unauthenticated'): NextResponse {
  return NextResponse.json({ error: reason }, { status: 401 })
}
