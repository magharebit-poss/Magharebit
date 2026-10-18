/**
 * GET    /api/portal/employees/[id]  — get single employee
 * PATCH  /api/portal/employees/[id]  — update employee
 * DELETE /api/portal/employees/[id]  — soft-delete employee
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { employeesRepo } from '@/lib/repositories/employees'
import type { EmployeeRole } from '@/lib/repositories/employees'

const VALID_ROLES: EmployeeRole[] = ['cashier', 'manager', 'owner']

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  const { id } = await params

  const employee = await employeesRepo.findById(session.merchantId, id)
  if (!employee) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ employee })
}

export async function PATCH(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  // Validate pin if provided
  if (body.pin !== undefined) {
    const pin = String(body.pin).trim()
    if (!/^\d{4,6}$/.test(pin)) {
      return NextResponse.json({ error: 'pin_must_be_4_to_6_digits' }, { status: 422 })
    }
  }

  // Validate role if provided
  if (body.role !== undefined && !VALID_ROLES.includes(body.role as EmployeeRole)) {
    return NextResponse.json({ error: 'invalid_role', valid: VALID_ROLES }, { status: 422 })
  }

  const allowed = ['name', 'phone', 'role', 'pin', 'isActive']
  const update: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) update[k] = body[k]
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_fields_to_update' }, { status: 422 })
  }

  const employee = await employeesRepo.update(session.merchantId, id, update)
  if (!employee) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ employee })
}

export async function DELETE(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  const { id } = await params

  const ok = await employeesRepo.softDelete(session.merchantId, id)
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
