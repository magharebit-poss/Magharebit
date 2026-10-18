/**
 * transaction-totals.ts
 *
 * Single source of truth for all transaction totals computation.
 *
 * Imported by:
 *   - src/lib/repositories/transactions.ts  (create / persist)
 *   - src/app/api/portal/transactions/route.ts  (validate before delegating)
 *   - Future logiciel integration / POS receipt preview
 *
 * All monetary values are rounded to 2 decimal places.
 * No external dependencies — pure functions only.
 */

// ── Tax rates ─────────────────────────────────────────────────────────────────

/** Moroccan TVA rates authorised by law (%). */
export const VALID_TAX_RATES = [0, 7, 10, 14, 20] as const
export type TaxRate = (typeof VALID_TAX_RATES)[number]

/** Returns true if `rate` is an allowed TVA rate. */
export function isValidTaxRate(rate: number): rate is TaxRate {
  return (VALID_TAX_RATES as readonly number[]).includes(rate)
}

// ── Discount ──────────────────────────────────────────────────────────────────

export type DiscountType = 'amount' | 'percent'

// ── Input / output types ──────────────────────────────────────────────────────

/**
 * Inputs required to compute all transaction totals.
 *
 * `lineTotals` — per-line computed totals AFTER any item-level discounts.
 *   e.g. [ qty*unitPrice - itemDiscount, ... ]
 * `discountType`  — 'amount' (flat MAD) | 'percent' (% of subtotal)
 * `discountValue` — raw value: MAD amount OR percentage (0–100).
 * `taxRate`       — Moroccan TVA: one of VALID_TAX_RATES.
 */
export interface TotalsInput {
  lineTotals:    number[]
  discountType:  DiscountType
  discountValue: number
  taxRate:       TaxRate
}

/** All computed monetary totals returned for a transaction. */
export interface TransactionTotals {
  /** Sum of all line totals (before any order-level discount). */
  subtotal:  number
  /** Absolute MAD discount applied to the order (computed). */
  discount:  number
  /** subtotal − discount — the pre-tax base for TVA calculation. */
  totalHT:   number
  /** totalHT × taxRate / 100 — TVA amount in MAD. */
  taxAmount: number
  /** totalHT + taxAmount — the amount the customer pays. */
  total:     number
}

// ── Core computation ──────────────────────────────────────────────────────────

/** Round to 2 decimal places (monetary precision). */
function r2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Compute all transaction totals.
 *
 * Rules enforced here (not in the caller):
 *   - 'amount' discount is capped at subtotal (can't produce negative totalHT)
 *   - 'percent' discount value is clamped to [0, 100] before application
 *   - taxAmount is applied to the discounted base (totalHT), not subtotal
 */
export function computeTotals(input: TotalsInput): TransactionTotals {
  const { lineTotals, discountType, discountValue, taxRate } = input

  const subtotal = r2(lineTotals.reduce((s, t) => s + t, 0))

  let discount: number
  if (discountType === 'percent') {
    const pct = Math.min(Math.max(discountValue, 0), 100)
    discount  = r2(subtotal * pct / 100)
  } else {
    // flat amount — cap at subtotal so totalHT ≥ 0
    discount = r2(Math.min(Math.max(discountValue, 0), subtotal))
  }

  const totalHT   = r2(subtotal - discount)
  const taxAmount = r2(totalHT * taxRate / 100)
  const total     = r2(totalHT + taxAmount)

  return { subtotal, discount, totalHT, taxAmount, total }
}
