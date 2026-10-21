/**
 * POST /api/admin/merchants/[id]/revoke
 *
 * Suspends a merchant and revokes all their active licenses.
 * The desktop software will lock on next /api/licenses/validate call.
 *
 * Request body (optional):
 *   { reason?: string, notify?: boolean }
 *   notify defaults to true — sends a WhatsApp suspension notice
 *
 * Response:
 *   200 {
 *     merchant:       MerchantDoc  (status: "suspended")
 *     revokedCount:   number       (how many licenses were revoked)
 *     whatsapp:       { sent: boolean, messageId?: string, error?: string } | null
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { merchantsRepo } from '@/lib/repositories/merchants'
import { licensesRepo } from '@/lib/repositories/licenses'
import { authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'
import { sendWhatsAppMessage, whatsappTemplates } from '@/lib/whatsapp'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!canWrite(actor)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const { id } = await params

  // ── Parse optional body ─────────────────────────────────────────────────────
  let body: { reason?: string; notify?: boolean } = {}
  try {
    body = await req.json()
  } catch {
    // body is optional — ignore parse errors
  }

  const reason = (body.reason ?? '').trim() || 'admin_revoke'
  const notify = body.notify !== false   // default: true

  // ── Fetch merchant ──────────────────────────────────────────────────────────
  const merchant = await merchantsRepo.findById(id)
  if (!merchant) {
    return NextResponse.json({ error: 'merchant_not_found' }, { status: 404 })
  }
  if (merchant.status === 'suspended') {
    return NextResponse.json({ error: 'already_suspended' }, { status: 409 })
  }

  // ── Revoke all active licenses for this merchant ────────────────────────────
  const { licenses: activeLicenses } = await licensesRepo.findAll({
    merchantId: merchant.phone,
    status:     'active',
  })

  const ip = clientIp(req)
  let revokedCount = 0
  let auditOk = true
  for (const lic of activeLicenses) {
    await licensesRepo.revoke(lic.id, reason)
    revokedCount++
    auditOk = (await recordAudit({
      actor, action: 'revokeKey', targetType: 'license', targetId: lic.id,
      meta: { reason, merchantId: merchant.phone }, ip,
    })) && auditOk
  }

  // ── Suspend merchant record ─────────────────────────────────────────────────
  const suspended = await merchantsRepo.suspend(id, reason)
  auditOk = (await recordAudit({
    actor, action: 'suspendMerchant', targetType: 'merchant', targetId: merchant.phone,
    meta: { reason, revokedCount }, ip,
  })) && auditOk

  // ── Optional WhatsApp notification ─────────────────────────────────────────
  let waResult: { sent: boolean; messageId?: string; error?: string } | null = null

  if (notify && merchant.phone) {
    const locale  = merchant.locale ?? 'fr'
    const message = whatsappTemplates.licenseRevoked(merchant.storeName, locale)
    const result  = await sendWhatsAppMessage({ to: merchant.phone, message })
    waResult = { sent: result.success, messageId: result.messageId, error: result.error }
  }

  return NextResponse.json({
    merchant:     suspended,
    revokedCount,
    whatsapp:     waResult,
    auditRecorded: auditOk,
  })
}
