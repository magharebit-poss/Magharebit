/**
 * PATCH /api/admin/coupons/[id]   { active: boolean }   (owner/operator)
 * Switch a coupon off/on. Audited as createCoupon with meta.change = 'active' (no new audit action needed).
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { couponsRepo } from '@/lib/repositories/coupons'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(actor)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  let active: unknown
  try { active = ((await req.json()) as { active?: unknown }).active } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
  if (typeof active !== 'boolean') return NextResponse.json({ error: 'active must be a boolean' }, { status: 422 })

  const ok = await couponsRepo.setActive(id, active)
  if (!ok) return NextResponse.json({ error: 'coupon_not_found' }, { status: 404 })
  const auditRecorded = await recordAudit({
    actor, action: 'createCoupon', targetType: 'coupon', targetId: id, meta: { change: 'active', active }, ip: clientIp(req),
  })
  return NextResponse.json({ coupon: { id, active }, auditRecorded })
}
