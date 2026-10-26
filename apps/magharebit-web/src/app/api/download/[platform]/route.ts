/**
 * GET /api/download/[platform]    platform = windows | android
 *
 * License-gated installer download. Requires a merchant portal session and an ACTIVE license
 * (a trial counts). Then it answers 302 to the installer URL, which only the server knows:
 *   DOWNLOAD_WINDOWS_URL / DOWNLOAD_ANDROID_URL
 * (the older NEXT_PUBLIC_DOWNLOAD_* names are still accepted as a fallback).
 *
 *   no session            -> 302 to the portal login, then back here (?next=)
 *   no active license     -> 403 license_required
 *   installer not set up  -> 503 not_available_yet
 *
 * The redirect is never cached, so a revoked or expired license stops downloads immediately.
 * Point the installer URLs at a host that serves the file itself (release storage / CDN).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession } from '@/lib/portal-session'
import { merchantsRepo } from '@/lib/repositories/merchants'
import { licensesRepo } from '@/lib/repositories/licenses'
import { DOWNLOAD_PLATFORMS, installerUrl, type DownloadPlatform } from '@/lib/downloads'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const { platform } = await params
  if (!DOWNLOAD_PLATFORMS.includes(platform as DownloadPlatform)) {
    return NextResponse.json({ error: 'unknown_platform' }, { status: 404 })
  }

  const localeMatch = req.nextUrl.searchParams.get('locale')
  const locale = localeMatch === 'fr' || localeMatch === 'en' ? localeMatch : 'ar'

  const session = getPortalSession(req)
  if (!session) {
    const login = new URL(`/${locale}/portal/login`, req.url)
    login.searchParams.set('next', `/api/download/${platform}?locale=${locale}`)
    return NextResponse.redirect(login, 302)
  }

  const merchant = await merchantsRepo.findById(session.merchantId)
  if (!merchant || merchant.status !== 'approved') {
    return NextResponse.json({ error: 'account_not_active' }, { status: 403 })
  }
  const { licenses } = await licensesRepo.findAll({ merchantId: merchant.phone || merchant.email || '', status: 'active' })
  if (!licenses.length) {
    return NextResponse.json({ error: 'license_required' }, { status: 403 })
  }

  const url = installerUrl(platform as DownloadPlatform)
  if (!url) {
    return NextResponse.json({ error: 'not_available_yet' }, { status: 503 })
  }

  const res = NextResponse.redirect(url, 302)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
