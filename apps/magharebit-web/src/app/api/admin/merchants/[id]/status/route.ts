/**
 * PATCH /api/admin/merchants/[id]/status   { status: "active" | "suspended", reason?: string }
 *
 * Reversible on/off switch for a merchant (the Active / Suspended toggle in the admin table).
 * Licenses are NOT revoked: while suspended, the POS gets reason "suspended" from validate and
 * activate; switching back to active restores service at once. Only approved merchants can be
 * suspended and only suspended ones reactivated. Audited as suspendMerchant / reactivateMerchant.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { merchantsRepo } from '@/lib/repositories/merchants'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(actor)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  let body: { status?: unknown; reason?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (body.status !== 'active' && body.status !== 'suspended') {
    return NextResponse.json({ error: 'status must be "active" or "suspended"' }, { status: 422 })
  }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : ''

  const merchant = await merchantsRepo.findById(id)
  if (!merchant) return NextResponse.json({ error: 'merchant_not_found' }, { status: 404 })

  let updated
  if (body.status === 'suspended') {
    if (merchant.status !== 'approved') return NextResponse.json({ error: `cannot_suspend_${merchant.status}` }, { status: 409 })
    updated = await merchantsRepo.suspend(id, actor.name)
  } else {
    if (merchant.status !== 'suspended') return NextResponse.json({ error: `cannot_reactivate_${merchant.status}` }, { status: 409 })
    updated = await merchantsRepo.reactivate(id, actor.name)
  }
  if (!updated) return NextResponse.json({ error: 'status_conflict' }, { status: 409 })

  const auditRecorded = await recordAudit({
    actor, action: body.status === 'suspended' ? 'suspendMerchant' : 'reactivateMerchant', targetType: 'merchant',
    targetId: merchant.phone || merchant.email || id,
    meta: { mode: 'toggle', ...(reason ? { reason } : {}) }, ip: clientIp(req),
  })
  return NextResponse.json({ merchant: updated, auditRecorded })
}
