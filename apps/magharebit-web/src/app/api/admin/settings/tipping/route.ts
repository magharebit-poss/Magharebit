/**
 * GET /api/admin/settings/tipping            (any admin)  -> { tips: [t1, t2, t3], saved, updatedAt?, updatedBy? }
 * PUT /api/admin/settings/tipping  { tips: [int, int, int] }   (owner/operator)
 *
 * Default tip amounts offered at the POS checkout, in MAD (0-1000, whole numbers; 0 hides that option).
 * Audited as updateTipping with the before/after values.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { platformSettingsRepo, validTips, TIP_COUNT, TIP_MIN, TIP_MAX } from '@/lib/repositories/platform-settings'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await authenticateAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const t = await platformSettingsRepo.getTipping()
  if (!t) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  return NextResponse.json(t)
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(actor)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: { tips?: unknown }
  try { body = (await req.json()) as { tips?: unknown } } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
  if (!validTips(body.tips)) {
    return NextResponse.json({ error: `tips must be ${TIP_COUNT} whole numbers between ${TIP_MIN} and ${TIP_MAX}` }, { status: 422 })
  }

  const before = await platformSettingsRepo.getTipping()
  if (!before) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  const saved = await platformSettingsRepo.setTipping(body.tips, actor.name)
  if (!saved) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })

  const auditRecorded = await recordAudit({
    actor, action: 'updateTipping', targetType: 'setting', targetId: 'tipping',
    meta: { before: before.tips, after: body.tips }, ip: clientIp(req),
  })
  return NextResponse.json({ ...saved, auditRecorded })
}
