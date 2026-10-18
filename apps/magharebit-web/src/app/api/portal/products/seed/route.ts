/**
 * POST /api/portal/products/seed
 *
 * Seeds the merchant's product catalogue from a sector template.
 * Idempotent: if products already exist it returns 409 to prevent accidental overwrite.
 *
 * Body: { sector: string, force?: boolean }
 *   force=true  → delete existing products first, then seed fresh
 *   force=false → (default) reject with 409 if products already exist
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { productsRepo } from '@/lib/repositories/products'
import { getTemplate, getSectorKeys } from '@/lib/seed/sector-templates'
import { getDb } from '@/lib/mongodb'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  let body: { sector?: string; force?: boolean }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const sector = (body.sector ?? '').trim().toLowerCase()
  const force  = body.force === true

  const validSectors = getSectorKeys()
  if (!sector || !validSectors.includes(sector as never)) {
    return NextResponse.json({
      error:          'invalid_sector',
      validSectors,
    }, { status: 422 })
  }

  const templates = getTemplate(sector)
  if (templates.length === 0) {
    return NextResponse.json({ error: 'template_empty' }, { status: 422 })
  }

  // Check if products already exist
  const db = await getDb()
  if (!db) return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  const collection  = db.collection('products')
  const existingCount = await collection.countDocuments({
    merchantId: session.merchantId,
    isActive:   true,
  })

  if (existingCount > 0 && !force) {
    return NextResponse.json({
      error:   'products_already_exist',
      count:   existingCount,
      hint:    'Pass force=true to delete existing products and reseed',
    }, { status: 409 })
  }

  // force=true → soft-delete all existing products first
  if (existingCount > 0 && force) {
    await collection.updateMany(
      { merchantId: session.merchantId, isActive: true },
      { $set: { isActive: false, updatedAt: new Date() } }
    )
  }

  // Seed from template
  const seededCount = await productsRepo.seedFromTemplate(session.merchantId, templates)

  return NextResponse.json({
    ok:     true,
    sector,
    seeded: seededCount,
  }, { status: 201 })
}
