/**
 * GET   /api/portal/customers/[id]  — fetch single customer
 * PATCH /api/portal/customers/[id]  — update name / phone / email / notes / isActive
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { customersRepo } from '@/lib/repositories/customers'

type Ctx = { params: Promise<{ id: string }> }

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  const { id } = await params

  const customer = await customersRepo.findById(session.merchantId, id)
  if (!customer) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ customer })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  // Whitelist patchable fields
  const data: Parameters<typeof customersRepo.update>[2] = {}

  if ('name'     in body) {
    const name = String(body.name ?? '').trim()
    if (!name) return NextResponse.json({ error: 'name_required' }, { status: 422 })
    data.name = name
  }
  if ('phone' in body) {
    const phone  = String(body.phone ?? '').trim()
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 8) return NextResponse.json({ error: 'phone_too_short' }, { status: 422 })
    data.phone = phone
  }
  if ('email' in body) {
    const email = String(body.email ?? '').trim()
    if (email && !email.includes('@')) {
      return NextResponse.json({ error: 'email_invalid' }, { status: 422 })
    }
    data.email = email
  }
  if ('notes'    in body) data.notes    = String(body.notes    ?? '').trim()
  if ('isActive' in body) {
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive_must_be_boolean' }, { status: 422 })
    }
    data.isActive = body.isActive
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'no_valid_fields' }, { status: 422 })
  }

  try {
    const updated = await customersRepo.update(session.merchantId, id, data)
    if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    return NextResponse.json({ customer: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    if (msg === 'phone_already_exists') {
      return NextResponse.json({ error: 'phone_already_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'update_failed', detail: msg }, { status: 500 })
  }
}
