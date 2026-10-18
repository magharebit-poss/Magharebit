/**
 * POST /api/portal/whatsapp/campaigns/[id]/send
 *
 * Fan-out: sends the campaign's messageTemplate to all matching customers.
 *
 * Flow:
 *   1. Verify session + campaign ownership
 *   2. Confirm merchant has WhatsApp enabled
 *   3. Atomically transition campaign from 'draft' → 'sending' (prevents double-send)
 *   4. Resolve target customers via findForCampaign()
 *   5. Send one message per customer with 300ms delay between sends
 *   6. Finalize: write successCount / failCount, set status → 'completed'
 *   7. Return 200 with { successCount, failCount, recipientCount }
 *
 * This endpoint is synchronous — it waits for all sends before returning.
 * For large lists this could take a while, but it gives the portal accurate
 * counts immediately without needing a separate polling route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { campaignsRepo, renderTemplate } from '@/lib/repositories/whatsapp-campaigns'
import { customersRepo } from '@/lib/repositories/customers'
import { settingsRepo } from '@/lib/repositories/settings'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

/** Delay between sends to respect Green API rate limits. */
const SEND_DELAY_MS = 300

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(
  req:     NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const { id } = await context.params

  // ── 1. Fetch merchant settings — WhatsApp must be enabled ─────────────────
  const settings = await settingsRepo.get(session.merchantId)
  if (!settings.whatsappEnabled) {
    return NextResponse.json({ error: 'whatsapp_not_enabled' }, { status: 422 })
  }

  // ── 2. Verify campaign exists and belongs to this merchant ────────────────
  const existing = await campaignsRepo.findById(session.merchantId, id)
  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (existing.status !== 'draft') {
    return NextResponse.json(
      { error: 'campaign_not_sendable', status: existing.status },
      { status: 409 }
    )
  }

  // ── 3. Resolve target audience ────────────────────────────────────────────
  const recipients = await customersRepo.findForCampaign(
    session.merchantId,
    existing.targetAudience
  )

  // ── 4. Atomically mark as 'sending' — prevents double-send ───────────────
  const sending = await campaignsRepo.atomicStartSend(
    session.merchantId,
    id,
    recipients.length
  )
  if (!sending) {
    // Race condition: another request already started sending
    return NextResponse.json(
      { error: 'campaign_already_sending_or_completed' },
      { status: 409 }
    )
  }

  // ── 5. Fan-out ─────────────────────────────────────────────────────────────
  let successCount = 0
  let failCount    = 0

  for (let i = 0; i < recipients.length; i++) {
    const customer = recipients[i]

    // 300ms rate-limit delay between messages (skip before first send)
    if (i > 0) await sleep(SEND_DELAY_MS)

    const message = renderTemplate(existing.messageTemplate, customer.name)
    const result  = await sendWhatsAppMessage({ to: customer.phone, message })

    if (result.success) {
      successCount++
    } else {
      failCount++
      console.warn(
        `[campaign/${id}] failed to send to customer ${customer.id}: ${result.error ?? 'unknown'}`
      )
    }
  }

  // ── 6. Finalize ───────────────────────────────────────────────────────────
  await campaignsRepo.completeSend(id, successCount, failCount)

  return NextResponse.json({
    recipientCount: recipients.length,
    successCount,
    failCount,
  })
}
