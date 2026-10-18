/**
 * GET   /api/portal/whatsapp/campaigns/[id]  — fetch one campaign
 * PATCH /api/portal/whatsapp/campaigns/[id]  — update a draft campaign
 *
 * PATCH body (all fields optional):
 * {
 *   title?:           string
 *   messageTemplate?: string
 *   targetAudience?:  'all' | 'bronze' | 'silver' | 'gold'
 * }
 *
 * PATCH returns 409 if campaign is no longer in 'draft' status.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { campaignsRepo, type CampaignAudience } from '@/lib/repositories/whatsapp-campaigns'

const VALID_AUDIENCES: CampaignAudience[] = ['all', 'bronze', 'silver', 'gold']

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const { id } = await context.params
  const campaign = await campaignsRepo.findById(session.merchantId, id)
  if (!campaign) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ campaign })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const { id } = await context.params

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: Record<string, any> = {}

  if (body.title !== undefined) {
    const t = String(body.title).trim()
    if (!t) return NextResponse.json({ error: 'title_cannot_be_empty' }, { status: 422 })
    data.title = t
  }
  if (body.messageTemplate !== undefined) {
    const m = String(body.messageTemplate).trim()
    if (!m) return NextResponse.json({ error: 'messageTemplate_cannot_be_empty' }, { status: 422 })
    data.messageTemplate = m
  }
  if (body.targetAudience !== undefined) {
    const a = String(body.targetAudience).trim() as CampaignAudience
    if (!VALID_AUDIENCES.includes(a)) {
      return NextResponse.json(
        { error: 'invalid_targetAudience', valid: VALID_AUDIENCES },
        { status: 422 }
      )
    }
    data.targetAudience = a
  }

  try {
    const updated = await campaignsRepo.update(session.merchantId, id, data)
    if (!updated) {
      // Either not found or not in draft status
      const existing = await campaignsRepo.findById(session.merchantId, id)
      if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 })
      return NextResponse.json(
        { error: 'campaign_not_editable', status: existing.status },
        { status: 409 }
      )
    }
    return NextResponse.json({ campaign: updated })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: 'update_failed', detail: msg }, { status: 500 })
  }
}
