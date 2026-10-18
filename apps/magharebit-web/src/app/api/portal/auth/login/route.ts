/**
 * POST /api/portal/auth/login
 *
 * Merchant portal login.
 * Credentials: { identifier: string (phone or email), licenseKey: string }
 *
 * Validates:
 *   1. License key checksum (fast, no DB)
 *   2. License exists in DB and is active
 *   3. Merchant exists (phone or email match)
 *   4. Merchant status is 'approved'
 *
 * On success: sets portal_session cookie and returns merchant info.
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyKeyChecksum } from '@/lib/license-key'
import { licensesRepo } from '@/lib/repositories/licenses'
import { setPortalSessionCookie } from '@/lib/portal-session'
import { getDb } from '@/lib/mongodb'

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { identifier?: string; licenseKey?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const identifier  = (body.identifier  ?? '').trim().toLowerCase()
  const rawKey      = (body.licenseKey  ?? '').trim().toUpperCase().replace(/\s/g, '')

  if (!identifier) {
    return NextResponse.json({ error: 'identifier_required' }, { status: 400 })
  }
  if (!rawKey) {
    return NextResponse.json({ error: 'license_key_required' }, { status: 400 })
  }

  // 1. Fast checksum check — no DB hit
  if (!verifyKeyChecksum(rawKey)) {
    return NextResponse.json({ error: 'invalid_license_key' }, { status: 401 })
  }

  // 2. License DB lookup
  const license = await licensesRepo.findByKey(rawKey)
  if (!license) {
    return NextResponse.json({ error: 'invalid_license_key' }, { status: 401 })
  }
  if (license.status === 'revoked') {
    return NextResponse.json({ error: 'license_revoked' }, { status: 403 })
  }
  if (license.status === 'expired') {
    return NextResponse.json({ error: 'license_expired' }, { status: 403 })
  }

  // 3. Merchant lookup — try phone first, then email
  const db = await getDb()
  if (!db) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  }

  // Normalise phone (strip non-digits, then normalise to 212XXXXXXXXX format)
  const phoneDigits = identifier.replace(/\D/g, '')
  const normPhone  = phoneDigits.length >= 9
    ? (phoneDigits.startsWith('212') && phoneDigits.length === 12
        ? phoneDigits
        : phoneDigits.startsWith('0') && phoneDigits.length === 10
          ? '212' + phoneDigits.slice(1)
          : phoneDigits)
    : ''

  const merchantsCol = db.collection('merchants')
  const doc = await merchantsCol.findOne({
    $or: [
      ...(normPhone ? [{ phone: normPhone }] : []),
      { email: identifier },
    ],
  })

  if (!doc) {
    return NextResponse.json({ error: 'account_not_found' }, { status: 401 })
  }
  if (doc.status !== 'approved') {
    return NextResponse.json({
      error: doc.status === 'pending' ? 'account_pending' : 'account_suspended',
    }, { status: 403 })
  }

  // 4. Verify the license belongs to this merchant
  const merchantId = doc._id.toString()
  // License merchantId is stored as phone or email depending on signup path
  const licenseOwnerMatch =
    (doc.phone && license.merchantId === doc.phone) ||
    (doc.email && license.merchantId === doc.email)

  if (!licenseOwnerMatch) {
    return NextResponse.json({ error: 'license_not_for_this_account' }, { status: 403 })
  }

  // 5. Set session cookie
  const res = NextResponse.json({
    ok:         true,
    merchantId,
    storeName:  doc.storeName,
    plan:       doc.plan ?? license.plan,
    expiresAt:  license.expiresAt,
  })

  setPortalSessionCookie(res, {
    merchantId,
    identifier: doc.email ?? doc.phone ?? identifier,
  })

  return res
}
