/**
 * POST /api/portal/products/[id]/adjust
 *
 * Manual stock adjustment (add or remove units).
 * Body: { delta: number, reason: StockAdjustReason, note?: string }
 *
 * Returns updated product + isLowStock flag.
 * Caller can use isLowStock to trigger WhatsApp alert (Phase B).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { productsRepo } from '@/lib/repositories/products'
import type { StockAdjustReason } from '@/lib/repositories/products'

const VALID_REASONS: StockAdjustReason[] = [
  'manual_add', 'manual_remove', 'purchase', 'return', 'initial',
]

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  const { id } = await params

  let body: { delta?: number; reason?: string; note?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const delta  = Number(body.delta ?? 0)
  const reason = (body.reason ?? 'manual_add') as StockAdjustReason
  const note   = body.note?.trim()

  if (delta === 0)                     return NextResponse.json({ error: 'delta_must_be_nonzero' }, { status: 422 })
  if (!VALID_REASONS.includes(reason)) return NextResponse.json({ error: 'invalid_reason'       }, { status: 422 })

  const { product, isLowStock } = await productsRepo.adjustStock(
    session.merchantId, id, delta, reason, { note }
  )
  if (!product) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ product, isLowStock })
}
