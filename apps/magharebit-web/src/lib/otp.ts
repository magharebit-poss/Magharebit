// Shared OTP utilities — imported by auth API routes.
// No side-effects; no DB calls; safe to import anywhere server-side.
import { createHash } from 'crypto'

/** Normalise any Moroccan phone format to 212XXXXXXXXX */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('212') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return '212' + digits.slice(1)
  if (digits.length === 9) return '212' + digits
  return digits
}

/** Hash an OTP using SHA-256 with phone + NEXTAUTH_SECRET as salt */
export function hashOTP(otp: string, phone: string): string {
  const secret = process.env.NEXTAUTH_SECRET ?? 'fallback-dev-secret'
  return createHash('sha256').update(`${otp}:${phone}:${secret}`).digest('hex')
}

/** Create a lightweight signed session token (no external dependencies) */
export function createSessionToken(payload: Record<string, unknown>): string {
  const secret = process.env.NEXTAUTH_SECRET ?? 'fallback-dev-secret'
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHash('sha256').update(`${encoded}:${secret}`).digest('hex')
  return `${encoded}.${sig}`
}

/** Verify and decode a session token; returns null if invalid or expired */
export function verifySessionToken(
  token: string
): Record<string, unknown> | null {
  try {
    const [encoded, sig] = token.split('.')
    if (!encoded || !sig) return null
    const secret = process.env.NEXTAUTH_SECRET ?? 'fallback-dev-secret'
    const expectedSig = createHash('sha256')
      .update(`${encoded}:${secret}`)
      .digest('hex')
    if (sig !== expectedSig) return null
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as Record<string, unknown>
    const exp = payload.exp as number | undefined
    if (exp && exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}
