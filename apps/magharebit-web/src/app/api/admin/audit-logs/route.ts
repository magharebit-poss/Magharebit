/**
 * GET /api/admin/audit-logs
 *
 * Read-only, newest first. Any signed-in admin role may read.
 * Query: actorId, action, targetId, from, to (ISO dates), page, limit (max 200).
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminUnauthorized, authenticateAdmin } from '@/lib/admin-auth'
import { auditLogsRepo, type AuditAction } from '@/lib/repositories/audit-logs'

const ACTIONS: AuditAction[] = [
  'generateLicense', 'revokeKey', 'extendSubscription', 'approveMerchant', 'suspendMerchant',
  'reactivateMerchant', 'createCoupon', 'broadcastNotification', 'createAdmin', 'disableAdmin', 'adminLogin',
  'activateLead', 'updateLeadStatus', 'releaseTerminal',
  'updateTipping', 'updateCommission', 'createCatalogItem', 'updateCatalogItem', 'updateNotification',
]

function parseDate(v: string | null): Date | undefined {
  if (!v) return undefined
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? undefined : d
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return adminUnauthorized()

  const sp = new URL(req.url).searchParams
  const actionParam = sp.get('action')
  if (actionParam && !ACTIONS.includes(actionParam as AuditAction)) {
    return NextResponse.json({ error: 'invalid_action' }, { status: 422 })
  }

  const result = await auditLogsRepo.find({
    actorId: sp.get('actorId') || undefined,
    action: (actionParam as AuditAction | null) || undefined,
    targetId: sp.get('targetId') || undefined,
    from: parseDate(sp.get('from')),
    to: parseDate(sp.get('to')),
    page: parseInt(sp.get('page') ?? '1', 10) || 1,
    limit: parseInt(sp.get('limit') ?? '50', 10) || 50,
  })
  if (!result) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })

  return NextResponse.json(result)
}
