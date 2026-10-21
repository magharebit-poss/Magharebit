/**
 * /api/admin/users: individual admin accounts. Owner only.
 *
 * GET  list accounts (never returns hashes)
 * POST { username, displayName, email?, role: "operator"|"viewer", password }
 *      Only the break-glass owner (ADMIN_SECRET) can be "owner"; accounts created
 *      here are operator or viewer.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminUnauthorized, authenticateAdmin } from '@/lib/admin-auth'
import { adminUsersRepo, EMAIL_RE, USERNAME_RE } from '@/lib/repositories/admin-users'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'
import { isAcceptablePassword } from '@/lib/password'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return adminUnauthorized()
  if (actor.role !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const users = await adminUsersRepo.list()
  if (!users) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  return NextResponse.json({ users })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return adminUnauthorized()
  if (actor.role !== 'owner') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  let body: { username?: unknown; displayName?: unknown; email?: unknown; role?: unknown; password?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body.role
  const password = typeof body.password === 'string' ? body.password : ''

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ error: 'invalid_username', hint: '3-32 chars: a-z 0-9 . _ -' }, { status: 422 })
  }
  if (!displayName) return NextResponse.json({ error: 'displayName_required' }, { status: 422 })
  if (email && !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 422 })
  }
  if (role !== 'operator' && role !== 'viewer') {
    return NextResponse.json({ error: 'role must be operator or viewer' }, { status: 422 })
  }
  if (!isAcceptablePassword(password)) {
    return NextResponse.json({ error: 'password must be 12-200 characters' }, { status: 422 })
  }

  const user = await adminUsersRepo.create({
    username, displayName, role, password, createdBy: actor.id, ...(email ? { email } : {}),
  })
  if (!user) {
    return NextResponse.json({ error: 'username_or_email_taken_or_database_unavailable' }, { status: 409 })
  }

  const auditRecorded = await recordAudit({
    actor, action: 'createAdmin', targetType: 'admin', targetId: user.id,
    meta: { username: user.username, role: user.role, ...(user.email ? { email: user.email } : {}) },
    ip: clientIp(req),
  })
  return NextResponse.json({ user, auditRecorded }, { status: 201 })
}
