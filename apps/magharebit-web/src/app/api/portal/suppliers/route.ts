/**
 * GET  /api/portal/suppliers   — list suppliers (search, page, limit)
 * POST /api/portal/suppliers   — create a supplier
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { suppliersRepo } from '@/lib/repositories/suppliers'

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = req.nextUrl
  const page   = Math.max(1,   Number(searchParams.get('page')  ?? 1))
  const limit  = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)))
  const search = searchParams.get('search') ?? undefined

  const result = await suppliersRepo.findAll({
    merchantId: session.merchantId,
    search,
    page,
    limit,
  })

  return NextResponse.json(result)
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const name    = String(body.name    ?? '').trim()
  const phone   = String(body.phone   ?? '').trim()
  const email   = String(body.email   ?? '').trim()
  const address = String(body.address ?? '').trim()
  const notes   = String(body.notes   ?? '').trim()

  if (!name) return NextResponse.json({ error: 'name_required' }, { status: 422 })
  if (name.length > 120) return NextResponse.json({ error: 'name_too_long' }, { status: 422 })

  if (email && !email.includes('@')) {
    return NextResponse.json({ error: 'email_invalid' }, { status: 422 })
  }

  try {
    const supplier = await suppliersRepo.create({
      merchantId: session.merchantId,
      name,
      phone:   phone   || undefined,
      email:   email   || undefined,
      address: address || undefined,
      notes:   notes   || undefined,
    })
    return NextResponse.json({ supplier }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'name_already_exists') {
      return NextResponse.json({ error: 'name_already_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'create_failed', detail: msg }, { status: 500 })
  }
}
