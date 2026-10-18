/**
 * POST /api/portal/employees/pin-login
 *
 * Verifies an employee PIN for POS cashier login.
 * Does NOT create a portal session — returns the employee record.
 * The POS UI stores employee context client-side for the current shift.
 *
 * Body: { loginId: string; pin: string }
 *
 * Response (200):
 *   { employee: { id, name, loginId, role, totalSales, txCount } }
 *
 * Response (401):
 *   { error: 'invalid_credentials' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { employeesRepo } from '@/lib/repositories/employees'

export async function POST(req: NextRequest): Promise<NextResponse> {
  // The portal session is required — the merchant must be logged in
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  let body: { loginId?: string; pin?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const loginId = String(body.loginId ?? '').trim()
  const pin     = String(body.pin     ?? '').trim()

  if (!loginId || !pin) {
    return NextResponse.json({ error: 'loginId_and_pin_required' }, { status: 422 })
  }

  const employee = await employeesRepo.verifyPin(session.merchantId, loginId, pin)

  if (!employee) {
    // Use a constant-time-looking response to avoid timing attacks
    await new Promise(r => setTimeout(r, 200))
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

  return NextResponse.json({ employee })
}
