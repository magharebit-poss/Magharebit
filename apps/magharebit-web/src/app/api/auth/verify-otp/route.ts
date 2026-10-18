/**
 * POST /api/auth/verify-otp
 *
 * Verifies a 6-digit OTP for both phone (WhatsApp) and email paths.
 *
 * Body:
 *   { phone?: string, email?: string, otp: string, locale?: string }
 *   Exactly one of phone / email must be provided.
 *
 * On success: sets HttpOnly `mgh_session` cookie containing a signed token
 * with either { phone, ... } or { email, ... } in the payload.
 * complete-signup reads whichever field is present.
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { getDb } from '@/lib/mongodb'
import { normalisePhone, hashOTP, createSessionToken } from '@/lib/otp'

export async function POST(req: NextRequest) {
  let body: { phone?: string; email?: string; otp?: string; locale?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const rawPhone = (body.phone ?? '').trim()
  const rawEmail = (body.email ?? '').trim().toLowerCase()
  const otpInput = (body.otp   ?? '').replace(/\D/g, '').slice(0, 6)
  const locale   = (body.locale ?? 'fr').slice(0, 5)

  if (!otpInput || otpInput.length !== 6) {
    return NextResponse.json({ error: 'otp_must_be_6_digits' }, { status: 400 })
  }

  // Exactly one identifier must be provided
  const usingPhone = !!rawPhone
  const usingEmail = !!rawEmail && !rawPhone
  if (!usingPhone && !usingEmail) {
    return NextResponse.json({ error: 'phone_or_email_required' }, { status: 400 })
  }

  // Normalise identifier
  const phone = usingPhone ? normalisePhone(rawPhone) : undefined
  const email = usingEmail ? rawEmail : undefined
  const identifier = (phone ?? email)!
  const idField    = phone ? 'phone' : 'email'

  const db = await getDb()
  if (!db) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  }

  const col = db.collection('otp_sessions')

  // Find the most recent unverified, non-expired session for this identifier
  const session = await col.findOne(
    { [idField]: identifier, verified: false, expires_at: { $gt: new Date() } },
    { sort: { created_at: -1 } }
  )

  if (!session) {
    return NextResponse.json({ error: 'session_expired_or_not_found' }, { status: 400 })
  }

  // Increment attempt counter atomically
  const updated = await col.findOneAndUpdate(
    { _id: session._id },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  )

  if (!updated || updated.attempts > 5) {
    await col.updateOne(
      { _id: session._id },
      { $set: { expires_at: new Date(0) } }
    )
    return NextResponse.json({ error: 'too_many_attempts' }, { status: 429 })
  }

  // Compare hash (identifier is phone for WA path, email for email path)
  const expectedHash = hashOTP(otpInput, identifier)
  if (updated.otp_hash !== expectedHash) {
    const remaining = Math.max(0, 5 - updated.attempts)
    return NextResponse.json({ error: 'invalid_otp', attemptsRemaining: remaining }, { status: 400 })
  }

  // ✅ OTP valid — mark session verified
  await col.updateOne({ _id: session._id }, { $set: { verified: true } })

  // Create auth session in MongoDB
  const sessionId = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  const sessionDoc: Record<string, unknown> = {
    session_id:       sessionId,
    locale,
    created_at:       new Date(),
    expires_at:       expiresAt,
    completed_signup: false,
  }
  if (phone) sessionDoc.phone = phone
  if (email) sessionDoc.email = email

  await db.collection('auth_sessions').insertOne(sessionDoc)

  // Signed token payload — carries whichever identifier was used
  const tokenPayload: Record<string, unknown> = {
    sessionId,
    locale,
    exp: expiresAt.getTime(),
  }
  if (phone) tokenPayload.phone = phone
  if (email) tokenPayload.email = email

  const token = createSessionToken(tokenPayload)

  const response = NextResponse.json({
    success: true,
    ...(phone ? { phone } : { email }),
    locale,
  })
  response.cookies.set('mgh_session', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60,
    path:     '/',
  })

  return response
}
