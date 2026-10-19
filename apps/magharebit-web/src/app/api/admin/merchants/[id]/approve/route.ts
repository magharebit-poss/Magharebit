/**
 * POST /api/admin/merchants/[id]/approve
 *
 * Admin approves a pending merchant, selects their plan + duration,
 * the system generates a license key and sends it via WhatsApp.
 *
 * Request body:
 *   { plan: "Starter"|"Business"|"Enterprise", durationMonths: 1|3|6|12|24 }
 *
 * Business rules enforced:
 *   - Merchant must exist and be in status "pending"
 *   - License is generated ONLY on admin approval — never before
 *   - Software stays locked until customer enters the key on the activation screen
 *   - WhatsApp delivery is attempted; success/failure is reported but does NOT
 *     block the approval (admin can resend manually if WA fails)
 *
 * Response:
 *   201 {
 *     merchant:    MerchantDoc  (status: "approved")
 *     license:     LicenseRecord
 *     whatsapp:    { sent: boolean, messageId?: string, error?: string }
 *   }
 */

import { NextRequest, NextResponse } from 'next/server'
import { merchantsRepo } from '@/lib/repositories/merchants'
import { licensesRepo } from '@/lib/repositories/licenses'
import { isAdminRequest } from '@/lib/admin-auth'
import { isValidDuration, durationLabelAr } from '@/lib/license-key'
import { sendWhatsAppMessage, whatsappTemplates } from '@/lib/whatsapp'
import type { LicensePlan } from '@/lib/license-key'

const VALID_PLANS: LicensePlan[] = ['Starter', 'Business', 'Enterprise']

function isAdminAuthed(req: NextRequest): boolean {
  return isAdminRequest(req)
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!isAdminAuthed(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params

  // ── Parse body ──────────────────────────────────────────────────────────────
  let body: { plan?: string; durationMonths?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const plan          = (body.plan ?? 'Starter') as LicensePlan
  const durationMonths = Number(body.durationMonths ?? 12)

  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json(
      { error: `plan must be one of: ${VALID_PLANS.join(', ')}` },
      { status: 422 }
    )
  }
  if (!isValidDuration(durationMonths)) {
    return NextResponse.json(
      { error: 'durationMonths must be 1, 3, 6, 12, or 24' },
      { status: 422 }
    )
  }

  // ── Fetch merchant ──────────────────────────────────────────────────────────
  const merchant = await merchantsRepo.findById(id)
  if (!merchant) {
    return NextResponse.json({ error: 'merchant_not_found' }, { status: 404 })
  }
  if (merchant.status === 'approved') {
    // Idempotency: return existing license if already approved
    const { licenses } = await licensesRepo.findAll({ merchantId: merchant.phone, status: 'active' })
    return NextResponse.json(
      { error: 'already_approved', existingLicense: licenses[0] ?? null },
      { status: 409 }
    )
  }
  if (merchant.status === 'suspended') {
    return NextResponse.json(
      { error: 'merchant_suspended — use /revoke endpoint to manage suspended merchants' },
      { status: 409 }
    )
  }

  // ── Generate license ────────────────────────────────────────────────────────
  // Key is only generated here — never before admin approval.
  // The desktop software stays locked until the customer enters this key.
  const license = await licensesRepo.create({
    merchantId:     merchant.phone,   // normalised phone is the foreign key
    storeName:      merchant.storeName,
    plan,
    durationMonths,
  })

  // ── Update merchant record (atomic: only succeeds if still 'pending') ────────
  const updatedMerchant = await merchantsRepo.approve(id, {
    plan,
    subscriptionEndsAt: license.expiresAt,
    approvedBy:         'admin',
  })

  if (!updatedMerchant) {
    // The findOneAndUpdate filtered on status:'pending' and matched nothing —
    // a concurrent request already approved this merchant. Revoke the license
    // we just created to avoid orphaned records, then return 409.
    await licensesRepo.revoke(license.id, 'concurrent_approve_rollback')
    return NextResponse.json(
      { error: 'already_approved — concurrent request won the race' },
      { status: 409 }
    )
  }

  // ── Send license key via WhatsApp ───────────────────────────────────────────
  // Use merchant's preferred locale for the message language.
  const locale   = merchant.locale ?? 'fr'
  const contactPhone = merchant.phone  // already normalised (212XXXXXXXXX)

  const message = whatsappTemplates.licenseDelivery(
    merchant.storeName,
    license.key,
    `${plan} — ${durationLabelAr(durationMonths)}`,
    license.expiresAt,
    locale
  )

  const waResult = await sendWhatsAppMessage({ to: contactPhone, message })

  return NextResponse.json(
    {
      merchant:  updatedMerchant,
      license,
      whatsapp: {
        sent:      waResult.success,
        messageId: waResult.messageId,
        error:     waResult.error,
      },
    },
    { status: 201 }
  )
}
