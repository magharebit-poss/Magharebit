/**
 * GET /api/dev-installer/[platform]   (DEVELOPMENT ONLY)
 *
 * A tiny placeholder "installer" so the license-gated download flow can be tested end to end under `next dev`
 * before the real POS builds exist. It is a harmless text file, not an executable.
 *
 * In production this route does not exist: NODE_ENV is replaced at build time, so the handler answers 404
 * and lib/downloads.ts never points here. Real installers come from DOWNLOAD_WINDOWS_URL / DOWNLOAD_ANDROID_URL.
 */

import { NextResponse } from 'next/server'
import { DOWNLOAD_PLATFORMS, type DownloadPlatform } from '@/lib/downloads'

export async function GET(_req: Request, { params }: { params: Promise<{ platform: string }> }): Promise<NextResponse> {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  const { platform } = await params
  if (!DOWNLOAD_PLATFORMS.includes(platform as DownloadPlatform)) {
    return NextResponse.json({ error: 'unknown_platform' }, { status: 404 })
  }
  const body =
    `MAGHAREBIT POS: DEVELOPMENT PLACEHOLDER (${platform})\n\n` +
    'This is not the real installer. It exists so the license-gated download flow can be tested locally.\n' +
    'Set DOWNLOAD_WINDOWS_URL / DOWNLOAD_ANDROID_URL to the real release files for staging and production.\n'
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="magharebit-pos-DEV-PLACEHOLDER-${platform}.txt"`,
      'Cache-Control': 'no-store',
    },
  })
}
