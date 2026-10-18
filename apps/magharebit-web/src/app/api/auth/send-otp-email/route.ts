/**
 * POST /api/auth/send-otp-email
 *
 * Email OTP path — alternative to WhatsApp OTP.
 * Uses Resend (https://resend.com) REST API when RESEND_API_KEY is configured.
 * Falls back to console.log in development so the UI flow can be tested without
 * an email provider set up.
 *
 * Body: { email: string, locale?: string }
 *
 * OTP session stored in `otp_sessions` collection with `email` identifier
 * (same TTL index, same rate-limit logic as phone path).
 */

import { NextRequest, NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { getDb } from '@/lib/mongodb'
import { hashOTP } from '@/lib/otp'

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function generateOTP(): string {
  return String(randomInt(100000, 999999))
}

function emailBody(otp: string, locale: string): { subject: string; html: string; text: string } {
  const data: Record<string, { subject: string; html: string; text: string }> = {
    ar: {
      subject: `رمز التحقق من MAGHAREBIT: ${otp}`,
      html: `<div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#0A2318">🔐 رمز التحقق الخاص بك</h2>
        <p>رمز التحقق من <strong>MAGHAREBIT</strong>:</p>
        <div style="background:#F3F4F6;border-radius:8px;padding:20px 24px;text-align:center;font-size:2rem;font-weight:bold;letter-spacing:0.3em;color:#0A2318">${otp}</div>
        <p style="color:#6B7280;font-size:0.875rem">صالح لمدة 5 دقائق. لا تشاركه مع أحد.</p>
      </div>`,
      text: `رمز التحقق من MAGHAREBIT: ${otp}\nصالح 5 دقائق.`,
    },
    fr: {
      subject: `Votre code MAGHAREBIT: ${otp}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#0A2318">🔐 Votre code de vérification</h2>
        <p>Code de vérification <strong>MAGHAREBIT</strong>:</p>
        <div style="background:#F3F4F6;border-radius:8px;padding:20px 24px;text-align:center;font-size:2rem;font-weight:bold;letter-spacing:0.3em;color:#0A2318">${otp}</div>
        <p style="color:#6B7280;font-size:0.875rem">Valable 5 minutes. Ne le partagez pas.</p>
      </div>`,
      text: `Code MAGHAREBIT: ${otp}\nValable 5 minutes.`,
    },
    en: {
      subject: `Your MAGHAREBIT code: ${otp}`,
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#0A2318">🔐 Your verification code</h2>
        <p><strong>MAGHAREBIT</strong> verification code:</p>
        <div style="background:#F3F4F6;border-radius:8px;padding:20px 24px;text-align:center;font-size:2rem;font-weight:bold;letter-spacing:0.3em;color:#0A2318">${otp}</div>
        <p style="color:#6B7280;font-size:0.875rem">Valid for 5 minutes. Do not share it.</p>
      </div>`,
      text: `MAGHAREBIT code: ${otp}\nValid for 5 minutes.`,
    },
  }
  return data[locale] ?? data.fr
}

async function sendViaResend(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { success: false, error: 'RESEND_API_KEY not configured' }

  const from = process.env.EMAIL_FROM ?? 'MAGHAREBIT <noreply@magharebit.ma>'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  })

  if (!res.ok) {
    const body = await res.text()
    return { success: false, error: `Resend ${res.status}: ${body}` }
  }
  return { success: true }
}

export async function POST(req: NextRequest) {
  let body: { email?: string; locale?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const email  = (body.email  ?? '').trim().toLowerCase()
  const locale = (body.locale ?? 'fr').slice(0, 5)

  if (!email) {
    return NextResponse.json({ error: 'email_required' }, { status: 400 })
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'email_invalid' }, { status: 400 })
  }

  const db = await getDb()
  if (!db) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 })
  }

  const col = db.collection('otp_sessions')

  // Rate-limit: max 3 OTP requests per email per 10 minutes
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
  const recentCount = await col.countDocuments({
    email,
    created_at: { $gte: tenMinutesAgo },
  })
  if (recentCount >= 3) {
    return NextResponse.json({ error: 'rate_limited', retryAfter: 600 }, { status: 429 })
  }

  // Ensure indexes
  try {
    await col.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0, background: true })
    await col.createIndex({ email: 1, created_at: -1 }, { background: true })
  } catch { /* already exists */ }

  // Generate + store OTP
  const otp      = generateOTP()
  const otpHash  = hashOTP(otp, email)
  const now      = new Date()
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000)

  await col.insertOne({
    email,
    otp_hash:   otpHash,
    created_at: now,
    expires_at: expiresAt,
    attempts:   0,
    verified:   false,
    locale,
    method:     'email',
  })

  // Send OTP
  const { subject, html, text } = emailBody(otp, locale)

  if (process.env.RESEND_API_KEY) {
    const result = await sendViaResend(email, subject, html, text)
    if (!result.success) {
      console.warn('[send-otp-email] Resend failed:', result.error)
      // Still return success — OTP is in DB; admin can see it in logs if needed
    }
  } else {
    // Dev fallback — log OTP so the UI can be tested without an email provider
    if (process.env.NODE_ENV !== 'production') {
      console.log(`\n[send-otp-email] ── DEV MODE ──────────────────────────`)
      console.log(`  To:  ${email}`)
      console.log(`  OTP: ${otp}`)
      console.log(`  (Add RESEND_API_KEY to .env.local to send real emails)`)
      console.log(`─────────────────────────────────────────────────────\n`)
    }
  }

  return NextResponse.json({
    success: true,
    method:  'email',
    expiresIn: 300,
  })
}
