/**
 * PATCH /api/admin/notifications/[id]  { status?: 'queued'|'sent'|'cancelled', resend?: true }   (owner/operator)
 *
 * Change a notification's status by hand, or put it back in the queue ("resend", counted in resendCount).
 * There is no sender connected yet, so nothing is delivered: this only manages the record.
 * Audited as updateNotification.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { notificationsRepo, type NotificationStatus } from '@/lib/repositories/notifications'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'

const STATUSES: NotificationStatus[] = ['queued', 'sent', 'cancelled']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(actor)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { id } = await params

  let b: { status?: unknown; resend?: unknown }
  try { b = (await req.json()) as typeof b } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
  const resend = b.resend === true
  const status = b.status as NotificationStatus | undefined
  if (b.resend !== undefined && typeof b.resend !== 'boolean') return NextResponse.json({ error: 'resend must be a boolean' }, { status: 422 })
  if (status !== undefined && !STATUSES.includes(status)) return NextResponse.json({ error: `status must be one of: ${STATUSES.join(', ')}` }, { status: 422 })
  if (!resend && status === undefined) return NextResponse.json({ error: 'send status or resend' }, { status: 422 })
  if (resend && status !== undefined) return NextResponse.json({ error: 'send either status or resend, not both' }, { status: 422 })

  const n = await notificationsRepo.update(id, { status, resend }, actor.name)
  if (!n) return NextResponse.json({ error: 'notification_not_found' }, { status: 404 })
  const auditRecorded = await recordAudit({
    actor, action: 'updateNotification', targetType: 'notification', targetId: id,
    meta: { title: n.title, ...(resend ? { resend: true, resendCount: n.resendCount ?? 1 } : { status }) }, ip: clientIp(req),
  })
  return NextResponse.json({ notification: n, delivered: false, auditRecorded })
}
