import { NextRequest, NextResponse } from 'next/server'
import { adminUnauthorized, isAdminRequest } from '@/lib/admin-auth'

/** GET /api/admin/session — 200 if the caller has a valid admin session, else 401. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAdminRequest(req)) return adminUnauthorized()
  return NextResponse.json({ authenticated: true })
}
