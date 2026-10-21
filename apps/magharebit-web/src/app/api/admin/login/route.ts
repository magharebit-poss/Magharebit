import { NextRequest, NextResponse } from 'next/server'
import {
  OWNER_ACTOR,
  checkAdminPassword,
  createAdminSessionToken,
  isAdminConfigured,
  setAdminSessionCookie,
  type AdminActor,
} from '@/lib/admin-auth'
import { checkRateLimit } from '@/lib/rateLimit'
import { adminUsersRepo } from '@/lib/repositories/admin-users'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'
import { dummyVerify, verifyPassword } from '@/lib/password'

/**
 * POST /api/admin/login   { username?: string, password: string }
 *
 *  - No username (or "owner"): the password is checked against ADMIN_SECRET
 *    (break-glass owner identity; also what the current login form sends).
 *  - Any other username: an individual account from the admin_users collection.
 *
 * On success sets the HttpOnly admin session cookie carrying the actor. Secrets
 * and hashes never reach the client. Failures are deliberately uniform.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'admin_not_configured' }, { status: 503 })
  }

  const ip = clientIp(req)
  if (!checkRateLimit(`admin-login:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let username = ''
  let password = ''
  try {
    const body = (await req.json()) as { username?: unknown; password?: unknown }
    if (typeof body.password === 'string') password = body.password
    if (typeof body.username === 'string') username = body.username.trim().toLowerCase().slice(0, 64)
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!password) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

  let actor: AdminActor | null = null

  if (username === '' || username === OWNER_ACTOR.id) {
    if (checkAdminPassword(password)) actor = OWNER_ACTOR
  } else {
    // Per-username limiter slows targeted guessing from many IPs.
    if (!checkRateLimit(`admin-login-user:${username}`, 10, 15 * 60 * 1000)) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
    }
    const user = await adminUsersRepo.findByUsername(username)
    if (user && !user.disabledAt) {
      if (await verifyPassword(password, user.passwordHash)) {
        actor = {
          id: user.id,
          name: user.displayName || user.username,
          role: user.role,
          ...(user.email ? { email: user.email } : {}),
        }
      }
    } else {
      await dummyVerify(password) // same cost whether or not the user exists
    }
  }

  if (!actor) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

  const token = createAdminSessionToken(actor)
  if (!token) {
    return NextResponse.json({ error: 'admin_not_configured' }, { status: 503 })
  }

  await recordAudit({ actor, action: 'adminLogin', targetType: 'session', targetId: actor.id, ip })

  const res = NextResponse.json({
    ok: true,
    actor: { name: actor.name, role: actor.role, ...(actor.email ? { email: actor.email } : {}) },
  })
  setAdminSessionCookie(res, token)
  return res
}
