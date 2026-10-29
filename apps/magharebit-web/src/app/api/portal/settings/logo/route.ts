/**
 * PUT    /api/portal/settings/logo   body: the image bytes (PNG, JPEG or WebP, at most LOGO_MAX_BYTES)
 * DELETE /api/portal/settings/logo   remove the logo
 *
 * Merchant portal session required. The portal resizes the picture before sending it; the server checks
 * the real type from the bytes (never the declared Content-Type), stores them in `store_logos` and saves
 * the versioned public URL in settings.logoUrl. Both answer { logoUrl }.
 *
 * Errors: 401 no session · 411 no Content-Length · 413 too large · 415 not PNG/JPEG/WebP · 429 rate limit ·
 *         503 database unavailable.
 */

import { createHash } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, unauthorizedResponse } from '@/lib/portal-session'
import { checkRateLimit } from '@/lib/rateLimit'
import { settingsRepo } from '@/lib/repositories/settings'
import { storeLogosRepo } from '@/lib/repositories/store-logos'
import { LOGO_MAX_BYTES, sniffLogoType, storeLogoUrl } from '@/lib/store-logo'

const LIMIT = 20
const WINDOW_MS = 10 * 60_000

/** Reads at most `max` bytes; null when the body is larger. */
async function readCapped(req: NextRequest, max: number): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array(0)
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) { await reader.cancel(); return null }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const c of chunks) { out.set(c, at); at += c.byteLength }
  return out
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()

  const declared = req.headers.get('content-length')
  if (declared === null) return NextResponse.json({ error: 'length_required' }, { status: 411 })
  if (Number(declared) > LOGO_MAX_BYTES) return NextResponse.json({ error: 'too_large', maxBytes: LOGO_MAX_BYTES }, { status: 413 })

  if (!(await checkRateLimit(`portal-logo:${session.merchantId}`, LIMIT, WINDOW_MS))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const bytes = await readCapped(req, LOGO_MAX_BYTES)
  if (!bytes) return NextResponse.json({ error: 'too_large', maxBytes: LOGO_MAX_BYTES }, { status: 413 })
  const contentType = sniffLogoType(bytes)
  if (!contentType) return NextResponse.json({ error: 'unsupported_type', allowed: ['image/png', 'image/jpeg', 'image/webp'] }, { status: 415 })

  const sha256 = createHash('sha256').update(bytes).digest('hex')
  try {
    await storeLogosRepo.put({ merchantId: session.merchantId, contentType, data: bytes, size: bytes.byteLength, sha256 })
    const settings = await settingsRepo.setLogoUrl(session.merchantId, storeLogoUrl(session.merchantId, sha256))
    return NextResponse.json({ logoUrl: settings.logoUrl })
  } catch (err) {
    console.error('[portal-logo] save failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const session = getPortalSession(req)
  if (!session) return unauthorizedResponse()
  if (!(await checkRateLimit(`portal-logo:${session.merchantId}`, LIMIT, WINDOW_MS))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }
  try {
    await storeLogosRepo.remove(session.merchantId)
    const settings = await settingsRepo.setLogoUrl(session.merchantId, '')
    return NextResponse.json({ logoUrl: settings.logoUrl })
  } catch (err) {
    console.error('[portal-logo] delete failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'database_unavailable' }, { status: 503 })
  }
}
