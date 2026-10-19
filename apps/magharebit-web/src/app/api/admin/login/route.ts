import { NextRequest, NextResponse } from 'next/server'
import {
  checkAdminPassword,
  createAdminSessionToken,
  isAdminConfigured,
  setAdminSessionCookie,
} from '@/lib/admin-auth'
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * POST /api/admin/login   { password: string }
 * Verifies the password server-side against ADMIN_SECRET and sets the
 * HttpOnly admin session cookie. The secret itself is never sent to the client.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAdminConfigured()) {
    return NextResponse.json({ error: 'admin_not_configured' }, { status: 503 })
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!checkRateLimit(`admin-login:${ip}`, 10, 15 * 60 * 1000)) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let password = ''
  try {
    const body = (await req.json()) as { password?: unknown }
    if (typeof body.password === 'string') password = body.password
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!password || !checkAdminPassword(password)) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

  const token = createAdminSessionToken()
  if (!token) {
    return NextResponse.json({ error: 'admin_not_configured' }, { status: 503 })
  }

  const res = NextResponse.json({ ok: true })
  setAdminSessionCookie(res, token)
  return res
}
