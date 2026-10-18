/**
 * POST /api/portal/auth/logout
 * Clears the portal session cookie.
 */

import { NextResponse } from 'next/server'
import { clearPortalSessionCookie } from '@/lib/portal-session'

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true })
  clearPortalSessionCookie(res)
  return res
}
