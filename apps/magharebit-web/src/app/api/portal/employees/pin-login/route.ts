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
import { checkRateLimit } from '@/lib/rateLimit'

/**
 * A PIN is 4–6 digits (10 000 values at 4). Without a limit, anyone at the till with the merchant session could try
 * them all against a manager or owner login. 10 attempts per merchant + login per 15 minutes, counted in the shared
 * MongoDB store so every server instance sees the same count. Every attempt counts (a lockout checked only after a
 * failure would still let a correct guess through), so the allowance leaves room for normal shift changes; a full
 * 4-digit search now takes days instead of minutes.
 */
const PIN_ATTEMPTS = 10
const PIN_WINDOW_MS = 15 * 60 * 1000

export async function POST(req: NextRequest): Promise<NextResponse> {
  // The portal session is required — the merchant must be logged in
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  let body: { loginId?: string; pin?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const loginId = typeof body.loginId === 'string' ? body.loginId.trim().toLowerCase() : ''
  const pin     = typeof body.pin     === 'string' ? body.pin.trim()                 : ''

  if (!loginId || !pin) {
    return NextResponse.json({ error: 'loginId_and_pin_required' }, { status: 422 })
  }

  // Counted before the check, so correct and wrong guesses cost the same; the key holds no PIN
  if (!(await checkRateLimit(`pin-login:${session.merchantId}:${loginId}`, PIN_ATTEMPTS, PIN_WINDOW_MS))) {
    return NextResponse.json({ error: 'too_many_attempts' }, { status: 429, headers: { 'Retry-After': String(PIN_WINDOW_MS / 1000) } })
  }

  const employee = await employeesRepo.verifyPin(session.merchantId, loginId, pin)

  if (!employee) {
    // Use a constant-time-looking response to avoid timing attacks
    await new Promise(r => setTimeout(r, 200))
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 })
  }

  return NextResponse.json({ employee })
}
