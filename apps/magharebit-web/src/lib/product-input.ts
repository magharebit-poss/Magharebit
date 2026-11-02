/**
 * Typed validation for product writes (POST /api/portal/products, PATCH /api/portal/products/[id]).
 *
 * The routes used to copy allow-listed keys straight into `$set`, so a body could store any JSON type: a negative
 * or NaN stock (LAW 1: negative stock must be impossible), a price that is an object (breaks every total computed
 * from it), or a megabyte-long name. Each field now has one accepted type and range; anything else is a 422 that
 * names the field. Values are copied into a fresh object, so no key outside the list ever reaches MongoDB.
 */

export const PRODUCT_LIMITS = { name: 120, category: 60, unit: 20, emoji: 16, barcode: 64, plu: 32, money: 10_000_000, qty: 10_000_000 } as const

export type ProductInput = Partial<{
  name: string; category: string; price: number; costPrice: number; stock: number; minStock: number
  unit: string; emoji: string; barcode: string; isActive: boolean
}>

export type ProductInputResult = { ok: true; data: ProductInput } | { ok: false; error: string }

const str = (v: unknown, max: number, required: boolean): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if ((required && !s) || s.length > max) return null
  return s
}
const num = (v: unknown, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null

/** Validates the fields present in `body` (all optional). Unknown keys are ignored, never copied. */
export function validateProductInput(body: Record<string, unknown>): ProductInputResult {
  const out: ProductInput = {}
  const L = PRODUCT_LIMITS
  for (const [key, max, required] of [['name', L.name, true], ['category', L.category, true], ['unit', L.unit, true], ['emoji', L.emoji, false], ['barcode', L.barcode, false]] as const) {
    if (!(key in body)) continue
    const s = str(body[key], max, required)
    if (s === null) return { ok: false, error: `${key}_invalid` }
    out[key] = s
  }
  for (const [key, max] of [['price', L.money], ['costPrice', L.money], ['stock', L.qty], ['minStock', L.qty]] as const) {
    if (!(key in body)) continue
    const n = num(body[key], max)
    if (n === null) return { ok: false, error: `${key}_invalid` }
    out[key] = n
  }
  if ('isActive' in body) {
    if (typeof body.isActive !== 'boolean') return { ok: false, error: 'isActive_invalid' }
    out.isActive = body.isActive
  }
  return { ok: true, data: out }
}

export const isObjectId = (id: string): boolean => /^[a-f\d]{24}$/i.test(id)
