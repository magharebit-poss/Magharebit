/**
 * Canonical line-item shape for everything stored in transactions.items.
 * All money fields are 1/100 MAD (piastres/centimes) integers.
 */
export interface CanonicalLineItem {
  productId: string;
  nameAr: string;
  nameFr: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
  discountCents: number;
  lineTotalCents: number;
  isWeighted: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawItem = Record<string, any>;

/**
 * normalizeLineItem — maps any historical or current variant field name to
 * the canonical shape. Safe to call on rows already in the canonical shape.
 *
 * Field name variants handled:
 *   price:      unitPricePiastres | unitPriceCents | effectivePriceCents | unit_price
 *   lineTotal:  lineTotalPiastres | lineTotalCents | line_total
 *   discount:   discountCents | discount?.value (fixed piastres)
 *   id:         productId | product_id
 */
export function normalizeLineItem(raw: RawItem): CanonicalLineItem {
  const productId: string =
    raw['productId'] ?? raw['product_id'] ?? '';

  const nameAr: string =
    raw['nameAr'] ?? raw['name_ar'] ?? '';
  const nameFr: string =
    raw['nameFr'] ?? raw['name_fr'] ?? '';

  const quantity: number =
    Number(raw['quantity'] ?? 1);

  const unit: string =
    raw['unit'] ?? raw['uom'] ?? 'unit';

  const unitPriceCents: number = Number(
    raw['unitPriceCents'] ??
    raw['unitPricePiastres'] ??
    raw['effectivePriceCents'] ??
    raw['unit_price'] ??
    0,
  );

  // Inline discount: prefer explicit discountCents field, fall back to
  // discount object (fixed type only — percentage already applied at cart).
  const discountCents: number = Number(
    raw['discountCents'] ??
    (raw['discount']?.type === 'fixed' ? raw['discount'].value : undefined) ??
    0,
  );

  const lineTotalCents: number = Number(
    raw['lineTotalCents'] ??
    raw['lineTotalPiastres'] ??
    raw['line_total'] ??
    0,
  );

  const isWeighted: boolean =
    Boolean(raw['isWeighted'] ?? raw['is_weighted'] ?? false);

  return {
    productId,
    nameAr,
    nameFr,
    quantity,
    unit,
    unitPriceCents,
    discountCents,
    lineTotalCents,
    isWeighted,
  };
}
