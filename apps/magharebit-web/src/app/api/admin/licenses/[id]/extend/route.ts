/**
 * POST /api/admin/licenses/[id]/extend   { months?: 1|3|6|12|24, days?: 1..366, reason?: string }
 *
 * Adds time to a license. Extends from the current expiry if it is still in the future, otherwise
 * from now (an expired license comes back to life). A revoked license cannot be extended.
 * Exactly one of months / days. Audited as extendSubscription.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { calcExpiresAt, calcExpiresAtDays, isValidDuration } from '@/lib/license-key'
import { licensesRepo } from '@/lib/repositories/licenses'
import { merchantsRepo } from '@/lib/repositories/merchants'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(actor)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  let body: { months?: unknown; days?: unknown; reason?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const hasMonths = body.months !== undefined
  const hasDays = body.days !== undefined
  if (hasMonths === hasDays) return NextResponse.json({ error: 'send exactly one of months or days' }, { status: 422 })
  const months = Number(body.months)
  const days = Number(body.days)
  if (hasMonths && !isValidDuration(months)) return NextResponse.json({ error: 'months must be 1, 3, 6, 12, or 24' }, { status: 422 })
  if (hasDays && !(Number.isInteger(days) && days >= 1 && days <= 366)) return NextResponse.json({ error: 'days must be an integer 1-366' }, { status: 422 })
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 200) : ''

  const lic = await licensesRepo.findById(id)
  if (!lic) return NextResponse.json({ error: 'license_not_found' }, { status: 404 })
  if (lic.status === 'revoked') return NextResponse.json({ error: 'license_revoked' }, { status: 409 })

  const now = new Date()
  const base = lic.expiresAt.getTime() > now.getTime() ? lic.expiresAt : now
  const newExpiry = hasMonths ? calcExpiresAt(base, months) : calcExpiresAtDays(base, days)

  const updated = await licensesRepo.update(id, { expiresAt: newExpiry, status: 'active' })
  if (!updated) return NextResponse.json({ error: 'license_not_found' }, { status: 404 })

  // keep the merchant record in step with its newest subscription
  const merchant = await merchantsRepo.findByContact(lic.merchantId)
  if (merchant && merchant.status === 'approved') {
    await merchantsRepo.setSubscription(merchant.id, lic.plan, newExpiry)
  }

  const auditRecorded = await recordAudit({
    actor, action: 'extendSubscription', targetType: 'license', targetId: id,
    meta: {
      ...(hasMonths ? { months } : { days }),
      from: lic.expiresAt.toISOString(), to: newExpiry.toISOString(),
      wasExpired: lic.status === 'expired', merchantId: lic.merchantId, ...(reason ? { reason } : {}),
    },
    ip: clientIp(req),
  })

  return NextResponse.json({ license: { id, key: updated.key, status: updated.status, expiresAt: newExpiry }, auditRecorded })
}
