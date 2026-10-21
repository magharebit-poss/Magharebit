/**
 * /api/licenses
 *
 * GET  — list all licenses (admin only: session cookie or x-admin-secret)
 * POST — create a license manually (admin only)
 *        Body: { merchantId, storeName, plan, durationMonths }
 *
 * Desktop app validation lives at /api/licenses/validate (separate route).
 * Admin approve-with-WhatsApp lives at /api/admin/merchants/[id]/approve.
 */

import { NextRequest, NextResponse } from 'next/server'
import { licensesRepo, LicensePlan } from '@/lib/repositories/licenses'
import { isValidDuration } from '@/lib/license-key'
import { authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'

const VALID_PLANS: LicensePlan[] = ['Starter', 'Business', 'Enterprise']

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await authenticateAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const page        = Math.max(1, parseInt(searchParams.get('page')   ?? '1',  10))
  const limit       = Math.min(100, parseInt(searchParams.get('limit') ?? '50', 10))
  const statusParam = searchParams.get('status') ?? 'all'
  const merchantId  = searchParams.get('merchantId') ?? undefined

  // Lazily sweep expired licenses so the list is always accurate
  await licensesRepo.sweepExpired()

  const { licenses, total } = await licensesRepo.findAll({
    page,
    limit,
    status: statusParam as 'all' | 'active' | 'expired' | 'revoked',
    merchantId,
  })

  return NextResponse.json({ licenses, total, page, limit })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!canWrite(actor)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  let body: {
    merchantId?:     string
    storeName?:      string
    plan?:           string
    durationMonths?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const merchantId     = (body.merchantId ?? '').trim()
  const storeName      = (body.storeName  ?? '').trim()
  const plan           = (body.plan       ?? 'Starter') as LicensePlan
  const durationMonths = Number(body.durationMonths ?? 12)

  if (!storeName) {
    return NextResponse.json({ error: 'storeName is required' }, { status: 422 })
  }
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json(
      { error: `plan must be one of: ${VALID_PLANS.join(', ')}` },
      { status: 422 }
    )
  }
  if (!isValidDuration(durationMonths)) {
    return NextResponse.json(
      { error: 'durationMonths must be 1, 3, 6, 12, or 24' },
      { status: 422 }
    )
  }

  try {
    const license = await licensesRepo.create({
      merchantId,
      storeName,
      plan,
      durationMonths,
    })
    const auditRecorded = await recordAudit({
      actor, action: 'generateLicense', targetType: 'license', targetId: license.id,
      meta: { merchantId, plan, durationMonths, expiresAt: license.expiresAt.toISOString(), manual: true },
      ip: clientIp(req),
    })
    return NextResponse.json({ license, auditRecorded }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'internal_error'
    return NextResponse.json({ error: msg }, { status: 503 })
  }
}
