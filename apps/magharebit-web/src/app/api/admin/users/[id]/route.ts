/**
 * PATCH /api/admin/users/[id]   { disabled: boolean }   (owner only)
 *
 * Disabling takes effect on the account's next request, because write routes
 * re-check the database (authenticateAdmin), not just the cookie.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminUnauthorized, authenticateAdmin } from '@/lib/admin-auth'
import { adminUsersRepo } from '@/lib/repositories/admin-users'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return adminUnauthorized()
  if (actor.role !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params

  let body: { disabled?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (typeof body.disabled !== 'boolean') {
    return NextResponse.json({ error: 'disabled must be a boolean' }, { status: 422 })
  }
  if (id === actor.id) {
    return NextResponse.json({ error: 'cannot_change_own_status' }, { status: 409 })
  }

  const ok = await adminUsersRepo.setDisabled(id, body.disabled)
  if (!ok) return NextResponse.json({ error: 'not_found_or_database_unavailable' }, { status: 404 })

  const auditRecorded = await recordAudit({
    actor, action: 'disableAdmin', targetType: 'admin', targetId: id,
    meta: { disabled: body.disabled }, ip: clientIp(req),
  })
  return NextResponse.json({ ok: true, disabled: body.disabled, auditRecorded })
}
