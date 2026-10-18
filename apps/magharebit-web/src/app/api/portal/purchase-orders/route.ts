/**
 * GET  /api/portal/purchase-orders  — list purchase orders (paged, filterable)
 * POST /api/portal/purchase-orders  — create a draft purchase order
 *
 * POST body:
 * {
 *   supplierId: string
 *   items: {
 *     productId:  string
 *     qtyOrdered: number   (positive integer)
 *     unitCost:   number   (≥ 0)
 *   }[]
 *   notes?:      string
 *   expectedAt?: string    ISO date
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { purchaseOrdersRepo } from '@/lib/repositories/purchase-orders'
import type { PurchaseOrderStatus } from '@/lib/repositories/purchase-orders'
import { suppliersRepo } from '@/lib/repositories/suppliers'
import { productsRepo } from '@/lib/repositories/products'

const VALID_STATUSES: PurchaseOrderStatus[] = ['draft', 'ordered', 'partial', 'received', 'cancelled']

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = req.nextUrl
  const page       = Math.max(1,   Number(searchParams.get('page')  ?? 1))
  const limit      = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 20)))
  const supplierId = searchParams.get('supplierId') ?? undefined
  const rawStatus  = searchParams.get('status') ?? undefined
  const status     = rawStatus && VALID_STATUSES.includes(rawStatus as PurchaseOrderStatus)
    ? (rawStatus as PurchaseOrderStatus)
    : undefined

  const result = await purchaseOrdersRepo.findAll({
    merchantId: session.merchantId,
    supplierId,
    status,
    page,
    limit,
  })

  return NextResponse.json(result)
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const supplierId = String(body.supplierId ?? '').trim()
  if (!supplierId) return NextResponse.json({ error: 'supplierId_required' }, { status: 422 })

  // Validate supplier belongs to this merchant
  const supplier = await suppliersRepo.findById(session.merchantId, supplierId)
  if (!supplier) return NextResponse.json({ error: 'supplier_not_found' }, { status: 404 })
  if (!supplier.isActive) return NextResponse.json({ error: 'supplier_inactive' }, { status: 422 })

  // Validate items
  const rawItems = Array.isArray(body.items) ? body.items : []
  if (rawItems.length === 0) return NextResponse.json({ error: 'items_required' }, { status: 422 })

  const items: Array<{
    productId:   string
    productName: string
    productPlu?: string
    qtyOrdered:  number
    unitCost:    number
  }> = []

  for (const raw of rawItems) {
    const productId  = String(raw?.productId  ?? '').trim()
    const qtyOrdered = Number(raw?.qtyOrdered ?? 0)
    const unitCost   = Number(raw?.unitCost   ?? 0)

    if (!productId) return NextResponse.json({ error: 'item_missing_productId' }, { status: 422 })
    if (!Number.isInteger(qtyOrdered) || qtyOrdered < 1) {
      return NextResponse.json({ error: 'item_qty_must_be_positive_integer', productId }, { status: 422 })
    }
    if (unitCost < 0) {
      return NextResponse.json({ error: 'item_unitCost_invalid', productId }, { status: 422 })
    }

    // Resolve product name + PLU (snapshot)
    const product = await productsRepo.findById(session.merchantId, productId)
    if (!product) return NextResponse.json({ error: `product_not_found:${productId}` }, { status: 404 })

    items.push({
      productId,
      productName: product.name,
      productPlu:  product.plu,
      qtyOrdered,
      unitCost,
    })
  }

  const notes      = String(body.notes ?? '').trim() || undefined
  const rawExpected = body.expectedAt ? String(body.expectedAt) : undefined
  const expectedAt  = rawExpected ? new Date(rawExpected) : undefined
  if (expectedAt && isNaN(expectedAt.getTime())) {
    return NextResponse.json({ error: 'expectedAt_invalid_date' }, { status: 422 })
  }

  const order = await purchaseOrdersRepo.create({
    merchantId:   session.merchantId,
    supplierId,
    supplierName: supplier.name,
    items,
    notes,
    expectedAt,
  })

  return NextResponse.json({ order }, { status: 201 })
}
