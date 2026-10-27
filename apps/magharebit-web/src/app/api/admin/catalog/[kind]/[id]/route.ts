/**
 * PATCH /api/admin/catalog/[kind]/[id]  { name?, description?, imageUrl?, active? }   (owner/operator)
 * Edit an item or flip its status toggle. Audited as updateCatalogItem with the changed fields.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { catalogRepo, isCatalogKind, validImageUrl, type CatalogItem } from '@/lib/repositories/catalog'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ kind: string; id: string }> }
): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(actor)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  const { kind, id } = await params
  if (!isCatalogKind(kind)) return NextResponse.json({ error: 'unknown_kind' }, { status: 404 })

  let b: Record<string, unknown>
  try { b = (await req.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const patch: Partial<Pick<CatalogItem, 'name' | 'description' | 'imageUrl' | 'active'>> = {}
  if (b.name !== undefined) {
    const v = typeof b.name === 'string' ? b.name.trim() : ''
    if (v.length < 2 || v.length > 80) return NextResponse.json({ error: 'name must be 2-80 characters' }, { status: 422 })
    patch.name = v
  }
  if (b.description !== undefined) {
    const v = typeof b.description === 'string' ? b.description.trim() : null
    if (v === null || v.length > 300) return NextResponse.json({ error: 'description must be at most 300 characters' }, { status: 422 })
    patch.description = v
  }
  if (b.imageUrl !== undefined) {
    const v = typeof b.imageUrl === 'string' ? b.imageUrl.trim() : null
    if (v === null || !validImageUrl(v)) return NextResponse.json({ error: 'imageUrl must be an https URL or a path starting with /' }, { status: 422 })
    patch.imageUrl = v
  }
  if (b.active !== undefined) {
    if (typeof b.active !== 'boolean') return NextResponse.json({ error: 'active must be a boolean' }, { status: 422 })
    patch.active = b.active
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 422 })

  const item = await catalogRepo.update(kind, id, patch, actor.name)
  if (!item) return NextResponse.json({ error: 'item_not_found' }, { status: 404 })
  const auditRecorded = await recordAudit({
    actor, action: 'updateCatalogItem', targetType: 'catalog', targetId: id,
    meta: { kind, name: item.name, changed: Object.keys(patch), ...('active' in patch ? { active: patch.active } : {}) }, ip: clientIp(req),
  })
  return NextResponse.json({ item, auditRecorded })
}
