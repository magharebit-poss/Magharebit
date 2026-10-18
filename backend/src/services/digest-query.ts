import type { Pool } from 'pg';

export interface DigestData {
  tenantId: string;
  date: string; // YYYY-MM-DD
  totalSalesPiastres: number;
  transactionCount: number;
  topProducts: Array<{
    nameAr: string;
    nameFr: string;
    revenuePiastres: number;
    quantity: number;
  }>;
  totalWastePiastres: number;
  topWasteItem: string | null;
  lowStockProducts: Array<{
    nameAr: string;
    nameFr: string;
    stockQuantity: number;
    threshold: number;
  }>;
  anomalyFlags: {
    largeDiscountCount: number;
    largeReturnCount: number;
    voidCount: number;
  };
}

export async function buildDigestData(
  pg: Pool,
  tenantId: string,
  timezone: string,
): Promise<DigestData> {
  // Day boundaries in tenant's local timezone.
  // day_start = start of yesterday, day_end = start of today.
  const boundaryRes = await pg.query<{ day_start: string; day_end: string; date_label: string }>(
    `SELECT
       (DATE_TRUNC('day', NOW() AT TIME ZONE $1) - INTERVAL '1 day')
         AT TIME ZONE $1 AS day_start,
       DATE_TRUNC('day', NOW() AT TIME ZONE $1)
         AT TIME ZONE $1 AS day_end,
       TO_CHAR(
         DATE_TRUNC('day', NOW() AT TIME ZONE $1) - INTERVAL '1 day',
         'YYYY-MM-DD'
       ) AS date_label`,
    [timezone],
  );
  const { day_start, day_end, date_label } = boundaryRes.rows[0]!;

  const anomalyThreshold = parseInt(
    process.env['DIGEST_ANOMALY_THRESHOLD_PIASTRES'] ?? '5000',
    10,
  );

  // Q1 — Sales summary
  const salesRes = await pg.query<{ total: string; count: string }>(
    `SELECT
       COALESCE(SUM(total_amount_cents), 0) AS total,
       COUNT(*)                             AS count
     FROM transactions
     WHERE tenant_id = $1
       AND status != 'voided'
       AND created_at >= $2
       AND created_at < $3`,
    [tenantId, day_start, day_end],
  );
  const salesRow = salesRes.rows[0]!;

  // Q2 — Top 3 products by revenue (items stored as JSONB with camelCase keys)
  const topProdRes = await pg.query<{
    name_ar: string;
    name_fr: string;
    revenue: string;
    quantity: string;
  }>(
    `SELECT
       p.name_ar,
       p.name_fr,
       SUM(x."lineTotalPiastres") AS revenue,
       SUM(x."quantity")          AS quantity
     FROM transactions t,
       jsonb_to_recordset(t.items)
         AS x("productId" text, "quantity" int, "lineTotalPiastres" int)
     JOIN products p ON p.product_id::text = x."productId"
     WHERE t.tenant_id = $1
       AND t.status != 'voided'
       AND t.created_at >= $2
       AND t.created_at < $3
     GROUP BY p.product_id, p.name_ar, p.name_fr
     ORDER BY revenue DESC
     LIMIT 3`,
    [tenantId, day_start, day_end],
  );

  // Q3 — Waste summary: join with products for cost (no total_cost_piastres column in waste_records)
  const wasteRes = await pg.query<{ total_cost: string; top_item: string }>(
    `SELECT
       COALESCE(SUM(p.price_cents), 0) AS total_cost,
       p.name_ar                       AS top_item
     FROM waste_records wr
     JOIN products p ON p.product_id = wr.product_id
     WHERE wr.tenant_id = $1
       AND wr.server_received_at >= $2
       AND wr.server_received_at < $3
     GROUP BY p.product_id, p.name_ar
     ORDER BY SUM(p.price_cents) DESC
     LIMIT 1`,
    [tenantId, day_start, day_end],
  );

  // Total waste cost across all products
  const wasteTotalRes = await pg.query<{ total_cost: string }>(
    `SELECT COALESCE(SUM(p.price_cents), 0) AS total_cost
     FROM waste_records wr
     JOIN products p ON p.product_id = wr.product_id
     WHERE wr.tenant_id = $1
       AND wr.server_received_at >= $2
       AND wr.server_received_at < $3`,
    [tenantId, day_start, day_end],
  );

  // Q4 — Low stock products
  const lowStockRes = await pg.query<{
    name_ar: string;
    name_fr: string;
    stock_quantity: string;
    low_stock_threshold: string;
  }>(
    `SELECT name_ar, name_fr, stock_quantity, low_stock_threshold
     FROM products
     WHERE tenant_id = $1
       AND track_stock = true
       AND stock_quantity <= low_stock_threshold
       AND is_active = true
     ORDER BY stock_quantity ASC
     LIMIT 10`,
    [tenantId],
  );

  // Q5 — Anomaly flags
  const anomalyRes = await pg.query<{ large_discounts: string; voids: string }>(
    `SELECT
       COUNT(*) FILTER (WHERE total_discount_cents > $2) AS large_discounts,
       COUNT(*) FILTER (WHERE status = 'voided')        AS voids
     FROM transactions
     WHERE tenant_id = $1
       AND created_at >= $3
       AND created_at < $4`,
    [tenantId, anomalyThreshold, day_start, day_end],
  );

  const returnsRes = await pg.query<{ large_returns: string }>(
    `SELECT COUNT(*) AS large_returns
     FROM pos_returns
     WHERE tenant_id = $1
       AND total_piastres > $2
       AND created_at >= $3
       AND created_at < $4`,
    [tenantId, anomalyThreshold, day_start, day_end],
  );

  const anomaly = anomalyRes.rows[0]!;
  const wasteTop = wasteRes.rows[0];

  return {
    tenantId,
    date: date_label,
    totalSalesPiastres: parseInt(salesRow.total, 10),
    transactionCount: parseInt(salesRow.count, 10),
    topProducts: topProdRes.rows.map((r) => ({
      nameAr: r.name_ar,
      nameFr: r.name_fr,
      revenuePiastres: parseInt(r.revenue, 10),
      quantity: parseInt(r.quantity, 10),
    })),
    totalWastePiastres: parseInt(wasteTotalRes.rows[0]?.total_cost ?? '0', 10),
    topWasteItem: wasteTop?.top_item ?? null,
    lowStockProducts: lowStockRes.rows.map((r) => ({
      nameAr: r.name_ar,
      nameFr: r.name_fr,
      stockQuantity: parseInt(r.stock_quantity, 10),
      threshold: parseInt(r.low_stock_threshold, 10),
    })),
    anomalyFlags: {
      largeDiscountCount: parseInt(anomaly.large_discounts, 10),
      largeReturnCount: parseInt(returnsRes.rows[0]?.large_returns ?? '0', 10),
      voidCount: parseInt(anomaly.voids, 10),
    },
  };
}
