/**
 * The shared server secret (NEXTAUTH_SECRET) used to sign sessions, OTP hashes,
 * license-key checksums and PIN hashes.
 *
 * Fail closed: there is NO built-in fallback value. A guessable default would let
 * anyone forge tokens on any deployment that forgot to set the variable.
 */

/** The secret, or null when it is not configured (verification paths treat null as "invalid"). */
export function getAuthSecret(): string | null {
  const s = process.env.NEXTAUTH_SECRET
  return s && s.length > 0 ? s : null
}

/** The secret, or throw: signing/hashing paths must never run without it. */
export function requireAuthSecret(): string {
  const s = getAuthSecret()
  if (!s) throw new Error('NEXTAUTH_SECRET is not set: refusing to sign or hash without it')
  return s
}
