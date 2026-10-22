/**
 * POST /api/admin/licenses/[id]/terminals/release   { machineId }
 *
 * Frees a terminal slot (device replaced or lost). The POS cannot do this itself. Audited as
 * releaseTerminal. The released terminal's cached token keeps working until its refreshBy window
 * lapses; after that it cannot refresh, and if the limit is full it cannot re-register.
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
  let machineId = ''
  try {
    const body = (await req.json()) as { machineId?: unknown }
    if (typeof body.machineId === 'string') machineId = body.machineId.trim()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!machineId) return NextResponse.json({ error: 'machineId_required' }, { status: 422 })

  const lic = await licensesRepo.findById(id)
  if (!lic) return NextResponse.json({ error: 'license_not_found' }, { status: 404 })
  const released = await licensesRepo.releaseTerminal(id, machineId)
  if (!released) return NextResponse.json({ error: 'terminal_not_registered' }, { status: 404 })

  const auditRecorded = await recordAudit({
    actor, action: 'releaseTerminal', targetType: 'license', targetId: id,
    meta: { machineId, merchantId: lic.merchantId }, ip: clientIp(req),
  })
  return NextResponse.json({ ok: true, auditRecorded })
}
