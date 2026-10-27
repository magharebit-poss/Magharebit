/**
 * GET  /api/admin/catalog/[kind]?q=&page=&limit=   (any admin)     kind = shop-type | cuisine | banner
 * POST /api/admin/catalog/[kind]  { name, description?, imageUrl?, active? }   (owner/operator)
 *
 * Admin-managed lists. Audited as createCatalogItem.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { catalogRepo, isCatalogKind, validImageUrl } from '@/lib/repositories/catalog'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }): Promise<NextResponse> {
  if (!(await authenticateAdmin(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { kind } = await params
  if (!isCatalogKind(kind)) return NextResponse.json({ error: 'unknown_kind' }, { status: 404 })
  const sp = new URL(req.url).searchParams
  const res = await catalogRepo.findAll(kind, {
    q: (sp.get('q') ?? '').slice(0, 60),
    page: parseInt(sp.get('page') ?? '1', 10) || 1,
    limit: parseInt(sp.get('limit') ?? '25', 10) || 25,
  })
  if (!res) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  return NextResponse.json(res)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ kind: string }> }): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(actor)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { kind } = await params
  if (!isCatalogKind(kind)) return NextResponse.json({ error: 'unknown_kind' }, { status: 404 })

  let b: Record<string, unknown>
  try { b = (await req.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
  const name = typeof b.name === 'string' ? b.name.trim() : ''
  const description = typeof b.description === 'string' ? b.description.trim() : ''
  const imageUrl = typeof b.imageUrl === 'string' ? b.imageUrl.trim() : ''
  if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'name must be 2-80 characters' }, { status: 422 })
  if (description.length > 300) return NextResponse.json({ error: 'description must be at most 300 characters' }, { status: 422 })
  if (!validImageUrl(imageUrl)) return NextResponse.json({ error: 'imageUrl must be an https URL or a path starting with /' }, { status: 422 })
  const active = b.active === undefined ? true : b.active === true
  if (b.active !== undefined && typeof b.active !== 'boolean') return NextResponse.json({ error: 'active must be a boolean' }, { status: 422 })

  const item = await catalogRepo.create({ kind, name, description, imageUrl, active, createdBy: actor.name })
  if (!item) return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  const auditRecorded = await recordAudit({
    actor, action: 'createCatalogItem', targetType: 'catalog', targetId: item.id,
    meta: { kind, name, active }, ip: clientIp(req),
  })
  return NextResponse.json({ item, auditRecorded }, { status: 201 })
}
