// Cost Shield V1 — pure helpers for supplier-invoice cost warnings.
// All money here is integer cents; percentages are plain numbers (12.5 = 12.5%).

/** A supplier cost increase at or above this percentage raises a warning. */
export const COST_INCREASE_ALERT_PCT = 5;

export interface CostAlert {
  product_id: string;
  name_ar: string;
  name_fr: string;
  previous_cost_cents: number | null;
  new_cost_cents: number;
  increase_pct: number | null;
  price_cents: number;
  margin_before_pct: number | null;
  margin_after_pct: number | null;
  reason: 'price_increase' | 'below_cost';
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

function marginPct(priceCents: number, costCents: number): number | null {
  if (priceCents <= 0) return null;
  return round2(((priceCents - costCents) / priceCents) * 100);
}

/**
 * Compare a product's previous cost with the cost on a new invoice line.
 * Returns an alert when the increase reaches the threshold, or when the new
 * cost is at or above the selling price (selling at a loss). Never blocks.
 */
export function evaluateCostChange(input: {
  product_id: string;
  name_ar: string;
  name_fr: string;
  previous_cost_cents: number | null;
  new_cost_cents: number;
  price_cents: number;
}): CostAlert | null {
  const { previous_cost_cents: prev, new_cost_cents: next, price_cents: price } = input;
  const hasPrev = prev !== null && prev > 0;

  const increasePct = hasPrev ? round2(((next - prev) / prev) * 100) : null;
  const belowCost = price > 0 && next >= price;
  const increased = increasePct !== null && increasePct >= COST_INCREASE_ALERT_PCT;
  if (!increased && !belowCost) return null;

  return {
    product_id: input.product_id,
    name_ar: input.name_ar,
    name_fr: input.name_fr,
    previous_cost_cents: hasPrev ? prev : null,
    new_cost_cents: next,
    increase_pct: increasePct,
    price_cents: price,
    margin_before_pct: hasPrev ? marginPct(price, prev) : null,
    margin_after_pct: marginPct(price, next),
    reason: belowCost ? 'below_cost' : 'price_increase',
  };
}
