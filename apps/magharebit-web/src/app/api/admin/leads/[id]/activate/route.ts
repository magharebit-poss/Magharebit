/**
 * POST /api/admin/leads/[id]/activate   { plan, durationMonths, notify? }
 *
 * The only way a lead gets a license key. Everything happens on the server:
 *   1. the admin session is verified and must be allowed to write (not a viewer);
 *   2. a real license is created through licensesRepo (valid MGH key, plan, expiry);
 *   3. the merchant record is created or updated to match;
 *   4. the lead is marked activated ATOMICALLY with that key (a second admin gets 409);
 *   5. the action is written to the audit log with the acting admin;
 *   6. the key is sent to the merchant on WhatsApp (best effort, reported in the response).
 *
 * The browser never chooses or supplies a key.
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateAdmin, canWrite } from '@/lib/admin-auth'
import { leadsRepo } from '@/lib/repositories/leads'
import { licensesRepo } from '@/lib/repositories/licenses'
import { merchantsRepo } from '@/lib/repositories/merchants'
import { clientIp, recordAudit } from '@/lib/repositories/audit-logs'
import { isValidDuration, durationLabelAr, type LicensePlan } from '@/lib/license-key'
import { normalisePhone } from '@/lib/otp'
import { sendWhatsAppMessage, whatsappTemplates } from '@/lib/whatsapp'

const PLANS: LicensePlan[] = ['Starter', 'Business', 'Enterprise']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const actor = await authenticateAdmin(req)
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canWrite(actor)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const { id } = await params

  let body: { plan?: unknown; durationMonths?: unknown; notify?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  const plan = body.plan as LicensePlan
  const durationMonths = Number(body.durationMonths)
  if (!PLANS.includes(plan)) {
    return NextResponse.json({ error: `plan must be one of: ${PLANS.join(', ')}` }, { status: 422 })
  }
  if (!isValidDuration(durationMonths)) {
    return NextResponse.json({ error: 'durationMonths must be 1, 3, 6, 12, or 24' }, { status: 422 })
  }
  const notify = body.notify !== false

  const lead = await leadsRepo.findById(id)
  if (!lead) return NextResponse.json({ error: 'lead_not_found' }, { status: 404 })
  if (lead.status === 'activated') {
    return NextResponse.json({ error: 'already_activated', licenseKey: lead.licenseKey ?? null }, { status: 409 })
  }
  if (lead.status === 'rejected') {
    return NextResponse.json({ error: 'lead_rejected: change its status first' }, { status: 409 })
  }

  const phone = normalisePhone(lead.phone)
  if (phone.length < 11) return NextResponse.json({ error: 'lead_phone_invalid' }, { status: 422 })

  let merchant = await merchantsRepo.findByPhone(phone)
  if (merchant?.status === 'suspended') {
    return NextResponse.json({ error: 'merchant_suspended' }, { status: 409 })
  }

  // 1. the real license (valid key, plan, expiry). Throws when the database is down.
  let license
  try {
    license = await licensesRepo.create({
      merchantId: phone,
      storeName: lead.storeName,
      plan,
      durationMonths: durationMonths as 1 | 3 | 6 | 12 | 24,
    })
  } catch (err) {
    console.error('[activate-lead] license creation failed:', err)
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  }

  // 2. atomically claim the lead; if another admin got there first, undo our license
  const claimed = await leadsRepo.activate(id, { key: license.key, licenseId: license.id }, actor.name)
  if (!claimed) {
    await licensesRepo.revoke(license.id, 'concurrent_lead_activation_rollback')
    return NextResponse.json({ error: 'already_activated' }, { status: 409 })
  }

  // 3. merchant record follows the license
  let merchantCreated = false
  if (!merchant) {
    merchant = await merchantsRepo.createApproved({
      phone, storeName: lead.storeName, sector: lead.businessType, city: lead.city, locale: lead.locale,
      plan, subscriptionEndsAt: license.expiresAt, approvedBy: actor.name,
    })
    merchantCreated = true
  } else if (merchant.status === 'pending') {
    merchant = (await merchantsRepo.approve(merchant.id, { plan, subscriptionEndsAt: license.expiresAt, approvedBy: actor.name })) ?? merchant
  } else {
    merchant = (await merchantsRepo.setSubscription(merchant.id, plan, license.expiresAt)) ?? merchant
  }

  // 4. audit
  const ip = clientIp(req)
  const meta = {
    plan, durationMonths, licenseId: license.id, leadId: id, merchantId: phone,
    expiresAt: license.expiresAt.toISOString(), merchantCreated,
  }
  const auditRecorded = await recordAudit({
    actor, action: 'activateLead', targetType: 'merchant', targetId: phone, meta, ip,
  }) && await recordAudit({
    actor, action: 'generateLicense', targetType: 'license', targetId: license.id, meta, ip,
  })

  // 5. deliver on WhatsApp (best effort)
  let whatsapp: { sent: boolean; error?: string } = { sent: false }
  if (notify) {
    const result = await sendWhatsAppMessage({
      to: phone,
      message: whatsappTemplates.licenseDelivery(
        lead.storeName, license.key, `${plan} — ${durationLabelAr(durationMonths)}`, license.expiresAt, lead.locale || 'fr'
      ),
    })
    whatsapp = { sent: result.success, ...(result.error ? { error: result.error } : {}) }
  }

  return NextResponse.json(
    {
      lead: { ...lead, status: 'activated', licenseKey: license.key, licenseId: license.id },
      license: { id: license.id, key: license.key, plan, durationMonths, expiresAt: license.expiresAt },
      merchantId: merchant?.id ?? null,
      auditRecorded,
      whatsapp,
    },
    { status: 201 }
  )
}
