/**
 * POST /api/auth/complete-signup
 *
 * Creates a merchant record after successful OTP verification.
 * Merchant is stored with status: 'pending' — the admin must approve
 * before a license key is generated and the software is unlocked.
 *
 * Supports two registration paths:
 *   phone path — session.phone is set; body.phone must match
 *   email path — session.email is set; body.email must match (Step 5)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { normalisePhone, verifySessionToken } from '@/lib/otp'
import type { Merchant } from '@/lib/license-key'
import { licensesRepo } from '@/lib/repositories/licenses'
import { TRIAL_DAYS } from '@/lib/plans'
import { setPortalSessionCookie } from '@/lib/portal-session'

export async function POST(req: NextRequest) {
  // ── Session verification ────────────────────────────────────────────────────
  const sessionToken = req.cookies.get('mgh_session')?.value
  if (!sessionToken) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  let body: {
    phone?:     string
    email?:     string
    storeName?: string
    sector?:    string
    city?:      string
    locale?:    string
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const rawPhone  = (body.phone     ?? '').trim()
  const rawEmail  = (body.email     ?? '').trim().toLowerCase()
  const storeName = (body.storeName ?? '').trim()
  const sector    = (body.sector    ?? '').trim()
  const city      = (body.city      ?? '').trim()
  const locale    = (body.locale    ?? 'fr').slice(0, 5)

  if (!storeName) {
    return NextResponse.json({ error: 'store_name_required' }, { status: 400 })
  }
  if (!rawPhone && !rawEmail) {
    return NextResponse.json({ error: 'phone_or_email_required' }, { status: 400 })
  }

  const payload = verifySessionToken(sessionToken)
  if (!payload) {
    return NextResponse.json({ error: 'invalid_or_expired_session' }, { status: 401 })
  }

  // ── Identity verification: session must own this phone or email ─────────────
  const tokenPhone = typeof payload.phone === 'string' ? payload.phone : ''
  const tokenEmail = typeof payload.email === 'string' ? payload.email : ''

  if (rawPhone) {
    if (normalisePhone(tokenPhone) !== normalisePhone(rawPhone)) {
      return NextResponse.json({ error: 'session_phone_mismatch' }, { status: 401 })
    }
  } else {
    if (tokenEmail !== rawEmail) {
      return NextResponse.json({ error: 'session_email_mismatch' }, { status: 401 })
    }
  }

  const phone = rawPhone ? normalisePhone(rawPhone) : undefined
  const email = rawEmail || undefined

  // ── DB write ────────────────────────────────────────────────────────────────
  const db = await getDb()
  if (!db) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  }

  const merchantsCol = db.collection<Merchant & { createdAt: Date }>('merchants')

  // Idempotency: return success if already registered
  const lookupFilter = phone ? { phone } : { email }
  const existing = await merchantsCol.findOne(lookupFilter)
  if (existing) {
    // The OTP session above already proved this person owns the phone/email, so an approved
    // account gets its portal session and its active key back (same as a fresh sign-up).
    const body: Record<string, unknown> = { success: true, exists: true }
    if (existing.status === 'approved') {
      const { licenses } = await licensesRepo.findAll({ merchantId: phone ?? email ?? '', status: 'active' })
      if (licenses[0]) { body.licenseKey = licenses[0].key; body.expiresAt = licenses[0].expiresAt }
      const res = NextResponse.json(body)
      setPortalSessionCookie(res, { merchantId: existing._id.toString(), identifier: phone ?? email ?? '' })
      return res
    }
    return NextResponse.json(body)
  }

  // ── Trial issuance (fire before DB write so we know the expiry date) ─────────
  // merchantId for license lookup = normalised phone, or email for email-only signups.
  const licenseOwner = phone ?? email ?? ''
  const trialExpiresAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)

  const merchantDoc: Merchant & { createdAt: Date } = {
    phone:     phone ?? '',
    email,
    storeName,
    sector,
    city,
    locale,
    createdAt: new Date(),
    // Trial merchants are immediately active — no manual admin approval queue.
    status: 'approved',
    plan:   'Starter',
    subscriptionEndsAt: trialExpiresAt,
    approvedAt: new Date(),
    approvedBy: 'system:trial',
  }

  const inserted = await merchantsCol.insertOne(merchantDoc)

  // Ensure indexes exist for fast lookup
  await merchantsCol.createIndex({ phone: 1 },  { sparse: true })
  await merchantsCol.createIndex({ email: 1 },  { sparse: true })
  await merchantsCol.createIndex({ status: 1 })

  // Auto-generate the 14-day Starter trial license. Awaited so the confirmation screen can show the key
  // right away (the merchant needs it to activate the app and to sign in to the portal). If creation
  // fails the account still exists and an admin can issue a key manually.
  let trialLicense: Awaited<ReturnType<typeof licensesRepo.createTrial>> | null = null
  try {
    trialLicense = await licensesRepo.createTrial({ merchantId: licenseOwner, storeName, trialDays: TRIAL_DAYS })
  } catch (err) {
    console.error('[complete-signup] trial license creation failed:', err)
  }

  // Mark auth session as signup-completed
  await db.collection('auth_sessions').updateOne(
    { ...(phone ? { phone } : { email }), completed_signup: false },
    { $set: { completed_signup: true } }
  )

  const res = NextResponse.json({
    success: true,
    status: 'trial',
    trialDays: TRIAL_DAYS,
    ...(trialLicense ? { licenseKey: trialLicense.key, expiresAt: trialLicense.expiresAt } : {}),
  })
  // Sign the new merchant into the portal: the OTP just proved they own this phone/email, and the
  // license-gated download route needs this session.
  setPortalSessionCookie(res, { merchantId: inserted.insertedId.toString(), identifier: licenseOwner })
  return res
}
