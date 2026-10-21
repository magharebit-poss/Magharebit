/**
 * License Key utilities
 *
 * Format: MGH-{YYYYMM}-{8-hex}-{4-hex}-{2-char-checksum}
 * Example: MGH-202606-A3F91B2C-E47D-K9
 *
 * The 2-char checksum is HMAC-SHA256(body, NEXTAUTH_SECRET)[0:2].toUpperCase()
 * so the desktop app can do an offline pre-validation (wrong checksum = definitely fake)
 * before hitting POST /api/licenses/validate for expiry + revocation status.
 *
 * This module has NO side-effects and NO DB calls — safe to import anywhere.
 */

import { createHmac, randomBytes } from 'crypto'

// ── Types ────────────────────────────────────────────────────────────────────

export type LicensePlan = 'Starter' | 'Business' | 'Enterprise'
export type LicenseStatus = 'active' | 'expired' | 'revoked'

export interface LicenseRecord {
  /** Human-readable ID: "LIC-{timestamp}-{random5}" */
  id: string
  /** Full key string: "MGH-YYYYMM-XXXXXXXX-XXXX-CC" */
  key: string
  /** Normalised merchant phone (links to `merchants` collection) */
  merchantId: string
  /** Denormalised — avoids joins in admin list view */
  storeName: string
  plan: LicensePlan
  durationMonths: number
  /** Set for trial licenses (14-day auto-issued). durationMonths is 0 for trials. */
  durationDays?: number
  /** true for auto-issued trials; false/absent for paid licenses */
  isTrial?: boolean
  issuedAt: Date
  expiresAt: Date
  status: LicenseStatus
  /** Set on first successful /validate call from desktop app */
  activatedAt?: Date
  /** Machine fingerprint provided by desktop app on first activation */
  activatedBy?: string
  revokedAt?: Date
  revokedBy?: string
  notes?: string
}

export interface Merchant {
  phone: string
  email?: string
  storeName: string
  sector: string
  city: string
  locale: string
  createdAt: Date
  /** pending → awaiting admin approval; approved → has active license; suspended → locked out */
  status: 'pending' | 'approved' | 'suspended'
  approvedAt?: Date
  approvedBy?: string
  plan?: LicensePlan
  subscriptionEndsAt?: Date
}

// ── Key generation ────────────────────────────────────────────────────────────

/**
 * Generate a new license key for the given issuance date.
 * Returns the full key string including checksum.
 */
export function generateLicenseKey(issuedAt: Date = new Date()): string {
  // Fail closed: a missing secret must never fall back to a guessable one.
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error('NEXTAUTH_SECRET is not set: refusing to issue a license key')

  const year  = issuedAt.getUTCFullYear()
  const month = String(issuedAt.getUTCMonth() + 1).padStart(2, '0')
  const datePart = `${year}${month}`

  const hex8 = randomBytes(4).toString('hex').toUpperCase()
  const hex4 = randomBytes(2).toString('hex').toUpperCase()

  const body = `MGH-${datePart}-${hex8}-${hex4}`
  const checksum = computeChecksum(body, secret)

  return `${body}-${checksum}`
}

/**
 * Verify the checksum portion of a key (offline pre-check).
 * Returns true if the key structure and checksum are valid.
 * Does NOT check expiry or revocation — that requires a DB lookup.
 */
export function verifyKeyChecksum(key: string): boolean {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) return false // fail closed: nothing validates without the secret
  const parts = key.trim().toUpperCase().split('-')
  // Expected: ["MGH", "YYYYMM", "XXXXXXXX", "XXXX", "CC"]
  if (parts.length !== 5) return false
  if (parts[0] !== 'MGH') return false
  if (!/^\d{6}$/.test(parts[1])) return false
  if (!/^[0-9A-F]{8}$/.test(parts[2])) return false
  if (!/^[0-9A-F]{4}$/.test(parts[3])) return false
  if (!/^[0-9A-F]{2}$/.test(parts[4])) return false

  const body = parts.slice(0, 4).join('-')
  const expectedChecksum = computeChecksum(body, secret)
  return parts[4] === expectedChecksum
}

function computeChecksum(body: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(body)
    .digest('hex')
    .slice(0, 2)
    .toUpperCase()
}

// ── Duration helpers ──────────────────────────────────────────────────────────

/**
 * Calculate expiry date from issuance date + duration in months.
 * Uses UTC month arithmetic (handles varying month lengths correctly).
 */
export function calcExpiresAt(issuedAt: Date, durationMonths: number): Date {
  const d = new Date(issuedAt)
  d.setUTCMonth(d.getUTCMonth() + durationMonths)
  return d
}

/** Validate durationMonths is one of the allowed values */
export function isValidDuration(months: number): months is 1 | 3 | 6 | 12 | 24 {
  return [1, 3, 6, 12, 24].includes(months)
}

/**
 * Calculate expiry date from issuance date + duration in days.
 * Used for trial licenses where the trial period is not a full month.
 */
export function calcExpiresAtDays(issuedAt: Date, durationDays: number): Date {
  return new Date(issuedAt.getTime() + durationDays * 24 * 60 * 60 * 1000)
}

/** Human-readable duration label (Arabic) */
export function durationLabelAr(months: number): string {
  const map: Record<number, string> = {
    1: 'شهر واحد',
    3: '3 أشهر',
    6: '6 أشهر',
    12: 'سنة كاملة',
    24: 'سنتان',
  }
  return map[months] ?? `${months} أشهر`
}

// ── Licence ID ────────────────────────────────────────────────────────────────

export function generateLicenseId(): string {
  const ts    = Date.now().toString(36).toUpperCase()
  const rand  = randomBytes(2).toString('hex').toUpperCase()
  return `LIC-${ts}-${rand}`
}
