/**
 * POST /api/portal/purchase-orders/[id]/receive
 *
 * Records the receipt of goods and increments product stock.
 *
 * Body:
 * {
 *   items: { productId: string; qtyReceive: number }[]
 * }
 *
 * Rules:
 *   - PO must exist and belong to this merchant.
 *   - PO status must be draft, ordered, or partial (not received or cancelled).
 *   - qtyReceive is automatically capped at remaining (qtyOrdered − qtyReceived).
 *   - Items not included in the call are left unchanged (partial-receive semantics).
 *   - Stock is incremented atomically via productsRepo.adjustStock (reason: 'purchase').
 *   - Status advances to 'received' if all lines are now fully received, else 'partial'.
 *
 * Response: { order, stockUpdates: [{ productId, productName, qty }] }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { purchaseOrdersRepo } from '@/lib/repositories/purchase-orders'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const rawItems = Array.isArray(body.items) ? body.items : []
  if (rawItems.length === 0) {
    return NextResponse.json({ error: 'items_required' }, { status: 422 })
  }

  const items: Array<{ productId: string; qtyReceive: number }> = []
  for (const raw of rawItems) {
    const productId  = String(raw?.productId  ?? '').trim()
    const qtyReceive = Number(raw?.qtyReceive ?? 0)
    if (!productId) return NextResponse.json({ error: 'item_missing_productId' }, { status: 422 })
    if (!Number.isInteger(qtyReceive) || qtyReceive <= 0) {
      return NextResponse.json({ error: 'item_qty_must_be_positive_integer', productId }, { status: 422 })
    }
    items.push({ productId, qtyReceive })
  }

  try {
    const result = await purchaseOrdersRepo.receive(session.merchantId, id, items)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg === 'not_found')         return NextResponse.json({ error: 'not_found' },         { status: 404 })
    if (msg === 'invalid_id')        return NextResponse.json({ error: 'not_found' },         { status: 404 })
    if (msg === 'nothing_to_receive') return NextResponse.json({ error: 'nothing_to_receive' }, { status: 422 })
    if (msg.startsWith('cannot_receive:')) {
      const status = msg.split(':')[1]
      return NextResponse.json({ error: 'order_not_receivable', status }, { status: 422 })
    }
    if (msg.startsWith('product_not_in_order:')) {
      return NextResponse.json({ error: msg }, { status: 422 })
    }
    if (msg.startsWith('invalid_qty:')) {
      return NextResponse.json({ error: msg }, { status: 422 })
    }
    return NextResponse.json({ error: 'receive_failed', detail: msg }, { status: 500 })
  }
}
