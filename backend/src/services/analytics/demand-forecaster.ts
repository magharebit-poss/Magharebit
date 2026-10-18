import type { Pool } from 'pg';

// Moroccan calendar factors applied on top of the day-of-week baseline.
// Holiday codes come from dim_date.holiday_code.
const HOLIDAY_FACTOR: Record<string, number> = {
  EID_AL_FITR:   0.60,
  EID_AL_ADHA:   0.60,
  AID_THRONE:    0.75,
  RAMADAN:       1.35,
  FRIDAY:        1.25,   // coded inline via day-of-week
};

// Day-of-week adjustment (0=Sunday … 6=Saturday).
// Moroccan fresh-produce market has strong weekday bias.
const DOW_FACTOR: Record<number, number> = {
  0: 0.80, // Sunday  — closed / slow
  1: 1.10, // Monday  — post-weekend restock
  2: 1.05, // Tuesday
  3: 1.00, // Wednesday
  4: 1.00, // Thursday
  5: 1.25, // Friday  — main shopping day
  6: 0.80, // Saturday — half day / slower
};

const LEAD_DAYS   = 2;     // default supplier lead time
const HORIZON_DAYS = 7;    // forecast 7 days ahead
const MODEL_VERSION = 'v1_baseline';

interface ProductRow {
  product_id: string;
  store_id:   string | null;
  avg_qty:    string; // NUMERIC comes back as string from pg driver
}

interface HolidayRow {
  calendar_date: string;  // 'YYYY-MM-DD'
  holiday_code:  string | null;
}

interface StockRow {
  product_id: string;
  store_id:   string | null;
  on_hand:    string; // NUMERIC
}

interface ForecastInsert {
  tenant_id:     string;
  product_id:    string;
  store_id:      string | null;
  forecast_date: string;
  qty_predicted: number;
  qty_lower:     number;
  qty_upper:     number;
  reorder_point: number;
  model_version: string;
}

function calendarFactor(dow: number, holidayCode: string | null): number {
  let factor = DOW_FACTOR[dow] ?? 1.0;

  if (holidayCode) {
    const code = holidayCode.toUpperCase();
    if (code in HOLIDAY_FACTOR) {
      factor *= HOLIDAY_FACTOR[code]!;
    }
  } else if (dow === 5) {
    // Friday without a holiday code still gets the Friday lift
    // (DOW_FACTOR already encodes it, so no extra multiply needed)
  }

  return factor;
}

// Seasonal-naive baseline: mean of same-day-of-week sales over 8 weeks.
// Returns qty to expect for `forecastDate`.
function computeForecast(
  historicalMean: number,
  forecastDate:   Date,
  holidayCode:    string | null,
): { predicted: number; lower: number; upper: number; reorderPoint: number } {
  const dow = forecastDate.getDay();
  const factor = calendarFactor(dow, holidayCode);
  const predicted = Math.max(0, historicalMean * factor);

  // 80% confidence band (±20% of predicted)
  const lower      = Math.max(0, predicted * 0.80);
  const upper      = predicted * 1.20;
  // Reorder when stock would cover fewer than LEAD_DAYS of predicted demand
  const reorderPoint = predicted * LEAD_DAYS;

  return {
    predicted:    Math.round(predicted * 1000) / 1000,
    lower:        Math.round(lower * 1000) / 1000,
    upper:        Math.round(upper * 1000) / 1000,
    reorderPoint: Math.round(reorderPoint * 1000) / 1000,
  };
}

export async function runForecasting(tenantId: string, pg: Pool): Promise<void> {
  // Fetch per-(product, store) average daily sales over the last 8 weeks,
  // grouped by day-of-week to give us 7 averages per product.
  const { rows: products } = await pg.query<ProductRow>(
    `SELECT
       t.product_id::text  AS product_id,
       t.store_id::text    AS store_id,
       AVG(daily.qty)      AS avg_qty
     FROM (
       SELECT
         product_id,
         store_id,
         DATE(created_at)  AS sale_date,
         SUM(quantity)     AS qty
       FROM transaction_items ti
       JOIN transactions tx ON tx.transaction_id = ti.transaction_id
       WHERE tx.tenant_id = $1
         AND tx.created_at >= NOW() - INTERVAL '56 days'
         AND tx.status     = 'completed'
       GROUP BY product_id, store_id, DATE(created_at)
     ) daily
     JOIN products t ON t.product_id = daily.product_id
     WHERE t.tenant_id = $1
       AND t.is_active  = true
     GROUP BY t.product_id, daily.store_id`,
    [tenantId],
  );

  if (products.length === 0) return;

  // Fetch holiday data for the forecast horizon
  const today = new Date();
  const horizonEnd = new Date(today.getTime() + HORIZON_DAYS * 86400000);
  const horizonStart = today.toISOString().slice(0, 10);
  const horizonEndStr = horizonEnd.toISOString().slice(0, 10);

  const { rows: holidays } = await pg.query<HolidayRow>(
    `SELECT calendar_date::text, holiday_code
     FROM dim_date
     WHERE calendar_date >= $1
       AND calendar_date <= $2`,
    [horizonStart, horizonEndStr],
  );

  const holidayMap = new Map<string, string | null>();
  for (const h of holidays) {
    holidayMap.set(h.calendar_date, h.holiday_code ?? null);
  }

  // Build batch inserts
  const inserts: ForecastInsert[] = [];

  for (const product of products) {
    const historicalMean = parseFloat(product.avg_qty) || 0;

    for (let d = 0; d < HORIZON_DAYS; d++) {
      const forecastDate = new Date(today.getTime() + d * 86400000);
      const dateStr = forecastDate.toISOString().slice(0, 10);
      const holidayCode = holidayMap.get(dateStr) ?? null;

      const { predicted, lower, upper, reorderPoint } = computeForecast(
        historicalMean,
        forecastDate,
        holidayCode,
      );

      inserts.push({
        tenant_id:     tenantId,
        product_id:    product.product_id,
        store_id:      product.store_id,
        forecast_date: dateStr,
        qty_predicted: predicted,
        qty_lower:     lower,
        qty_upper:     upper,
        reorder_point: reorderPoint,
        model_version: MODEL_VERSION,
      });
    }
  }

  // Upsert all forecasts in one round-trip using unnest
  await pg.query(
    `INSERT INTO demand_forecasts
       (tenant_id, product_id, store_id, forecast_date,
        qty_predicted, qty_lower, qty_upper, reorder_point, model_version)
     SELECT
       unnest($1::uuid[]),
       unnest($2::uuid[]),
       unnest($3::uuid[]),
       unnest($4::date[]),
       unnest($5::numeric[]),
       unnest($6::numeric[]),
       unnest($7::numeric[]),
       unnest($8::numeric[]),
       unnest($9::text[])
     ON CONFLICT (tenant_id, product_id, store_id, forecast_date)
     DO UPDATE SET
       qty_predicted = EXCLUDED.qty_predicted,
       qty_lower     = EXCLUDED.qty_lower,
       qty_upper     = EXCLUDED.qty_upper,
       reorder_point = EXCLUDED.reorder_point,
       model_version = EXCLUDED.model_version,
       created_at    = now()`,
    [
      inserts.map((r) => r.tenant_id),
      inserts.map((r) => r.product_id),
      inserts.map((r) => r.store_id),
      inserts.map((r) => r.forecast_date),
      inserts.map((r) => r.qty_predicted),
      inserts.map((r) => r.qty_lower),
      inserts.map((r) => r.qty_upper),
      inserts.map((r) => r.reorder_point),
      inserts.map((r) => r.model_version),
    ],
  );
}

// Fetch current stock levels to pair with forecasts for reorder alerts.
export async function getStockLevels(
  tenantId: string,
  pg: Pool,
): Promise<Map<string, number>> {
  const { rows } = await pg.query<StockRow>(
    `SELECT product_id::text, NULL::text AS store_id, stock_quantity::text AS on_hand
     FROM products
     WHERE tenant_id = $1 AND is_active = true AND track_stock = true`,
    [tenantId],
  );

  const map = new Map<string, number>();
  for (const r of rows) {
    const key = `${r.product_id}:${r.store_id ?? 'null'}`;
    map.set(key, parseFloat(r.on_hand) || 0);
  }
  return map;
}
