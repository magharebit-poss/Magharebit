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
import { sendWhatsAppMessage, whatsappTemplates } from '@/lib/whatsapp'

function isAdminAuthed(req: NextRequest): boolean {
  return req.headers.get('x-admin-secret') === process.env.ADMIN_SECRET
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  let revokedCount = 0
  for (const lic of activeLicenses) {
    await licensesRepo.revoke(lic.id, reason)
    revokedCount++
  }

  // ── Suspend merchant record ─────────────────────────────────────────────────
  const suspended = await merchantsRepo.suspend(id, reason)

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
  })
}
