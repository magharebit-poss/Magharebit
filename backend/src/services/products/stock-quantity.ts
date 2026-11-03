/**
 * products.stock_quantity helpers for the NUMERIC(14,3) column (migration 052; kilograms for weighted
 * products, whole units otherwise). Safe to use before 052 as well: the INTEGER column just rejects
 * decimals at the database, which parseStockQuantity cannot know about.
 */

/** NUMERIC(14,3): at most 11 integer digits and 3 decimals. */
export const MAX_STOCK_QUANTITY = 99_999_999_999.999;

export type StockQuantityParse =
  | { ok: true; value: number | undefined }
  | { ok: false; error: string };

/**
 * Parses a stock quantity coming from a request (JSON number, or a string from a multipart form).
 * - absent / null / '' -> { ok: true, value: undefined } (leave the column alone)
 * - a finite, non-negative number or numeric string -> { ok: true, value } rounded to 3 decimals
 * - anything else (NaN, 'abc', negative, Infinity, too large) -> { ok: false, error }
 * parseInt is NOT used: it silently truncated 1.5 to 1 (the multipart route did this).
 */
export function parseStockQuantity(val: unknown): StockQuantityParse {
  if (val === undefined || val === null) return { ok: true, value: undefined };
  if (typeof val === 'string') {
    const t = val.trim();
    if (t === '') return { ok: true, value: undefined };
    if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t)) return { ok: false, error: 'stock_quantity must be a number' };
    val = t;
  } else if (typeof val !== 'number') {
    return { ok: false, error: 'stock_quantity must be a number' };
  }
  const n = Number(val);
  if (!Number.isFinite(n)) return { ok: false, error: 'stock_quantity must be a finite number' };
  if (n < 0) return { ok: false, error: 'stock_quantity must not be negative' };
  const rounded = Math.round(n * 1000) / 1000;
  if (rounded > MAX_STOCK_QUANTITY) return { ok: false, error: 'stock_quantity is too large' };
  return { ok: true, value: rounded };
}

/**
 * pg returns NUMERIC as a string ("4995.900"). Clients (pos-web) compare stock with `=== 0` and do
 * arithmetic, so a row that came from `RETURNING *` is normalised to a number before it is sent.
 * Rows whose stock_quantity is already a number (INTEGER column, or an explicit ::float8) are untouched.
 */
export function withNumericStock<T extends { stock_quantity?: unknown }>(row: T): T {
  if (typeof row.stock_quantity === 'string') {
    const n = Number(row.stock_quantity);
    if (Number.isFinite(n)) return { ...row, stock_quantity: n };
  }
  return row;
}
