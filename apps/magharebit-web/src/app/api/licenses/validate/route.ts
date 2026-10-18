/**
 * POST /api/licenses/validate
 *
 * Public endpoint — no auth header required.
 * Called by the desktop app on every startup and daily thereafter.
 *
 * Request body:
 *   { key: string, machineId?: string }
 *
 * Response:
 *   200 { valid: true,  key, plan, storeName, expiresAt, daysRemaining, firstActivation }
 *   200 { valid: false, reason: "invalid_key" | "expired" | "revoked" | "checksum_failed" }
 *
 * Desktop app behaviour:
 *   valid: true  → unlock software, cache response with timestamp
 *   valid: false → show activation/lock screen
 *   network error → use cached response; apply 72-hour grace period
 *
 * Rate-limited to 20 calls / IP / minute at the CDN layer (Vercel Edge Config).
 * No DB calls on checksum failure — prevents brute-force DB hammering.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyKeyChecksum } from '@/lib/license-key'
import { licensesRepo } from '@/lib/repositories/licenses'
import { getPlanLimits } from '@/lib/plans'

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { key?: string; machineId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ valid: false, reason: 'invalid_request' }, { status: 400 })
  }

  const rawKey   = (body.key      ?? '').trim().toUpperCase()
  const machineId = (body.machineId ?? '').trim().slice(0, 128) // cap to prevent oversized storage

  if (!rawKey) {
    return NextResponse.json({ valid: false, reason: 'invalid_key' })
  }

  // 1. Fast offline checksum check — no DB hit needed if key is malformed/fake
  if (!verifyKeyChecksum(rawKey)) {
    return NextResponse.json({ valid: false, reason: 'checksum_failed' })
  }

  // 2. DB lookup
  const license = await licensesRepo.findByKey(rawKey)
  if (!license) {
    return NextResponse.json({ valid: false, reason: 'invalid_key' })
  }

  // 3. Run expiry sweep lazily (keeps status accurate without a cron job)
  await licensesRepo.sweepExpired()

  // Re-fetch after sweep to get updated status
  const fresh = await licensesRepo.findByKey(rawKey)
  if (!fresh) {
    return NextResponse.json({ valid: false, reason: 'invalid_key' })
  }

  if (fresh.status === 'revoked') {
    return NextResponse.json({ valid: false, reason: 'revoked' })
  }
  if (fresh.status === 'expired') {
    return NextResponse.json({ valid: false, reason: 'expired' })
  }

  // 4. Record first activation (idempotent — only sets if not already set)
  if (machineId) {
    await licensesRepo.recordActivation(fresh.id, machineId)
  }

  const now          = Date.now()
  const daysRemaining = Math.max(0, Math.ceil((fresh.expiresAt.getTime() - now) / 86_400_000))
  const firstActivation = !fresh.activatedAt
  const limits = getPlanLimits(fresh.plan)

  return NextResponse.json({
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
  })
}
