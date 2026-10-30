/**
 * Every product visual on the public site, in one place.
 *
 * To publish a real screenshot: put the file in `public/media/` (PNG or WebP at the size below, no device frame
 * around it: the site draws the frame), then set `src` to its path, e.g. '/media/pos-sale.webp'. Until then the
 * site shows a labelled placeholder in the same frame and size, so nothing moves when the real image arrives.
 * next/image serves AVIF/WebP and lazy-loads everything below the fold.
 *
 * The demo video is set with NEXT_PUBLIC_DEMO_VIDEO_URL (a YouTube or Vimeo link, or a same-origin .mp4/.webm).
 * Nothing is requested from YouTube/Vimeo until a visitor presses play.
 *
 * Rules: real screens only (no mock-ups passed off as the product), no real merchant data, no AI "customers".
 */

import type { Lang } from '@/components/landing/useLang'

export type Device = 'desktop' | 'laptop' | 'tablet' | 'phone'
/** What the placeholder sketches inside the frame while there is no screenshot yet. */
export type Sketch = 'pos' | 'dashboard' | 'mobile'

export interface ScreenSlot {
  device: Device
  sketch: Sketch
  /** '/media/…' once the screenshot exists; null shows the placeholder. */
  src: string | null
  /** Pixel size the screenshot should be delivered at (also sets the frame's aspect ratio). */
  width: number
  height: number
  /** Alt text for the real screenshot. */
  alt: Record<Lang, string>
  /** Which screenshot is expected here (shown on the placeholder, for whoever captures it). */
  shot: Record<Lang, string>
}

export type ScreenId = 'pos-sale' | 'tablet-order' | 'phone-pos' | 'portal-dashboard'

export const SCREENS: Record<ScreenId, ScreenSlot> = {
  'pos-sale': {
    device: 'desktop', sketch: 'pos', src: null, width: 1600, height: 1000,
    alt: {
      ar: 'شاشة البيع في صندوق MAGHAREBIT: المنتجات والسلة والمجموع',
      fr: 'Écran de vente de la caisse MAGHAREBIT : produits, panier et total',
      en: 'MAGHAREBIT till sale screen: products, cart and total',
    },
    shot: { ar: 'الصندوق: شاشة البيع', fr: 'Caisse : écran de vente', en: 'Till: sale screen' },
  },
  'tablet-order': {
    device: 'tablet', sketch: 'pos', src: null, width: 1600, height: 1200,
    alt: {
      ar: 'تطبيق MAGHAREBIT على لوحة: أخذ طلب',
      fr: 'MAGHAREBIT sur tablette : prise de commande',
      en: 'MAGHAREBIT on a tablet: taking an order',
    },
    shot: { ar: 'اللوحة: أخذ طلب', fr: 'Tablette : prise de commande', en: 'Tablet: taking an order' },
  },
  'phone-pos': {
    device: 'phone', sketch: 'mobile', src: null, width: 780, height: 1688,
    alt: {
      ar: 'تطبيق MAGHAREBIT على الهاتف',
      fr: 'Application MAGHAREBIT sur téléphone',
      en: 'MAGHAREBIT app on a phone',
    },
    shot: { ar: 'الهاتف: البيع والمبيعات', fr: 'Téléphone : vente et chiffres du jour', en: 'Phone: sale and today’s figures' },
  },
  'portal-dashboard': {
    device: 'laptop', sketch: 'dashboard', src: null, width: 1600, height: 1000,
    alt: {
      ar: 'لوحة التحكم في بوابة التاجر: المبيعات والمخزون',
      fr: 'Tableau de bord du portail commerçant : ventes et stock',
      en: 'Merchant portal dashboard: sales and stock',
    },
    shot: { ar: 'بوابة التاجر: لوحة التحكم', fr: 'Portail : tableau de bord', en: 'Portal: dashboard' },
  },
}

// ── Demo video ────────────────────────────────────────────────────────────────

export const DEMO_VIDEO = {
  url: (process.env.NEXT_PUBLIC_DEMO_VIDEO_URL ?? '').trim(),
  /** Cover image for the video section ('/media/…'); null draws a branded cover. */
  poster: null as string | null,
}

export type ParsedVideo =
  | { kind: 'youtube'; id: string; embed: string }
  | { kind: 'vimeo'; id: string; embed: string }
  | { kind: 'file'; src: string }

/**
 * Turns whatever link marketing pastes into something we can play. YouTube goes through youtube-nocookie.com
 * (no tracking cookies before play), Vimeo with dnt=1. Anything unrecognised returns null (treated as "no video").
 */
export function parseVideoUrl(raw: string): ParsedVideo | null {
  const url = raw.trim()
  if (!url) return null
  if (/^\/[^/].*\.(mp4|webm)(\?.*)?$/i.test(url)) return { kind: 'file', src: url }
  let u: URL
  try { u = new URL(url) } catch { return null }
  const host = u.hostname.replace(/^www\.|^m\./, '')
  let yt: string | null = null
  if (host === 'youtu.be') yt = u.pathname.slice(1)
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    yt = u.searchParams.get('v') ?? (u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)?.[1] ?? null)
  }
  if (yt && /^[A-Za-z0-9_-]{6,20}$/.test(yt)) {
    return { kind: 'youtube', id: yt, embed: `https://www.youtube-nocookie.com/embed/${yt}?autoplay=1&rel=0&modestbranding=1&playsinline=1` }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = u.pathname.match(/(?:^|\/)(\d{6,12})(?:\/|$)/)?.[1]
    if (id) return { kind: 'vimeo', id, embed: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1` }
  }
  if (u.protocol === 'https:' && /\.(mp4|webm)$/i.test(u.pathname)) return { kind: 'file', src: url }
  return null
}
