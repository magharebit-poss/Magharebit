import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { getDb, getLastConnectionError } from '@/lib/mongodb'
import { deliverOtp, toOtpLocale } from '@/lib/otp-delivery'
import { normalisePhone, hashOTP } from '@/lib/otp'
import { checkRateLimit } from '@/lib/rateLimit'
import { clientIp } from '@/lib/repositories/audit-logs'

function generateOTP(): string {
  return String(randomInt(100000, 999999))
}

export async function POST(req: NextRequest) {
  // Per-IP cap on top of the per-phone cap below: stops one client from burning SMS/WhatsApp credit on many numbers.
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
  if (phone.length < 10) {
    return NextResponse.json({ error: 'phone_invalid' }, { status: 400 })
  }

  const db = await getDb()
  if (!db) {
    // In development expose the actual MongoDB error so devs can diagnose
    // immediately (Atlas paused, wrong password, DNS failure, etc.).
    const detail = process.env.NODE_ENV === 'development'
      ? (getLastConnectionError() ?? 'connection not attempted yet')
      : undefined
    return NextResponse.json({ error: 'service_unavailable', ...(detail ? { detail } : {}) }, { status: 503 })
  }

  const col = db.collection('otp_sessions')

  // Rate-limit: max 3 OTP requests per phone per 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
  const recentCount = await col.countDocuments({
    phone,
    created_at: { $gte: tenMinutesAgo },
  })
  if (recentCount >= 3) {
    return NextResponse.json({ error: 'rate_limited', retryAfter: 600 }, { status: 429 })
  }

  // Ensure TTL index exists (idempotent)
  try {
    await col.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0, background: true })
    await col.createIndex({ phone: 1, created_at: -1 }, { background: true })
  } catch {
    // Index already exists — ignore
  }

  // Generate + store OTP
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
    method: 'whatsapp',
  })

  // Send via the configured WhatsApp provider (OTP_WHATSAPP_PROVIDER: green-api by default, or infobip)
  const waResult = await deliverOtp({ channel: 'whatsapp', phone, code: otp, locale: toOtpLocale(locale) })

  if (!waResult.success) {
    console.warn(`[send-otp] ${waResult.provider} send failed:`, waResult.error)
    return NextResponse.json({
      success: true,
      method: 'whatsapp',
      expiresIn: 300,
      warn: 'whatsapp_send_failed',
    })
  }

  return NextResponse.json({
    success: true,
    method: 'whatsapp',
    expiresIn: 300,
    messageId: waResult.messageId,
  })
}
