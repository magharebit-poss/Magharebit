/**
 * PATCH /api/admin/merchants/[id]/commission   { rate: number }   (owner/operator)
 *
 * Platform commission for one merchant, in percent: 0-100 with at most two decimals.
 * Only approved merchants (a suspended one keeps its rate but cannot be edited here).
 * Audited as updateCommission with the before/after values.
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
  let rate: unknown
  try { rate = ((await req.json()) as { rate?: unknown }).rate } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 100 || Math.abs(rate * 100 - Math.round(rate * 100)) > 1e-9) {
    return NextResponse.json({ error: 'rate must be a number from 0 to 100 with at most two decimals' }, { status: 422 })
  }

  const merchant = await merchantsRepo.findById(id)
  if (!merchant) return NextResponse.json({ error: 'merchant_not_found' }, { status: 404 })
  if (merchant.status !== 'approved') return NextResponse.json({ error: `cannot_edit_${merchant.status}` }, { status: 409 })

  const updated = await merchantsRepo.setCommission(id, rate)
  if (!updated) return NextResponse.json({ error: 'merchant_not_found' }, { status: 404 })

  const auditRecorded = await recordAudit({
    actor, action: 'updateCommission', targetType: 'merchant', targetId: merchant.phone || merchant.email || id,
    meta: { before: merchant.commissionRate ?? null, after: rate, store: merchant.storeName }, ip: clientIp(req),
  })
  return NextResponse.json({ merchant: updated, auditRecorded })
}
