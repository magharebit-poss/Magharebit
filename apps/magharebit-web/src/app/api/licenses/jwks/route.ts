/**
 * GET /api/licenses/jwks: public keys the POS uses to verify license tokens (JWKS, RFC 7517).
 * 503 when no signing key is configured (the POS must keep using v1 in that case).
 */

import { NextResponse } from 'next/server'
import { publicJwks } from '@/lib/license-token'

export async function GET(): Promise<NextResponse> {
  const keys = publicJwks()
  if (!keys) return NextResponse.json({ error: 'v2_not_configured' }, { status: 503 })
  return NextResponse.json({ keys }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
