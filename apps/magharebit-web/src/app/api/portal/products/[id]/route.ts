/**
 * GET    /api/portal/products/[id]  — get single product
 * PATCH  /api/portal/products/[id]  — update product fields
 * DELETE /api/portal/products/[id]  — soft-delete product
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { productsRepo } from '@/lib/repositories/products'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  const { id } = await params

  const product = await productsRepo.findById(session.merchantId, id)
  if (!product) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ product })
}

export async function PATCH(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  const { id } = await params

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  // Whitelist updatable fields
  const allowed = ['name', 'category', 'price', 'costPrice', 'stock', 'minStock', 'unit', 'emoji', 'barcode', 'isActive']
  const update: Record<string, unknown> = {}
  for (const k of allowed) {
    if (k in body) update[k] = body[k]
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'no_fields_to_update' }, { status: 422 })
  }

  const product = await productsRepo.update(session.merchantId, id, update)
  if (!product) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ product })
}

export async function DELETE(req: NextRequest, { params }: Ctx): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  const { id } = await params

  const ok = await productsRepo.softDelete(session.merchantId, id)
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
