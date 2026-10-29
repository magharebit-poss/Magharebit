/**
 * GET /api/stores/[merchantId]/logo   the store's logo image (public: a logo is a brand asset shown to
 * customers, and the POS can fetch it without a portal session).
 *
 * The URL saved in settings carries ?v=<hash prefix>. When it matches the stored image the response may be
 * cached for a year; any other request gets a short cache so a replaced logo shows up quickly.
 * 404 when the merchant has no logo (or the database is down: the portal then shows the initial).
 */

import { NextRequest, NextResponse } from 'next/server'
import { storeLogosRepo } from '@/lib/repositories/store-logos'
import { isMerchantId } from '@/lib/store-logo'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ merchantId: string }> },
): Promise<NextResponse> {
  const { merchantId } = await params
  if (!isMerchantId(merchantId)) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const logo = await storeLogosRepo.get(merchantId)
  if (!logo) return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })

  const etag = `"${logo.sha256.slice(0, 32)}"`
  const versioned = req.nextUrl.searchParams.get('v') === logo.sha256.slice(0, 16)
  const headers = {
    'Content-Type': logo.contentType,
    'Cache-Control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    ETag: etag,
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cross-Origin-Resource-Policy': 'cross-origin',
  }
  if (req.headers.get('if-none-match') === etag) return new NextResponse(null, { status: 304, headers })
  return new NextResponse(Buffer.from(logo.data), { status: 200, headers: { ...headers, 'Content-Length': String(logo.size) } })
}
