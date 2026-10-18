import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { getDb } from '@/lib/mongodb'
import { normalisePhone, hashOTP } from '@/lib/otp'

function generateOTP(): string {
  return String(randomInt(100000, 999999))
}

function toE164(phone: string): string {
  return '+' + normalisePhone(phone)
}

function smsMessage(otp: string, locale: string): string {
  const msgs: Record<string, string> = {
    ar: `MAGHAREBIT: رمز التحقق ${otp} — صالح 5 دقائق`,
    fr: `MAGHAREBIT: Votre code est ${otp} — Valable 5 min`,
    en: `MAGHAREBIT: Your code is ${otp} — Valid 5 min`,
  }
  return msgs[locale] ?? msgs.fr
}

export async function POST(req: NextRequest) {
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

  // Validate Twilio credentials
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_FROM_NUMBER

  if (
    !accountSid || !authToken || !fromNumber ||
    accountSid === 'REPLACE_AFTER_ROTATION'
  ) {
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

  // Send via Twilio
  try {
    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization:
            'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: toE164(phone),
          From: fromNumber,
          Body: smsMessage(otp, locale),
        }),
      }
    )

    if (!twilioRes.ok) {
      const errBody = await twilioRes.text()
      console.error('[send-otp-sms] Twilio error:', errBody)
      return NextResponse.json({ error: 'sms_send_failed' }, { status: 502 })
    }

    return NextResponse.json({ success: true, method: 'sms', expiresIn: 300 })
  } catch (err) {
    console.error('[send-otp-sms] Network error:', err)
    return NextResponse.json({ error: 'sms_send_failed' }, { status: 502 })
  }
}
