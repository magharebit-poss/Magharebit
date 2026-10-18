/**
 * GET  /api/portal/employees  — list employees
 * POST /api/portal/employees  — create employee
 *
 * POST body:
 * {
 *   name: string
 *   loginId: string       // unique short ID, e.g. "ahmed01"
 *   pin: string           // 4–6 digits (stored as SHA-256 hash)
 *   role: 'cashier' | 'manager' | 'owner'
 *   phone?: string
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { employeesRepo } from '@/lib/repositories/employees'
import type { EmployeeRole } from '@/lib/repositories/employees'

const VALID_ROLES: EmployeeRole[] = ['cashier', 'manager', 'owner']

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = req.nextUrl
  const includeInactive = searchParams.get('includeInactive') === 'true'

  const employees = await employeesRepo.findAll(session.merchantId, includeInactive)
  return NextResponse.json({ employees })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const name    = String(body.name    ?? '').trim()
  const loginId = String(body.loginId ?? '').trim()
  const pin     = String(body.pin     ?? '').trim()
  const role    = (String(body.role ?? 'cashier').trim()) as EmployeeRole
  const phone   = String(body.phone   ?? '').trim() || undefined

  if (!name)                         return NextResponse.json({ error: 'name_required'     }, { status: 422 })
  if (!loginId)                      return NextResponse.json({ error: 'loginId_required'  }, { status: 422 })
  if (!pin)                          return NextResponse.json({ error: 'pin_required'       }, { status: 422 })
  if (!/^\d{4,6}$/.test(pin))        return NextResponse.json({ error: 'pin_must_be_4_to_6_digits' }, { status: 422 })
  if (!VALID_ROLES.includes(role))   return NextResponse.json({ error: 'invalid_role', valid: VALID_ROLES }, { status: 422 })

  try {
    const employee = await employeesRepo.create({
      merchantId: session.merchantId, name, loginId, pin, role, phone,
    })
    return NextResponse.json({ employee }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return NextResponse.json({ error: 'loginId_already_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'create_failed', detail: msg }, { status: 500 })
  }
}
