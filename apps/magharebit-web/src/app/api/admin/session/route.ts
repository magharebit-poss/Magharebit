import { NextRequest, NextResponse } from 'next/server'
import { adminUnauthorized, authenticateAdmin } from '@/lib/admin-auth'

/** GET /api/admin/session: 200 with the current actor if the session is valid, else 401. */
export async function GET(req: NextRequest): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return adminUnauthorized()
  return NextResponse.json({
    authenticated: true,
    actor: { name: actor.name, role: actor.role, ...(actor.email ? { email: actor.email } : {}) },
  })
}
