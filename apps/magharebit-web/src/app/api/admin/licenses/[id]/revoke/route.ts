/**
 * POST /api/admin/licenses/[id]/revoke   { reason?: string }
 *
 * Revokes ONE license (permanent). The merchant stays active and keeps any other license.
 * To switch a whole merchant off reversibly use PATCH /api/admin/merchants/[id]/status.
 * Audited as revokeKey.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { licensesRepo } from '@/lib/repositories/licenses'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(actor)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params
  let reason = ''
  try {
    const body = (await req.json()) as { reason?: unknown }
    if (typeof body.reason === 'string') reason = body.reason.trim().slice(0, 200)
  } catch {
    /* body optional */
  }

  const lic = await licensesRepo.findById(id)
  if (!lic) return NextResponse.json({ error: 'license_not_found' }, { status: 404 })
  if (lic.status === 'revoked') return NextResponse.json({ error: 'already_revoked' }, { status: 409 })

  await licensesRepo.revoke(id, reason || actor.name)
  const auditRecorded = await recordAudit({
    actor, action: 'revokeKey', targetType: 'license', targetId: id,
    meta: { merchantId: lic.merchantId, ...(reason ? { reason } : {}), scope: 'license' }, ip: clientIp(req),
  })
  return NextResponse.json({ license: { id, status: 'revoked' }, auditRecorded })
}
