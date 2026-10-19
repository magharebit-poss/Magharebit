// Price formatting — all arithmetic in integer piastres (1 MAD = 100 piastres)

export function formatPrice(piastres: number): string {
  return `${(piastres / 100).toFixed(2)} MAD`;
}

export function madToPiastres(mad: number): number {
  return Math.round(mad * 100);
}

export interface Product {
  product_id: string;
  name_ar: string;
  name_fr: string;
  price_cents: number;
  category: string;
  is_bom: boolean;
  is_weighted: boolean;
  uom: string;
  barcode: string | null;
  plu_code: string | null;
  // Stock visibility fields (migration 021). Present when track_stock = true;
  // always returned by GET /products so these are always defined.
  stock_quantity: number;
  low_stock_threshold: number;
  track_stock: boolean;
  // Markdown fields (migration 024). is_perishable enables time-based rules;
  // effective_price_cents is the selling price (= price_cents when no markdown active).
  is_perishable: boolean;
  current_markdown_percent: number | null;
  effective_price_cents: number;
  thumb_url: string | null;
}

// Manual cashier discount. `value` is a percentage (0-100) when type is
// 'percentage', or an integer piastre amount when type is 'fixed'.
export interface Discount {
  type: 'percentage' | 'fixed';
  value: number;
  managerApprovedBy?: string; // staff_id when the discount needed approval
}

export interface CartLine {
  lineId: string;
  product: Product;
  quantity: number;
  unitPricePiastres: number;
  // lineTotalPiastres is the PRE-TAX (HT) line amount AFTER any line discount.
  lineTotalPiastres: number;
  taxRate: number;
  taxAmountPiastres: number;
  discount?: Discount; // optional per-line manual discount
}

export interface Staff {
  staff_id: string;
  name_ar: string;
  name_fr: string;
  role: string;
}

export interface TopProduct {
  productId: string;
  nameAr: string;
  qty: number;
  total: number;
}

export interface TenderLine {
  method: string;
  txCount: number;
  totalPiastres: number;
}

export interface ShiftSummary {
  shiftId: string;
  cashierNameAr: string | null;
  openedAt: string;
  closedAt: string | null;
  status: 'open' | 'closed' | 'error';
  openingFloatPiastres: number;
  closingCashCounted: number | null;
  expectedCash: number | null;
  cashVariance: number | null;
  txCount: number;
  totalSalesPiastres: number;
  cashCount: number;
  cashTotalPiastres: number;
  cardCount: number;
  cardTotalPiastres: number;
  totalTaxPiastres: number;
  topProducts: TopProduct[];
  tenderSummary?: TenderLine[];
}

export function makeLineId(): string {
  return `line-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

const TAX_RATE = 0.20; // 20% VAT (Morocco)

export function buildCartLine(product: Product, quantity: number): CartLine {
  // Use effective_price_cents (= price_cents when no markdown active) so
  // markdown prices flow through to cart totals and receipt lines automatically.
  const unit = product.effective_price_cents;
  const lineTotal = unit * quantity;
  const taxAmount = Math.round(lineTotal * TAX_RATE);
  return {
    lineId: makeLineId(),
    product,
    quantity,
    unitPricePiastres: unit,
    lineTotalPiastres: lineTotal,
    taxRate: TAX_RATE,
    taxAmountPiastres: taxAmount,
  };
}

export function recomputeLine(line: CartLine, quantity: number): CartLine {
  // Re-apply any stored line discount to the new quantity so discounts persist
  // through +/- changes.
  const baseHT = line.unitPricePiastres * quantity;
  const disc = computeDiscountAmount(baseHT, line.discount);
  const newHT = Math.max(0, baseHT - disc);
  return {
    ...line,
    quantity,
    lineTotalPiastres: newHT,
    taxAmountPiastres: Math.round(newHT * line.taxRate),
  };
}

export function cartTotals(lines: CartLine[]): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const subtotal = lines.reduce((s, l) => s + l.lineTotalPiastres, 0);
  const tax = lines.reduce((s, l) => s + l.taxAmountPiastres, 0);
  return { subtotal, tax, total: subtotal + tax };
}

// ─── Discounts (manual, per-line and per-cart) ──────────────────────────────
//
// Money is integer piastres. Discount amounts round HALF-UP (Math.round is
// half-up for non-negative values) and clamp at 0 (never negative). Tax is
// always RECOMPUTED on the discounted HT base, never subtracted from a
// tax-inclusive total. Per-line discounts apply FIRST, then the per-cart
// discount applies to the resulting (post-line-discount) subtotal.

export function isValidDiscount(d: Discount | undefined): boolean {
  if (!d) return false;
  if (!Number.isFinite(d.value)) return false;
  if (d.type === 'percentage') return d.value >= 0 && d.value <= 100;
  return d.value >= 0; // fixed: non-negative piastres
}

/**
 * The piastre amount a discount removes from `base`. Invalid discounts yield 0
 * (no discount). A fixed discount may not exceed `base` (clamped). Never
 * returns more than `base`.
 */
export function computeDiscountAmount(base: number, d: Discount | undefined): number {
  if (!isValidDiscount(d) || !d || base <= 0) return 0;
  const raw =
    d.type === 'percentage' ? Math.round((base * d.value) / 100) : Math.round(d.value);
  return Math.min(Math.max(0, raw), base);
}

/** Apply (or clear) a per-line discount, recomputing the line's HT + tax. */
export function applyLineDiscount(line: CartLine, discount: Discount | undefined): CartLine {
  return recomputeLine({ ...line, discount }, line.quantity);
}

/** Discounted subtotal after a per-cart discount (clamped at 0). */
export function applyCartDiscount(subtotal: number, discount: Discount | undefined): number {
  return Math.max(0, subtotal - computeDiscountAmount(subtotal, discount));
}

export interface CartTotalsResult {
  subtotalPiastres: number; // gross HT, before any discount
  lineDiscountsPiastres: number; // sum of per-line discounts
  cartDiscountPiastres: number; // per-cart discount amount
  totalDiscountPiastres: number; // line + cart
  taxPiastres: number; // recomputed on the final discounted base
  totalPiastres: number; // final, tax-inclusive (>= 0)
}

/**
 * Full cart totals with discounts. Line discounts first, then the cart discount
 * is allocated proportionally across lines so per-line tax can be recomputed on
 * each discounted HT base (handles per-line tax rates; remainder assigned to the
 * last line to keep the cart discount exact).
 */
export function computeCartTotals(
  lines: CartLine[],
  cartDiscount?: Discount,
): CartTotalsResult {
  let grossHT = 0;
  let lineDiscounts = 0;
  const perLine = lines.map((l) => {
    const baseHT = l.unitPricePiastres * l.quantity;
    const newHT = Math.max(0, baseHT - computeDiscountAmount(baseHT, l.discount));
    grossHT += baseHT;
    lineDiscounts += baseHT - newHT;
    return { ht: newHT, rate: l.taxRate };
  });

  const subtotalAfterLineDiscounts = perLine.reduce((s, x) => s + x.ht, 0);
  const cartDisc = computeDiscountAmount(subtotalAfterLineDiscounts, cartDiscount);

  let allocated = 0;
  let taxPiastres = 0;
  let finalSubtotalHT = 0;
  perLine.forEach((x, i) => {
    let share = 0;
    if (cartDisc > 0 && subtotalAfterLineDiscounts > 0) {
      share =
        i === perLine.length - 1
          ? cartDisc - allocated // remainder keeps the total exact
          : Math.round((cartDisc * x.ht) / subtotalAfterLineDiscounts);
      allocated += i === perLine.length - 1 ? 0 : share;
    }
    const finalHT = Math.max(0, x.ht - Math.max(0, share));
    finalSubtotalHT += finalHT;
    taxPiastres += Math.round(finalHT * x.rate);
  });

  return {
    subtotalPiastres: grossHT,
    lineDiscountsPiastres: lineDiscounts,
    cartDiscountPiastres: cartDisc,
    totalDiscountPiastres: lineDiscounts + cartDisc,
    taxPiastres,
    totalPiastres: finalSubtotalHT + taxPiastres,
  };
}

// ─── TVA invoice breakdown ──────────────────────────────────────────────────

/** One row of the per-rate TVA breakdown table on a formal invoice. */
export interface TaxSummaryLine {
  rate: number;        // decimal, e.g. 0.20 for 20% TVA
  htPiastres: number;  // base hors-taxe (after all discounts)
  tvaPiastres: number; // TVA amount
  ttcPiastres: number; // htPiastres + tvaPiastres
}

const DEFAULT_PCT_THRESHOLD = 20;
const DEFAULT_FIXED_THRESHOLD_PIASTRES = 5000; // 50 MAD

/** Whether a discount exceeds the env-configured manager-approval thresholds. */
export function discountNeedsApproval(d: Discount): boolean {
  if (d.type === 'percentage') {
    const raw = Number(process.env['NEXT_PUBLIC_DISCOUNT_PCT_THRESHOLD']);
    const threshold = Number.isFinite(raw) ? raw : DEFAULT_PCT_THRESHOLD;
    return d.value > threshold;
  }
  const raw = Number(process.env['NEXT_PUBLIC_DISCOUNT_FIXED_THRESHOLD_PIASTRES']);
  const threshold = Number.isFinite(raw) ? raw : DEFAULT_FIXED_THRESHOLD_PIASTRES;
  return d.value > threshold;
}

// ─── Waste recording types ──────────────────────────────────────────────

export type WasteReasonCode = 'SPOILED' | 'EXPIRED' | 'PREP_DAMAGE' | 'OTHER';

export const WASTE_THRESHOLDS = {
  weightedGrams: 10000, // 10 kg
  unitCount: 50,
} as const;

export interface WasteRecord {
  wasteRecordId: string;
  productId: string | null;
  productNameAr: string | null;
  quantityGrams: number;
  reasonCode: WasteReasonCode;
  notes: string | null;
  chainHash: string;
  previousHash: string | null;
  approvedByManagerId: string | null;
  recordedAt: string;
}

export interface ManagerInfo {
  staffId: string;
  nameAr: string;
  role: string;
}

// ─── Barcode / QR lookup ────────────────────────────────────────────────

export function findProductByCode(code: string, products: Product[]): Product | null {
  // Tier 1: barcode exact match
  const byBarcode = products.find((p) => p.barcode != null && p.barcode === code);
  if (byBarcode) return byBarcode;

  // Tier 2: plu_code exact match
  const byPlu = products.find((p) => p.plu_code != null && p.plu_code === code);
  if (byPlu) return byPlu;

  // Tier 3: product QR JSON { id, b }
  try {
    const parsed = JSON.parse(code) as { id?: string; b?: string };
    if (parsed?.id) {
      const byId = products.find((p) => p.product_id === parsed.id);
      if (byId) return byId;
    }
  } catch {
    // not JSON — normal barcode string
  }

  return null;
}
