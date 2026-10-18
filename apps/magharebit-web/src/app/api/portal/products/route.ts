/**
 * GET  /api/portal/products  — list products (with search, filter, pagination)
 * POST /api/portal/products  — create a new product
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { productsRepo } from '@/lib/repositories/products'
import type { ProductUnit } from '@/lib/repositories/products'

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const { searchParams } = req.nextUrl
  const search   = searchParams.get('search')  ?? undefined
  const category = searchParams.get('category') ?? undefined
  const lowStock = searchParams.get('lowStock') === 'true'
  const page     = Math.max(1, Number(searchParams.get('page')  ?? 1))
  const limit    = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 50)))

  const result = await productsRepo.findAll({
    merchantId: session.merchantId,
    search,
    category,
    lowStock,
    page,
    limit,
  })

  const categories = await productsRepo.getCategories(session.merchantId)

  return NextResponse.json({ ...result, categories })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const name     = String(body.name     ?? '').trim()
  const category = String(body.category ?? '').trim()
  const price    = Number(body.price    ?? 0)

  if (!name)     return NextResponse.json({ error: 'name_required'     }, { status: 422 })
  if (!category) return NextResponse.json({ error: 'category_required' }, { status: 422 })
  if (price < 0) return NextResponse.json({ error: 'price_invalid'     }, { status: 422 })

  try {
    const product = await productsRepo.create(session.merchantId, {
      name,
      category,
      price,
      costPrice:  Number(body.costPrice ?? 0),
      stock:      Number(body.stock     ?? 0),
      minStock:   Number(body.minStock  ?? 5),
      unit:       (body.unit as ProductUnit) ?? 'pièce',
      emoji:      String(body.emoji     ?? '📦').trim(),
      plu:        String(body.plu       ?? '').trim() || undefined,
      barcode:    String(body.barcode   ?? '').trim() || undefined,
      isActive:   true,
    })
    return NextResponse.json({ product }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return NextResponse.json({ error: 'plu_already_exists' }, { status: 409 })
    }
    return NextResponse.json({ error: 'create_failed', detail: msg }, { status: 500 })
  }
}
