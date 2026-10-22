/**
 * License token v2: a standard JWT (RFC 7519) signed with EdDSA / Ed25519 (RFC 8037).
 * Normative spec: docs/pos-license-contract.md.
 *
 * This module has no side effects and imports only Node's crypto and ./plans, so it can be
 * unit-tested directly. The private key comes from the environment, never from the repo:
 *   LICENSE_SIGNING_PRIVATE_KEY  PKCS#8 Ed25519 key, PEM text or base64 of the DER
 *   LICENSE_SIGNING_KID          key id for the JWT header (default "k1")
 *   LICENSE_EXTRA_JWKS           optional JSON array of retired PUBLIC JWKs kept for rotation
 *
 * Fail closed: without a valid key nothing is signed (isSigningConfigured() is false).
 */

import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'crypto'
import { getPlanLimits } from './plans'

export const ISSUER = 'https://magharebit.com'
export const AUDIENCE = 'magharebit-pos'
export const TOKEN_SCHEMA = 2
export const REFRESH_WINDOW_SECONDS = 7 * 24 * 60 * 60
export const OFFLINE_GRACE_SECONDS = 72 * 60 * 60
const SKEW_SECONDS = 300

export interface LicenseTokenClaims {
  iss: string
  aud: string
  sub: string
  jti: string
  iat: number
  nbf: number
  exp: number
  refreshBy: number
  schema: number
  plan: string
  trial: boolean
  maxRegisters: number
  maxBranches: number
  features: string[]
  machineId: string
}

export interface Jwk {
  kty: 'OKP'
  crv: 'Ed25519'
  x: string
  kid: string
  alg: 'EdDSA'
  use: 'sig'
}

export interface SigningKey {
  kid: string
  privateKey: KeyObject
  publicKey: KeyObject
}

const b64u = (b: Buffer | string): string => Buffer.from(b).toString('base64url')

// ── key loading ──────────────────────────────────────────────────────────────

export function loadSigningKey(env: NodeJS.ProcessEnv = process.env): SigningKey | null {
  const raw = env.LICENSE_SIGNING_PRIVATE_KEY?.trim()
  if (!raw) return null
  try {
    const privateKey = raw.includes('-----BEGIN')
      ? createPrivateKey(raw)
      : createPrivateKey({ key: Buffer.from(raw, 'base64'), format: 'der', type: 'pkcs8' })
    if (privateKey.asymmetricKeyType !== 'ed25519') return null
    return { kid: env.LICENSE_SIGNING_KID?.trim() || 'k1', privateKey, publicKey: createPublicKey(privateKey) }
  } catch {
    return null
  }
}

export function isSigningConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return loadSigningKey(env) !== null
}

function toJwk(publicKey: KeyObject, kid: string): Jwk {
  const j = publicKey.export({ format: 'jwk' })
  return { kty: 'OKP', crv: 'Ed25519', x: String(j.x), kid, alg: 'EdDSA', use: 'sig' }
}

/** Public keys the POS should trust: the current key plus any retired keys still in rotation. */
export function publicJwks(env: NodeJS.ProcessEnv = process.env): Jwk[] | null {
  const key = loadSigningKey(env)
  if (!key) return null
  const keys: Jwk[] = [toJwk(key.publicKey, key.kid)]
  const extra = env.LICENSE_EXTRA_JWKS
  if (extra) {
    try {
      for (const k of JSON.parse(extra) as Jwk[]) {
        if (k && k.kty === 'OKP' && k.crv === 'Ed25519' && typeof k.x === 'string' && typeof k.kid === 'string' && k.kid !== key.kid) {
          keys.push({ kty: 'OKP', crv: 'Ed25519', x: k.x, kid: k.kid, alg: 'EdDSA', use: 'sig' })
        }
      }
    } catch {
      /* malformed extra keys are ignored; the current key is still served */
    }
  }
  return keys
}

// ── claims + signing ─────────────────────────────────────────────────────────

export interface TokenSource {
  id: string
  merchantId: string
  plan: string
  isTrial?: boolean
  expiresAt: Date
}

export function buildClaims(license: TokenSource, machineId: string, nowMs: number = Date.now()): LicenseTokenClaims {
  const now = Math.floor(nowMs / 1000)
  const exp = Math.floor(license.expiresAt.getTime() / 1000)
  const limits = getPlanLimits(license.plan)
  return {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: license.merchantId,
    jti: license.id,
    iat: now,
    nbf: now,
    exp,
    refreshBy: Math.min(now + REFRESH_WINDOW_SECONDS, exp),
    schema: TOKEN_SCHEMA,
    plan: license.plan,
    trial: license.isTrial === true,
    maxRegisters: limits.maxRegisters,
    maxBranches: limits.maxBranches,
    features: [...limits.features],
    machineId,
  }
}

export function signLicenseToken(claims: LicenseTokenClaims, key: SigningKey): string {
  const header = { alg: 'EdDSA', typ: 'JWT', kid: key.kid }
  const input = `${b64u(JSON.stringify(header))}.${b64u(JSON.stringify(claims))}`
  const sig = sign(null, Buffer.from(input), key.privateKey)
  return `${input}.${b64u(sig)}`
}

// ── reference verifier (what the POS must do; also used by the tests) ─────────

export type VerifyFailure =
  | 'malformed' | 'bad_alg' | 'unknown_kid' | 'bad_signature' | 'bad_issuer' | 'bad_audience'
  | 'bad_schema' | 'not_yet_valid' | 'expired' | 'machine_mismatch' | 'needs_refresh'

export type VerifyResult = { ok: true; claims: LicenseTokenClaims } | { ok: false; reason: VerifyFailure }

export function verifyLicenseToken(
  token: string,
  jwks: { keys: Pick<Jwk, 'x' | 'kid'>[] },
  opts: { nowSeconds?: number; machineId?: string; lastRefreshOk?: boolean } = {}
): VerifyResult {
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'malformed' }
  let header: { alg?: string; typ?: string; kid?: string }
  let claims: LicenseTokenClaims
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (header.alg !== 'EdDSA') return { ok: false, reason: 'bad_alg' } // never accept none / HS*
  const jwk = jwks.keys.find((k) => k.kid === header.kid)
  if (!jwk) return { ok: false, reason: 'unknown_kid' }

  let publicKey: KeyObject
  try {
    publicKey = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: jwk.x }, format: 'jwk' })
  } catch {
    return { ok: false, reason: 'unknown_kid' }
  }
  const okSig = verify(null, Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'))
  if (!okSig) return { ok: false, reason: 'bad_signature' }

  if (claims.iss !== ISSUER) return { ok: false, reason: 'bad_issuer' }
  if (claims.aud !== AUDIENCE) return { ok: false, reason: 'bad_audience' }
  if (claims.schema !== TOKEN_SCHEMA) return { ok: false, reason: 'bad_schema' }

  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000)
  if (now < claims.nbf - SKEW_SECONDS) return { ok: false, reason: 'not_yet_valid' }
  if (now >= claims.exp) return { ok: false, reason: 'expired' } // hard stop, no grace after exp
  if (opts.machineId !== undefined && claims.machineId !== opts.machineId) return { ok: false, reason: 'machine_mismatch' }
  if (opts.lastRefreshOk === false && now > claims.refreshBy + OFFLINE_GRACE_SECONDS) return { ok: false, reason: 'needs_refresh' }
  return { ok: true, claims }
}
