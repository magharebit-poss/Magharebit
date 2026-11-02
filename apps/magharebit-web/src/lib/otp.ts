// Shared OTP utilities — imported by auth API routes.
// No side-effects; no DB calls; safe to import anywhere server-side.
import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { getAuthSecret, requireAuthSecret } from './secret'

/** Normalise any Moroccan phone format to 212XXXXXXXXX */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('212') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return '212' + digits.slice(1)
  if (digits.length === 9) return '212' + digits
  return digits
}

/** Constant-time comparison of two hex signatures. */
function sameSig(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

/** Hash an OTP using SHA-256 with phone + NEXTAUTH_SECRET as salt */
export function hashOTP(otp: string, phone: string): string {
  const secret = requireAuthSecret()
  return createHash('sha256').update(`${otp}:${phone}:${secret}`).digest('hex')
}

/**
 * Signed session tokens (`mgh_session` after OTP, `portal_session` for the merchant portal): base64url(payload).sig
 * with sig = HMAC-SHA256(secret, payload). Every token must carry a numeric `exp` (ms); one without it is refused.
 *
 * Tokens signed by the previous scheme, sha256(`payload:secret`), are still accepted until their own `exp` so
 * nobody is logged out by the change. All were issued with a 7-day TTL at most: the fallback can be deleted after
 * LEGACY_SIG_UNTIL.
 */
const LEGACY_SIG_UNTIL = Date.UTC(2026, 10, 10) // 10 Nov 2026

function hmacSig(encoded: string, secret: string): string {
  return createHmac('sha256', secret).update(encoded).digest('hex')
}

/** Create a signed session token. `payload.exp` (epoch ms) is required. */
export function createSessionToken(payload: Record<string, unknown>): string {
  if (typeof payload.exp !== 'number') throw new Error('session token without exp')
  const secret = requireAuthSecret()
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${hmacSig(encoded, secret)}`
}

/** Verify and decode a session token; returns null if tampered, without `exp`, or expired */
export function verifySessionToken(
  token: string
): Record<string, unknown> | null {
  try {
    const [encoded, sig, extra] = token.split('.')
    if (!encoded || !sig || extra !== undefined) return null
    const secret = getAuthSecret()
    if (!secret) return null
    const valid = sameSig(sig, hmacSig(encoded, secret))
      || (Date.now() < LEGACY_SIG_UNTIL && sameSig(sig, createHash('sha256').update(`${encoded}:${secret}`).digest('hex')))
    if (!valid) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as Record<string, unknown>
    if (!payload || typeof payload !== 'object') return null
    const exp = payload.exp
    if (typeof exp !== 'number' || !Number.isFinite(exp) || exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
