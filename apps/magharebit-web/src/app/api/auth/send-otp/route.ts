import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { getDb, getLastConnectionError } from '@/lib/mongodb'
import { sendWhatsAppMessage } from '@/lib/whatsapp'
import { normalisePhone, hashOTP } from '@/lib/otp'

function generateOTP(): string {
  return String(randomInt(100000, 999999))
}

function otpMessage(otp: string, locale: string): string {
  const msgs: Record<string, string> = {
    ar:
      `🔐 رمز التحقق من MAGHAREBIT:\n\n*${otp}*\n\n` +
      `صالح لمدة 5 دقائق. لا تشاركه مع أحد.`,
    fr:
      `🔐 Votre code de vérification MAGHAREBIT:\n\n*${otp}*\n\n` +
      `Valable 5 minutes. Ne le partagez pas.`,
    en:
      `🔐 Your MAGHAREBIT verification code:\n\n*${otp}*\n\n` +
      `Valid for 5 minutes. Do not share it.`,
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

  // Send via WhatsApp
  const waResult = await sendWhatsAppMessage({
    to: phone,
    message: otpMessage(otp, locale),
  })

  if (!waResult.success) {
    console.warn('[send-otp] WhatsApp send failed:', waResult.error)
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
