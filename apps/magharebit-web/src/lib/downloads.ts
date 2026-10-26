/** POS installer locations. Server-side only: the URLs are never sent to the browser. */

export const DOWNLOAD_PLATFORMS = ['windows', 'android'] as const
export type DownloadPlatform = (typeof DOWNLOAD_PLATFORMS)[number]

/**
 * DOWNLOAD_WINDOWS_URL / DOWNLOAD_ANDROID_URL. The older NEXT_PUBLIC_DOWNLOAD_* names are still
 * accepted so an existing deployment keeps working; prefer the server-only names.
 */
export function installerUrl(platform: DownloadPlatform): string {
  const v = platform === 'windows'
    ? process.env.DOWNLOAD_WINDOWS_URL || process.env.NEXT_PUBLIC_DOWNLOAD_WINDOWS_URL
    : process.env.DOWNLOAD_ANDROID_URL || process.env.NEXT_PUBLIC_DOWNLOAD_ANDROID_URL
  return (v ?? '').trim()
}
