/**
 * GET  /api/admin/notifications?page=&limit=   (any admin)
 * POST /api/admin/notifications   { title, body, audience: 'all'|'plan'|'merchant', target? }   (owner/operator)
 *
 * Scaffold: the announcement is stored as `queued` and audited (broadcastNotification).
 * Nothing is delivered yet (no WhatsApp or POS inbox sender); the response says so.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { notificationsRepo, PLAN_TARGETS, type NotificationAudience } from '@/lib/repositories/notifications'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'
import type { LicensePlan } from '@/lib/license-key'

const AUDIENCES: NotificationAudience[] = ['all', 'plan', 'merchant']

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await authenticateAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sp = new URL(req.url).searchParams
  const res = await notificationsRepo.findAll({ page: parseInt(sp.get('page') ?? '1', 10) || 1, limit: parseInt(sp.get('limit') ?? '25', 10) || 25 })
  if (!res) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  return NextResponse.json(res)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(actor)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let b: Record<string, unknown>
  try { b = (await req.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const title = typeof b.title === 'string' ? b.title.trim() : ''
  const body = typeof b.body === 'string' ? b.body.trim() : ''
  if (title.length < 2 || title.length > 120) return NextResponse.json({ error: 'title must be 2-120 characters' }, { status: 422 })
  if (body.length < 2 || body.length > 1000) return NextResponse.json({ error: 'body must be 2-1000 characters' }, { status: 422 })
  const audience = b.audience as NotificationAudience
  if (!AUDIENCES.includes(audience)) return NextResponse.json({ error: `audience must be one of: ${AUDIENCES.join(', ')}` }, { status: 422 })
  let target: string | undefined
  if (audience === 'plan') {
    if (!PLAN_TARGETS.includes(b.target as LicensePlan)) return NextResponse.json({ error: 'target must be a plan' }, { status: 422 })
    target = b.target as string
  } else if (audience === 'merchant') {
    target = typeof b.target === 'string' ? b.target.trim().slice(0, 64) : ''
    if (!target) return NextResponse.json({ error: 'target (merchant phone or id) is required' }, { status: 422 })
  }

  const notification = await notificationsRepo.create({ title, body, audience, ...(target ? { target } : {}), createdBy: actor.name })
  if (!notification) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })

  const auditRecorded = await recordAudit({
    actor, action: 'broadcastNotification', targetType: 'notification', targetId: notification.id,
    meta: { audience, ...(target ? { target } : {}), title }, ip: clientIp(req),
  })
  return NextResponse.json({ notification, delivered: false, note: 'stored as queued; no sender is connected yet', auditRecorded }, { status: 201 })
}
