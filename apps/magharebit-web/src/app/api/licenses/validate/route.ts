/**
 * POST /api/licenses/validate
 *
 * Public endpoint — no auth header required (the license key is the credential).
 * Called by the POS at startup and daily thereafter. Spec: docs/pos-license-contract.md.
 *
 * Request body:
 *   { key: string, machineId?: string }
 *
 * Response (HTTP 200 unless noted):
 *   { valid: true, key, plan, storeName, expiresAt, daysRemaining, firstActivation, isTrial,
 *     maxRegisters, maxBranches, features }                       v1 fields, always present
 *   + { schema: 2, token }   ONLY when v2 signing is configured AND `machineId` is a terminal that
 *                            already holds a slot (registered via /api/licenses/activate); this is the
 *                            refresh path that gives the POS a fresh token.
 *   { valid: false, reason: "invalid_key" | "checksum_failed" | "expired" | "revoked" | "suspended" }
 *   400 { valid: false, reason: "invalid_request" }   not JSON
 *   429 { valid: false, reason: "rate_limited" }
 *
 * POS behaviour: valid → unlock and cache; invalid → lock/activation screen; network error → keep
 * the cached answer inside the grace window (72 h in v1; refreshBy + 72 h with v2 tokens).
 * No DB call happens for a key whose checksum fails, so random guessing cannot hammer the database.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rateLimit'
import { getPlanLimits } from '@/lib/plans'
import { buildClaims, loadSigningKey, signLicenseToken } from '@/lib/license-token'
import { MACHINE_ID_RE, hasTerminal, resolveLicense } from '@/lib/license-service'
import { licensesRepo } from '@/lib/repositories/licenses'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!(await checkRateLimit(`license-validate:${ip}`, 120, 60 * 1000))) {
    return NextResponse.json({ valid: false, reason: 'rate_limited' }, { status: 429 })
  }

  let body: { key?: string; machineId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ valid: false, reason: 'invalid_request' }, { status: 400 })
  }

  const rawKey = (body.key ?? '').trim().toUpperCase()
  const machineId = (body.machineId ?? '').trim().slice(0, 128) // cap to prevent oversized storage

  const resolved = await resolveLicense(rawKey)
  if (!resolved.valid) return NextResponse.json({ valid: false, reason: resolved.reason })
  const fresh = resolved.license

  // Record first activation (idempotent — only sets if not already set)
  if (machineId) {
    await licensesRepo.recordActivation(fresh.id, machineId)
  }

  const now = Date.now()
  const daysRemaining = Math.max(0, Math.ceil((fresh.expiresAt.getTime() - now) / 86_400_000))
  const firstActivation = !fresh.activatedAt
  const limits = getPlanLimits(fresh.plan)

  const response: Record<string, unknown> = {
    valid:           true,
    key:             fresh.key,
    plan:            fresh.plan,
    storeName:       fresh.storeName,
    expiresAt:       fresh.expiresAt.toISOString(),
    daysRemaining,
    firstActivation,
    isTrial:         fresh.isTrial ?? false,
    maxRegisters:    limits.maxRegisters,
    maxBranches:     limits.maxBranches,
    features:        limits.features,
  }

  // v2 refresh: only for a terminal that already holds a slot. Registering a NEW terminal is
  // /activate's job, because that is where the terminal limit is enforced.
  const signingKey = loadSigningKey()
  if (signingKey && machineId && MACHINE_ID_RE.test(machineId) && hasTerminal(fresh, machineId)) {
    await licensesRepo.touchTerminal(fresh.id, machineId)
    response.schema = 2
    response.token = signLicenseToken(buildClaims(fresh, machineId, now), signingKey)
  }

  return NextResponse.json(response)
}
