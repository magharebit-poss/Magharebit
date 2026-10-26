/**
 * POST /api/licenses/activate   { key, machineId }
 *
 * v2: registers the terminal (enforcing the plan's terminal limit) and returns a signed license
 * token (JWT, EdDSA). Public endpoint, like /validate: the license key is the credential.
 * Spec: docs/pos-license-contract.md.
 *
 *   200 { valid: true,  schema: 2, token, plan, storeName, expiresAt }
 *   200 { valid: false, reason: invalid_key | checksum_failed | expired | revoked | suspended | terminal_limit }
 *   400 { valid: false, reason: invalid_request }      malformed body or machineId
 *   429 { valid: false, reason: rate_limited }
 *   503 { valid: false, reason: v2_not_configured }    signing key missing: nothing is signed
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { buildClaims, loadSigningKey, signLicenseToken } from '@/lib/license-token'
import { MACHINE_ID_RE, resolveLicense } from '@/lib/license-service'
import { licensesRepo } from '@/lib/repositories/licenses'
import { getPlanLimits } from '@/lib/plans'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!(await checkRateLimit(`license-activate:${ip}`, 60, 60 * 1000))) {
    return NextResponse.json({ valid: false, reason: 'rate_limited' }, { status: 429 })
  }

  const signingKey = loadSigningKey()
  if (!signingKey) {
    return NextResponse.json({ valid: false, reason: 'v2_not_configured' }, { status: 503 })
  }

  let body: { key?: unknown; machineId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ valid: false, reason: 'invalid_request' }, { status: 400 })
  }
  const key = typeof body.key === 'string' ? body.key : ''
  const machineId = typeof body.machineId === 'string' ? body.machineId.trim() : ''
  if (!MACHINE_ID_RE.test(machineId)) {
    return NextResponse.json({ valid: false, reason: 'invalid_request' }, { status: 400 })
  }

  const resolved = await resolveLicense(key)
  if (!resolved.valid) return NextResponse.json({ valid: false, reason: resolved.reason })
  const license = resolved.license

  const slot = await licensesRepo.registerTerminal(license.id, machineId, getPlanLimits(license.plan).maxRegisters)
  if (slot === 'limit') return NextResponse.json({ valid: false, reason: 'terminal_limit' })
  if (slot === 'missing') return NextResponse.json({ valid: false, reason: 'invalid_key' })

  await licensesRepo.recordActivation(license.id, machineId) // v1 bookkeeping: first activation

  const token = signLicenseToken(buildClaims(license, machineId), signingKey)
  return NextResponse.json({
    valid: true,
    schema: 2,
    token,
    plan: license.plan,
    storeName: license.storeName,
    expiresAt: license.expiresAt.toISOString(),
  })
}
