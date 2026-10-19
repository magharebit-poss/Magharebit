import { NextResponse } from 'next/server'
import { clearAdminSessionCookie } from '@/lib/admin-auth'

/** POST /api/admin/logout — clears the admin session cookie. */
export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true })
  clearAdminSessionCookie(res)
  return res
}
