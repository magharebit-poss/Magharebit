/**
 * GET  /api/portal/settings  — fetch merchant settings (auto-creates defaults on first call)
 * PATCH /api/portal/settings — update one or more fields
 *
 * All fields are optional on PATCH — send only what changed.
 * Unknown fields are silently ignored (whitelist enforced by repo).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { settingsRepo, SETTINGS_PATCHABLE } from '@/lib/repositories/settings'

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const settings = await settingsRepo.get(session.merchantId)
  return NextResponse.json(settings)
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  // Extract only whitelisted fields
  const data: Record<string, unknown> = {}
  for (const key of SETTINGS_PATCHABLE) {
    if (key in body) data[key] = body[key]
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'no_valid_fields', valid: SETTINGS_PATCHABLE }, { status: 422 })
  }

  // Type validation — booleans
  const BOOL_FIELDS = [
    'whatsappEnabled', 'dailyReportEnabled', 'lowStockAlert', 'receiptShowLogo',
    'taxEnabled', 'discountEnabled', 'customerWhatsappReceiptEnabled',
  ] as const
  for (const f of BOOL_FIELDS) {
    if (f in data && typeof data[f] !== 'boolean') {
      return NextResponse.json({ error: `${f}_must_be_boolean` }, { status: 422 })
    }
  }

  // Type validation — strings
  const STR_FIELDS = ['storeName', 'storePhone', 'sector', 'timezone', 'dailyReportTime', 'receiptHeader', 'receiptFooter'] as const
  for (const f of STR_FIELDS) {
    if (f in data && typeof data[f] !== 'string') {
      return NextResponse.json({ error: `${f}_must_be_string` }, { status: 422 })
    }
  }

  // HH:MM format for report time
  if ('dailyReportTime' in data) {
    const t = data.dailyReportTime as string
    if (!/^\d{2}:\d{2}$/.test(t) || parseInt(t.slice(0, 2)) > 23 || parseInt(t.slice(3)) > 59) {
      return NextResponse.json({ error: 'dailyReportTime_must_be_HH_MM' }, { status: 422 })
    }
  }

  // Phone: strip, accept Moroccan formats only (optional — allow empty to unset)
  if ('storePhone' in data && data.storePhone !== '') {
    const digits = (data.storePhone as string).replace(/\D/g, '')
    if (digits.length < 9 || digits.length > 12) {
      return NextResponse.json({ error: 'storePhone_invalid_format' }, { status: 422 })
    }
  }

  // Sprint 3 — TVA: defaultTaxRate must be one of the allowed Moroccan rates
  if ('defaultTaxRate' in data) {
    const rate = data.defaultTaxRate
    if (![0, 7, 10, 14, 20].includes(rate as number)) {
      return NextResponse.json(
        { error: 'defaultTaxRate_invalid', allowed: [0, 7, 10, 14, 20] },
        { status: 422 }
      )
    }
  }

  // Sprint 3 — Discounts: maxDiscountPercent must be a finite number 0–100
  if ('maxDiscountPercent' in data) {
    const pct = data.maxDiscountPercent
    if (typeof pct !== 'number' || !Number.isFinite(pct) || pct < 0 || pct > 100) {
      return NextResponse.json(
        { error: 'maxDiscountPercent_must_be_0_to_100' },
        { status: 422 }
      )
    }
    // Store as integer — fractional discount ceilings are not useful
    data.maxDiscountPercent = Math.round(pct as number)
  }

  try {
    const updated = await settingsRepo.update(
      session.merchantId,
      data as Parameters<typeof settingsRepo.update>[1]
    )
    return NextResponse.json(updated)
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: 'update_failed', detail }, { status: 500 })
  }
}
