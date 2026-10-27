/** POS installer locations. Server-side only: the URLs are never sent to the browser. */

export const DOWNLOAD_PLATFORMS = ['windows', 'android'] as const
export type DownloadPlatform = (typeof DOWNLOAD_PLATFORMS)[number]

/** Same-origin path of the placeholder installer served by `next dev` only (see app/api/dev-installer). */
export const DEV_INSTALLER_PREFIX = '/api/dev-installer/'

/**
 * DOWNLOAD_WINDOWS_URL / DOWNLOAD_ANDROID_URL. The older NEXT_PUBLIC_DOWNLOAD_* names are still
 * accepted so an existing deployment keeps working; prefer the server-only names.
 *
 * DEVELOPMENT ONLY: when neither is set, `next dev` points at a local placeholder file so the whole
 * license-gated flow (sign up, key, download) can be tested before the real installers exist.
 * process.env.NODE_ENV is replaced at build time, so in `next build` / `next start` this branch is
 * dead code: production without a configured URL stays "not available yet" (503), never a fake file.
 */
export function installerUrl(platform: DownloadPlatform): string {
  const v = platform === 'windows'
    ? process.env.DOWNLOAD_WINDOWS_URL || process.env.NEXT_PUBLIC_DOWNLOAD_WINDOWS_URL
    : process.env.DOWNLOAD_ANDROID_URL || process.env.NEXT_PUBLIC_DOWNLOAD_ANDROID_URL
  const url = (v ?? '').trim()
  if (url) return url
  if (process.env.NODE_ENV === 'development') return `${DEV_INSTALLER_PREFIX}${platform}`
  return ''
}
