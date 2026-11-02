/**
 * Guards for the unauthenticated endpoints (leads, newsletter, demo request, OTP senders).
 *
 * 1. cleanLabel(): free text typed by an anonymous visitor ends up inside a WhatsApp message sent FROM THE COMPANY'S
 *    NUMBER to a third party (the lead confirmation echoes the store name) and in the admin team's inbox. Without a
 *    filter, "Gagnez 500 DH sur https://… " in the store-name field becomes a phishing message from an official
 *    channel. Links, handles, markup and control characters are refused; line breaks are collapsed.
 * 2. outboundBudget(): a ceiling on what anonymous traffic can make us send per hour, whatever the IP. Provider
 *    credit and the sender number's reputation are shared resources; IP limits can be rotated, a global one cannot.
 */

import { checkRateLimit } from './rateLimit'

// links ("http:", "www."), bare domains, @handles / e-mails, markup, WhatsApp/Telegram deep links, control characters
const FORBIDDEN = /https?:|ftp:|www\.|\b[\w-]+\.(com|net|org|ma|io|me|co|info|xyz|ly|app|link|click|top)\b|[@<>`\\{}[\]|]|wa\.me|t\.me|[\u0000-\u001f\u007f‎‏‪-‮⁦-⁩]/i

/** Trimmed, whitespace-collapsed text of 1..max chars with no links or markup, or null if it must be refused. */
export function cleanLabel(value: unknown, min: number, max: number): string | null {
  if (typeof value !== 'string') return null
  const s = value.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim()
  if (s.length < min || s.length > max) return null
  if (FORBIDDEN.test(s)) return null
  return s
}

export type OutboundKind = 'whatsapp-public' | 'otp-public'
const BUDGETS: Record<OutboundKind, { max: number; windowMs: number }> = {
  // lead confirmations + admin alerts + newsletter welcomes triggered by anonymous visitors
  'whatsapp-public': { max: Number(process.env.PUBLIC_WA_PER_HOUR) || 400, windowMs: 60 * 60 * 1000 },
  // OTP codes (WhatsApp / SMS / e-mail) requested by anonymous visitors: generous for real sign-up peaks
  'otp-public': { max: Number(process.env.PUBLIC_OTP_PER_HOUR) || 1500, windowMs: 60 * 60 * 1000 },
}

/** True while the global hourly budget for this kind of outbound message has room (and uses one unit of it). */
export async function outboundBudget(kind: OutboundKind): Promise<boolean> {
  const { max, windowMs } = BUDGETS[kind]
  const ok = await checkRateLimit(`global:${kind}`, max, windowMs)
  if (!ok) console.error(`[public-guard] global budget "${kind}" exhausted (${max}/h): outbound messages are being skipped`)
  return ok
}
