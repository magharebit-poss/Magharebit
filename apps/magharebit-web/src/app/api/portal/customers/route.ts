/**
 * GET  /api/portal/customers          — list customers (paged, searchable)
 * POST /api/portal/customers          — create a new customer
 *
 * Query params (GET):
 *   search  string  — matches name or phone
 *   page    number  — default 1
 *   limit   number  — default 50, max 100
 *
 * Body (POST):
 *   { name: string, phone: string, email?: string, notes?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { customersRepo } from '@/lib/repositories/customers'

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = req.nextUrl
  const page   = Math.max(1,   Number(searchParams.get('page')  ?? 1))
  const limit  = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)))
  const search = searchParams.get('search') ?? undefined

  const result = await customersRepo.findAll({
    merchantId: session.merchantId,
    page,
    limit,
    search,
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

  const name  = String(body.name  ?? '').trim()
  const phone = String(body.phone ?? '').trim()
  const email = String(body.email ?? '').trim() || undefined
  const notes = String(body.notes ?? '').trim() || undefined

  if (!name)  return NextResponse.json({ error: 'name_required'  }, { status: 422 })
  if (!phone) return NextResponse.json({ error: 'phone_required' }, { status: 422 })

  // Require at least 8 digits in phone
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 8) {
    return NextResponse.json({ error: 'phone_too_short' }, { status: 422 })
  }

  // Basic email check if provided
  if (email && !email.includes('@')) {
    return NextResponse.json({ error: 'email_invalid' }, { status: 422 })
  }

  try {
    const customer = await customersRepo.create({
      merchantId: session.merchantId,
      name,
      phone,
      email,
      notes,
    })
    return NextResponse.json({ customer }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'phone_already_exists') {
      return NextResponse.json({ error: 'phone_already_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'create_failed', detail: msg }, { status: 500 })
  }
}
