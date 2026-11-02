/**
 * GET  /api/portal/products  — list products (with search, filter, pagination)
 * POST /api/portal/products  — create a new product
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { productsRepo } from '@/lib/repositories/products'
import type { ProductUnit } from '@/lib/repositories/products'
import { PRODUCT_LIMITS, validateProductInput } from '@/lib/product-input'
import { internalError } from '@/lib/server-error'

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

  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'invalid_json' }, { status: 400 })

  // The UI's existing error codes first (it translates these three)
  if (typeof body.name !== 'string' || !body.name.trim())         return NextResponse.json({ error: 'name_required'     }, { status: 422 })
  if (typeof body.category !== 'string' || !body.category.trim()) return NextResponse.json({ error: 'category_required' }, { status: 422 })
  if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0) return NextResponse.json({ error: 'price_invalid' }, { status: 422 })

  // Every field typed and bounded (lib/product-input.ts). An empty optional field arrives as null: use its default.
  const input = Object.fromEntries(Object.entries(body).filter(([, v]) => v !== null))
  const checked = validateProductInput(input)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 422 })
  const d = checked.data
  if (body.plu !== undefined && body.plu !== null && (typeof body.plu !== 'string' || body.plu.trim().length > PRODUCT_LIMITS.plu)) {
    return NextResponse.json({ error: 'plu_invalid' }, { status: 422 })
  }

  try {
    const product = await productsRepo.create(session.merchantId, {
      name:       d.name!,
      category:   d.category!,
      price:      d.price!,
      costPrice:  d.costPrice ?? 0,
      stock:      d.stock     ?? 0,
      minStock:   d.minStock  ?? 5,
      unit:       (d.unit ?? 'pièce') as ProductUnit,
      emoji:      d.emoji || '📦',
      plu:        typeof body.plu === 'string' ? body.plu.trim() || undefined : undefined,
      barcode:    d.barcode || undefined,
      isActive:   true,
    })
    return NextResponse.json({ product }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    if (msg.includes('duplicate') || msg.includes('unique')) {
      return NextResponse.json({ error: 'plu_already_exists' }, { status: 409 })
    }
    return internalError('portal/products', err, 'create_failed')
  }
}
