/**
 * GET /api/admin/dashboard   (any signed-in admin role: read-only)
 *
 * Command Center figures: portal sales today vs yesterday, 7-day portal sales, active licenses, terminals and
 * merchants online, recent audit activity. See lib/admin-metrics.ts for definitions and caveats.
 *
 *   ?fresh=1  skip the 30-second server cache (the Refresh button); rate-limited per admin.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminUnauthorized, authenticateAdmin } from '@/lib/admin-auth'
import { getDashboardMetrics } from '@/lib/admin-metrics'
import { checkRateLimit } from '@/lib/rateLimit'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return adminUnauthorized()

  const wantsFresh = req.nextUrl.searchParams.get('fresh') === '1'
  const fresh = wantsFresh && (await checkRateLimit(`admin-dashboard-fresh:${actor.id}`, 20, 60_000))

  try {
    const metrics = await getDashboardMetrics({ fresh })
    if (!metrics) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
    return NextResponse.json(metrics, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    console.error('[GET /api/admin/dashboard]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
