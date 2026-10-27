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
 *   `next dev` only, URL not set -> 302 to a local placeholder file (see lib/downloads.ts)
 *
 * Errors answer JSON, except for browser navigations (Accept: text/html), which get a short branded page in the
 * visitor's language instead of raw JSON. The redirect is never cached, so a revoked or expired license stops
 * downloads immediately. Point the installer URLs at a host that serves the file itself (release storage / CDN).
 */

import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession } from '@/lib/portal-session'
import { merchantsRepo } from '@/lib/repositories/merchants'
import { licensesRepo } from '@/lib/repositories/licenses'
import { DOWNLOAD_PLATFORMS, installerUrl, type DownloadPlatform } from '@/lib/downloads'

type Locale = 'ar' | 'fr' | 'en'

const PAGE_COPY: Record<'not_available_yet' | 'license_required', Record<Locale, { title: string; body: string; back: string }>> = {
  not_available_yet: {
    ar: { title: 'المثبّت غير متاح بعد', body: 'ترخيصك ساري ومحفوظ. سنُبلغك فور نشر رابط التحميل، ولا حاجة لإعادة التسجيل.', back: 'العودة إلى صفحة التحميل' },
    fr: { title: 'Le programme d’installation n’est pas encore disponible', body: 'Votre licence reste valide et conservée. Nous vous prévenons dès que le téléchargement est publié, sans nouvelle inscription.', back: 'Retour à la page de téléchargement' },
    en: { title: 'The installer is not available yet', body: 'Your license stays valid and saved. We will tell you as soon as the download is published, with no need to sign up again.', back: 'Back to the download page' },
  },
  license_required: {
    ar: { title: 'يلزم ترخيص ساري', body: 'لا يوجد ترخيص نشط مرتبط بهذا الحساب. تواصل معنا للحصول على ترخيص أو لتجديده.', back: 'العودة إلى صفحة التحميل' },
    fr: { title: 'Une licence active est nécessaire', body: 'Aucune licence active n’est associée à ce compte. Contactez-nous pour en obtenir une ou la renouveler.', back: 'Retour à la page de téléchargement' },
    en: { title: 'An active license is required', body: 'There is no active license on this account. Contact us to get one or to renew it.', back: 'Back to the download page' },
  },
}

/** JSON for scripts and tools, a small branded page for people clicking a button in a browser. */
function failure(req: NextRequest, locale: Locale, error: 'not_available_yet' | 'license_required' | 'account_not_active', status: number): NextResponse {
  const kind = error === 'not_available_yet' ? 'not_available_yet' : 'license_required'
  if (!(req.headers.get('accept') ?? '').includes('text/html')) {
    return NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
  const c = PAGE_COPY[kind][locale]
  const html = `<!doctype html><html lang="${locale}" dir="${locale === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${c.title}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#0A2318;color:#fff;font-family:system-ui,sans-serif;padding:24px">
<main style="max-width:520px;background:#0F3D2A;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:28px">
<h1 style="margin:0 0 10px;font-size:22px">${c.title}</h1><p style="margin:0 0 20px;line-height:1.7;color:rgba(255,255,255,.78)">${c.body}</p>
<a href="/${locale}/download" style="display:inline-flex;align-items:center;min-height:48px;padding:0 22px;border-radius:999px;background:#F0B429;color:#0A2318;font-weight:800;text-decoration:none">${c.back}</a></main></body></html>`
  return new NextResponse(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const { platform } = await params
  if (!DOWNLOAD_PLATFORMS.includes(platform as DownloadPlatform)) {
    return NextResponse.json({ error: 'unknown_platform' }, { status: 404 })
  }

  const localeMatch = req.nextUrl.searchParams.get('locale')
  const locale: Locale = localeMatch === 'fr' || localeMatch === 'en' ? localeMatch : 'ar'

  const session = getPortalSession(req)
  if (!session) {
    const login = new URL(`/${locale}/portal/login`, req.url)
    login.searchParams.set('next', `/api/download/${platform}?locale=${locale}`)
    return NextResponse.redirect(login, 302)
  }

  const merchant = await merchantsRepo.findById(session.merchantId)
  if (!merchant || merchant.status !== 'approved') {
    return failure(req, locale, 'account_not_active', 403)
  }
  const { licenses } = await licensesRepo.findAll({ merchantId: merchant.phone || merchant.email || '', status: 'active' })
  if (!licenses.length) {
    return failure(req, locale, 'license_required', 403)
  }

  const url = installerUrl(platform as DownloadPlatform)
  if (!url) {
    return failure(req, locale, 'not_available_yet', 503)
  }

  // A relative URL (the development placeholder) is resolved against this request.
  const res = NextResponse.redirect(new URL(url, req.url), 302)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
