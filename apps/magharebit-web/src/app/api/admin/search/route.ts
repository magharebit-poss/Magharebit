/**
 * GET /api/admin/search?q=   (any signed-in admin role: read-only)
 *
 * Global search for the console's Ctrl+K / Cmd+K palette. Up to 5 hits per group (merchants, licenses, leads,
 * coupons); each hit carries `q`, the value that opens the matching admin table already filtered.
 * Admin pages and settings are matched in the browser from a static list, not here.
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminUnauthorized, authenticateAdmin } from '@/lib/admin-auth'
import { getDb } from '@/lib/mongodb'
import { checkRateLimit } from '@/lib/rateLimit'
import { normaliseQuery, searchAdmin } from '@/lib/admin-search'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return adminUnauthorized()

  const q = normaliseQuery(req.nextUrl.searchParams.get('q') ?? '')
  if (!q) return NextResponse.json({ error: 'query_too_short' }, { status: 422 })
  if (!(await checkRateLimit(`admin-search:${actor.id}`, 90, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const db = await getDb()
  if (!db) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  try {
    const results = await searchAdmin(db, q)
    return NextResponse.json({ q, results }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    console.error('[GET /api/admin/search]', err)
    return NextResponse.json({ error: 'internal_error' }, { status: 500 })
  }
}
