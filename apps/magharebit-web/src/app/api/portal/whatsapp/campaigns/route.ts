/**
 * GET  /api/portal/whatsapp/campaigns  — list all campaigns for the merchant
 * POST /api/portal/whatsapp/campaigns  — create a new draft campaign
 *
 * POST body:
 * {
 *   title:           string     — campaign name (required, non-empty)
 *   messageTemplate: string     — message body, supports {name} placeholder (required)
 *   targetAudience:  'all' | 'bronze' | 'silver' | 'gold'  (default: 'all')
 * }
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { campaignsRepo, type CampaignAudience } from '@/lib/repositories/whatsapp-campaigns'

const VALID_AUDIENCES: CampaignAudience[] = ['all', 'bronze', 'silver', 'gold']

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const campaigns = await campaignsRepo.findAll(session.merchantId)
  return NextResponse.json({ campaigns })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  let body: Record<string, unknown>
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }

  const title           = String(body.title           ?? '').trim()
  const messageTemplate = String(body.messageTemplate ?? '').trim()
  const rawAudience     = String(body.targetAudience  ?? 'all').trim() as CampaignAudience

  if (!title) {
    return NextResponse.json({ error: 'title_required' }, { status: 422 })
  }
  if (!messageTemplate) {
    return NextResponse.json({ error: 'messageTemplate_required' }, { status: 422 })
  }
  if (!VALID_AUDIENCES.includes(rawAudience)) {
    return NextResponse.json(
      { error: 'invalid_targetAudience', valid: VALID_AUDIENCES },
      { status: 422 }
    )
  }

  try {
    const campaign = await campaignsRepo.create({
      merchantId:      session.merchantId,
      title,
      messageTemplate,
      targetAudience:  rawAudience,
    })
    return NextResponse.json({ campaign }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown'
    return NextResponse.json({ error: 'create_failed', detail: msg }, { status: 500 })
  }
}
