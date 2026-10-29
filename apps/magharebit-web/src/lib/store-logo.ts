/**
 * Store logo: limits, type sniffing and the public URL.
 *
 * The portal resizes the picture in the browser (longest side LOGO_MAX_SIDE, WebP when the browser can
 * encode it) and uploads the bytes to PUT /api/portal/settings/logo. The server never trusts the declared
 * Content-Type: it reads the magic bytes and accepts PNG, JPEG and WebP only. SVG is refused on purpose
 * (it can carry script), as is anything else.
 *
 * Bytes live in MongoDB (`store_logos`, one document per merchant) because the app has no object storage
 * and Vercel has no persistent disk. Settings keep only the URL, versioned with the content hash so the
 * image can be cached for a year and still change the moment the merchant uploads a new one.
 */

export type LogoType = 'image/png' | 'image/jpeg' | 'image/webp'

/** Upload cap after the browser has resized the image (a 512 px WebP logo is usually 10-60 KB). */
export const LOGO_MAX_BYTES = 512 * 1024
/** Longest side the portal resizes to before uploading. */
export const LOGO_MAX_SIDE = 512
/** Largest original file the portal accepts before resizing. */
export const LOGO_MAX_SOURCE_BYTES = 8 * 1024 * 1024

export function sniffLogoType(b: Uint8Array): LogoType | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return 'image/png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp'
  return null
}

/** Window event the settings page fires after a logo change, so the portal sidebar refreshes its avatar. */
export const STORE_LOGO_EVENT = 'mgh:store-logo'

/** Merchant ids in portal sessions are MongoDB ObjectId strings. */
export function isMerchantId(v: string): boolean {
  return /^[a-f0-9]{24}$/.test(v)
}

export function storeLogoUrl(merchantId: string, sha256: string): string {
  return `/api/stores/${merchantId}/logo?v=${sha256.slice(0, 16)}`
}
