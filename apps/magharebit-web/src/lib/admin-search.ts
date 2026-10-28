/**
 * Global admin search (Ctrl+K / Cmd+K palette): merchants, licenses, leads and coupons in one call.
 *
 * Matching is a case-insensitive "contains" built from an escaped query, made tolerant of how Arabic is typed:
 * the alef forms (ا أ إ آ), ya / alef maqsura (ي ى), ta marbuta / ha (ة ه) match each other, and short vowels
 * (tashkeel) or tatweel in the stored text are skipped. The pattern has no nested quantifiers (no ReDoS).
 */

import { Db } from 'mongodb'
import { escapeRegex } from './regex'

export const SEARCH_MIN = 2
export const SEARCH_MAX = 64
const PER_GROUP = 5

const DIACRITICS = /[ً-ْٰـ]/g
// The characters themselves, not \u escapes: MongoDB's regex engine (PCRE2) rejects \uXXXX.
const SKIP = '[ً-ْٰـ]*'
const VARIANTS: Record<string, string> = {
  'ا': '[اأإآ]', 'أ': '[اأإآ]', 'إ': '[اأإآ]', 'آ': '[اأإآ]',
  'ي': '[يى]', 'ى': '[يى]',
  'ة': '[ةه]', 'ه': '[ةه]',
}
const isArabic = (ch: string) => /[؀-ۿ]/.test(ch)

/** Normalised query, or '' when it is too short. Strips tashkeel and collapses whitespace. */
export function normaliseQuery(raw: string): string {
  const q = raw.replace(DIACRITICS, '').replace(/\s+/g, ' ').trim().slice(0, SEARCH_MAX)
  return q.length >= SEARCH_MIN ? q : ''
}

export function searchPattern(q: string): string {
  const chars = [...q]
  return chars.map((ch, i) => {
    const piece = VARIANTS[ch] ?? escapeRegex(ch)
    return i < chars.length - 1 && isArabic(ch) ? piece + SKIP : piece
  }).join('')
}

export interface SearchHit { id: string; title: string; subtitle: string; q: string }
export interface SearchResults { merchants: SearchHit[]; licenses: SearchHit[]; leads: SearchHit[]; coupons: SearchHit[] }

export async function searchAdmin(db: Db, q: string): Promise<SearchResults> {
  const re = { $regex: searchPattern(q), $options: 'i' }
  const [merchants, licenses, leads, coupons] = await Promise.all([
    db.collection('merchants')
      .find({ $or: [{ storeName: re }, { phone: re }, { email: re }, { city: re }] }, { projection: { storeName: 1, phone: 1, email: 1, city: 1, status: 1 } })
      .sort({ createdAt: -1 }).limit(PER_GROUP).toArray(),
    db.collection('licenses')
      .find({ $or: [{ key: re }, { storeName: re }, { merchantId: re }] }, { projection: { _id: 0, id: 1, key: 1, storeName: 1, status: 1, plan: 1 } })
      .sort({ issuedAt: -1 }).limit(PER_GROUP).toArray(),
    db.collection('leads')
      .find({ $or: [{ storeName: re }, { phone: re }, { city: re }] }, { projection: { _id: 0, id: 1, storeName: 1, phone: 1, city: 1, status: 1 } })
      .sort({ submittedAt: -1 }).limit(PER_GROUP).toArray(),
    db.collection('coupons')
      .find({ $or: [{ code: re }, { description: re }] }, { projection: { _id: 0, id: 1, code: 1, description: 1, active: 1 } })
      .sort({ createdAt: -1 }).limit(PER_GROUP).toArray(),
  ])
  const join = (...parts: unknown[]) => parts.filter((p) => typeof p === 'string' && p).join(' · ')
  return {
    merchants: merchants.map((m) => ({ id: m._id.toHexString(), title: String(m.storeName ?? ''), subtitle: join(m.phone || m.email, m.city, m.status), q: String(m.phone || m.email || m.storeName || '') })),
    licenses: licenses.map((l) => ({ id: String(l.id), title: String(l.key ?? ''), subtitle: join(l.storeName, l.plan, l.status), q: String(l.key ?? '') })),
    leads: leads.map((l) => ({ id: String(l.id), title: String(l.storeName ?? ''), subtitle: join(l.phone, l.city, l.status), q: String(l.phone || l.storeName || '') })),
    coupons: coupons.map((c) => ({ id: String(c.id), title: String(c.code ?? ''), subtitle: join(c.description, c.active === false ? 'inactive' : 'active'), q: String(c.code ?? '') })),
  }
}
