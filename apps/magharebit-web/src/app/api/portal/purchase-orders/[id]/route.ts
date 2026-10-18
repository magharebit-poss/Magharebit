/**
 * GET   /api/portal/purchase-orders/[id]  — fetch single order
 * PATCH /api/portal/purchase-orders/[id]  — update status / notes / expectedAt
 *
 * PATCH allowed transitions:
 *   draft     → ordered | cancelled
 *   ordered   → cancelled
 *   partial   → cancelled          (rare, but supported)
 *   received  → (no change allowed)
 *   cancelled → (no change allowed)
 *
 * 'received' and 'partial' are set exclusively by the receive endpoint.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { purchaseOrdersRepo } from '@/lib/repositories/purchase-orders'
import type { PurchaseOrderStatus } from '@/lib/repositories/purchase-orders'

type Ctx = { params: Promise<{ id: string }> }

// Transitions allowed via PATCH (receive endpoint handles partial/received)
const ALLOWED_TRANSITIONS: Partial<Record<PurchaseOrderStatus, PurchaseOrderStatus[]>> = {
  draft:   ['ordered', 'cancelled'],
  ordered: ['cancelled'],
  partial: ['cancelled'],
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  const { id } = await params

  const order = await purchaseOrdersRepo.findById(session.merchantId, id)
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ order })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  // Fetch current order to validate transition
  const current = await purchaseOrdersRepo.findById(session.merchantId, id)
  if (!current) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const data: Parameters<typeof purchaseOrdersRepo.update>[2] = {}

  if ('status' in body) {
    const newStatus = String(body.status ?? '') as PurchaseOrderStatus
    const allowed   = ALLOWED_TRANSITIONS[current.status] ?? []
    if (!allowed.includes(newStatus)) {
      return NextResponse.json({
        error:   'invalid_transition',
        from:    current.status,
        to:      newStatus,
        allowed,
      }, { status: 422 })
    }
    data.status = newStatus
  }

  if ('notes'      in body) data.notes      = String(body.notes ?? '').trim()
  if ('expectedAt' in body) {
    if (body.expectedAt === null) {
      data.expectedAt = null
    } else {
      const d = new Date(String(body.expectedAt))
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: 'expectedAt_invalid_date' }, { status: 422 })
      }
      data.expectedAt = d
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'no_valid_fields' }, { status: 422 })
  }

  const updated = await purchaseOrdersRepo.update(session.merchantId, id, data)
  if (!updated) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ order: updated })
}
