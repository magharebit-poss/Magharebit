/**
 * Server-side license resolution shared by POST /api/licenses/validate and
 * POST /api/licenses/activate, so both apply exactly the same rules.
 */

import { verifyKeyChecksum, type LicenseRecord } from './license-key'
import { licensesRepo } from './repositories/licenses'
import { merchantsRepo } from './repositories/merchants'

export type LicenseFailure = 'invalid_key' | 'checksum_failed' | 'expired' | 'revoked' | 'suspended'

export type Resolved =
  | { valid: false; reason: LicenseFailure }
  | { valid: true; license: LicenseRecord }

/** A machine id the POS may send: 8-128 visible characters, no whitespace or control characters. */
export const MACHINE_ID_RE = /^[\x21-\x7E]{8,128}$/

/**
 * Checksum (no DB hit on garbage) -> lookup -> lazy expiry sweep -> status -> merchant suspension.
 * Order matters: a revoked or expired license reports that first; `suspended` means the license
 * itself is fine but an admin has switched the merchant off.
 */
export async function resolveLicense(rawKey: string): Promise<Resolved> {
  const key = rawKey.trim().toUpperCase()
  if (!key) return { valid: false, reason: 'invalid_key' }
  if (!verifyKeyChecksum(key)) return { valid: false, reason: 'checksum_failed' }

  if (!(await licensesRepo.findByKey(key))) return { valid: false, reason: 'invalid_key' }
  await licensesRepo.sweepExpired()
  const license = await licensesRepo.findByKey(key)
  if (!license) return { valid: false, reason: 'invalid_key' }

  if (license.status === 'revoked') return { valid: false, reason: 'revoked' }
  if (license.status === 'expired') return { valid: false, reason: 'expired' }

  const merchant = await merchantsRepo.findByContact(license.merchantId)
  if (merchant?.status === 'suspended') return { valid: false, reason: 'suspended' }

  return { valid: true, license }
}

export function hasTerminal(license: LicenseRecord, machineId: string): boolean {
  return (license.terminals ?? []).some((t) => t.machineId === machineId)
}
