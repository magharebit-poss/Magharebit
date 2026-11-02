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
import { isObjectId, PRODUCT_LIMITS } from '@/lib/product-input'

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

  if (!isObjectId(id)) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'invalid_json' }, { status: 400 })

  // A non-number delta used to become NaN and was $inc'ed into the stock; any size of decrease was accepted
  const delta  = typeof body.delta === 'number' && Number.isFinite(body.delta) ? body.delta : NaN
  const reason = (typeof body.reason === 'string' ? body.reason : 'manual_add') as StockAdjustReason
  const note   = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : undefined

  if (Number.isNaN(delta) || Math.abs(delta) > PRODUCT_LIMITS.qty) return NextResponse.json({ error: 'delta_invalid' }, { status: 422 })
  if (delta === 0)                     return NextResponse.json({ error: 'delta_must_be_nonzero' }, { status: 422 })
  if (!VALID_REASONS.includes(reason)) return NextResponse.json({ error: 'invalid_reason'       }, { status: 422 })

  // LAW 1: a manual adjustment can never take stock below zero (checked atomically in the repository)
  const { product, isLowStock, wouldGoNegative } = await productsRepo.adjustStock(
    session.merchantId, id, delta, reason, { note, floorAtZero: true }
  )
  if (wouldGoNegative) return NextResponse.json({ error: 'stock_would_be_negative' }, { status: 409 })
  if (!product) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ product, isLowStock })
}
