import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { getDb } from '@/lib/mongodb'
import { normalisePhone, hashOTP } from '@/lib/otp'
import { deliverOtp, providerFor, toOtpLocale } from '@/lib/otp-delivery'
import { checkRateLimit } from '@/lib/rateLimit'
import { clientIp } from '@/lib/repositories/audit-logs'

function generateOTP(): string {
  return String(randomInt(100000, 999999))
}

export async function POST(req: NextRequest) {
  if (!(await checkRateLimit(`otp-send:${clientIp(req)}`, 12, 10 * 60 * 1000))) {
    return NextResponse.json({ error: 'rate_limited', retryAfter: 600 }, { status: 429 })
  }
  let body: { phone?: string; locale?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const rawPhone = (body.phone ?? '').trim()
  const locale = (body.locale ?? 'fr').slice(0, 5)

  if (!rawPhone) {
    return NextResponse.json({ error: 'phone_required' }, { status: 400 })
  }

  const phone = normalisePhone(rawPhone)

  const db = await getDb()
  if (!db) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  }

  const col = db.collection('otp_sessions')

  // Ensure a WhatsApp OTP session was already sent (prevents SMS as primary bypass)
  const existingSession = await col.findOne(
    { phone, verified: false, expires_at: { $gt: new Date() } },
    { sort: { created_at: -1 } }
  )

  if (!existingSession) {
    return NextResponse.json(
      { error: 'no_whatsapp_session_found', message: 'Send WhatsApp OTP first' },
      { status: 400 }
    )
  }

  // The SMS provider (OTP_SMS_PROVIDER: twilio by default, or infobip) must be configured before a code is created.
  if (!providerFor('sms').isConfigured()) {
    return NextResponse.json({ error: 'sms_not_configured' }, { status: 503 })
  }

  // Generate new OTP for SMS channel
  const otp = generateOTP()
  const otpHash = hashOTP(otp, phone)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000)

  await col.insertOne({
    phone,
    otp_hash: otpHash,
    created_at: now,
    expires_at: expiresAt,
    attempts: 0,
    verified: false,
    locale,
    method: 'sms',
  })

  const result = await deliverOtp({ channel: 'sms', phone, code: otp, locale: toOtpLocale(locale) })
  if (!result.success) {
    console.error(`[send-otp-sms] ${result.provider} error:`, result.error)
    return NextResponse.json({ error: 'sms_send_failed' }, { status: 502 })
  }
  return NextResponse.json({ success: true, method: 'sms', expiresIn: 300 })
}
