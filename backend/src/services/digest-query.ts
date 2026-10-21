import type { Pool } from 'pg';

// All money fields are integer cents (the codebase calls them "piastres" in
// places; 100 = 1 MAD). Every optional section degrades to an empty/zero value
// when its table is empty OR missing, so one bad table never blocks the digest.

export interface DigestData {
  tenantId: string;
  date: string; // YYYY-MM-DD, the tenant-local day being reported (yesterday)

  // ── Sales ────────────────────────────────────────────────────────────────
  totalSalesPiastres: number;          // non-voided sales
  transactionCount: number;            // non-voided
  topProducts: Array<{
    nameAr: string;
    nameFr: string;
    revenuePiastres: number;
    quantity: number;
  }>;

  // ── Payment split ──────────────────────────────────────────────────────────
  payments: Array<{ method: string; amountPiastres: number; count: number }>;

  // ── Margin (only lines whose product has a cost) ─────────────────────────────
  margin: {
    grossMarginPiastres: number;
    marginPct: number | null;          // null when no costed revenue
    costCoveragePct: number | null;    // share of revenue that had a cost
  };

  // ── Voids, refunds, discounts ────────────────────────────────────────────────
  voids: { count: number; amountPiastres: number };
  refunds: { count: number; amountPiastres: number };
  discounts: { totalPiastres: number; transactionCount: number };

  // ── Waste ──────────────────────────────────────────────────────────────────
  // cost = weight_grams / 1000 * cost_price_cents (price_cents when cost is null).
  totalWastePiastres: number;
  topWasteItem: string | null;         // Arabic name (kept for compatibility)
  topWasteItemFr: string | null;
  wasteLines: Array<{ nameAr: string; nameFr: string; grams: number; costPiastres: number }>;

  // ── Cash variance per closed shift ───────────────────────────────────────────
  shifts: Array<{
    shiftId: string;
    cashierName: string | null;       // Arabic name stored on the shift
    cashierNameFr: string | null;     // staff.name_fr, when the cashier still exists
    expectedCashPiastres: number | null;
    countedCashPiastres: number | null;
    variancePiastres: number | null;
    closedAt: string | null;
  }>;
  totalCashVariancePiastres: number;

  // ── Anomaly alerts (unacknowledged) ─────────────────────────────────────────
  alerts: {
    unacknowledgedCount: number;
    top: Array<{ alertType: string; severity: string; score: number }>;
  };

  // ── Stock ──────────────────────────────────────────────────────────────────
  lowStockCount: number;
  lowStockProducts: Array<{
    nameAr: string;
    nameFr: string;
    stockQuantity: number;
    threshold: number;
  }>;

  // ── Legacy anomaly counters (still used by the compact message) ──────────────
  anomalyFlags: {
    largeDiscountCount: number;
    largeReturnCount: number;
    voidCount: number;
  };
}

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
  return Number.isFinite(n) ? n : 0;
};

/** Run an optional query; on any error (e.g. table missing) return the fallback. */
async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[digest] optional section "${label}" skipped: ${err instanceof Error ? err.message : 'unknown'}`);
    return fallback;
  }
}

export async function buildDigestData(
  pg: Pool,
  tenantId: string,
  timezone: string,
): Promise<DigestData> {
  // Day boundaries in the tenant's local timezone.
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

  // The day a sale belongs to: sold_at (when it happened on the register),
  // falling back to created_at for rows without it. Offline registers that sync
  // late are therefore reported on the right day.
  const SOLD = 'COALESCE(t.sold_at, t.created_at)';
  const txWindow = `t.tenant_id = $1 AND ${SOLD} >= $2 AND ${SOLD} < $3`;

  // Q1 — Sales, voids, discounts (the core section; errors here are real errors).
  const salesRes = await pg.query<Record<string, string>>(
    `SELECT
       COALESCE(SUM(t.total_amount_cents) FILTER (WHERE t.status <> 'voided'), 0)  AS sales,
       COUNT(*) FILTER (WHERE t.status <> 'voided')                                AS tx_count,
       COALESCE(SUM(t.total_discount_cents) FILTER (WHERE t.status <> 'voided'), 0) AS discounts,
       COUNT(*) FILTER (WHERE t.total_discount_cents > 0 AND t.status <> 'voided') AS discounted_tx,
       COUNT(*) FILTER (WHERE t.status = 'voided')                                 AS void_count,
       COALESCE(SUM(t.total_amount_cents) FILTER (WHERE t.status = 'voided'), 0)   AS void_amount,
       COUNT(*) FILTER (WHERE t.total_discount_cents > $4 AND t.status <> 'voided') AS large_discounts
     FROM transactions t
     WHERE ${txWindow}`,
    [tenantId, day_start, day_end, anomalyThreshold],
  );
  const s = salesRes.rows[0]!;

  // Q2 — Top products by revenue. quantity is numeric (weighted items are decimal).
  const topProducts = await safe('top products', async () => {
    const r = await pg.query<{ name_ar: string; name_fr: string; revenue: string; quantity: string }>(
      `SELECT p.name_ar, p.name_fr,
              SUM(x."lineTotalPiastres") AS revenue,
              SUM(x."quantity")          AS quantity
       FROM transactions t,
         jsonb_to_recordset(t.items)
           AS x("productId" text, "quantity" numeric, "lineTotalPiastres" numeric)
       JOIN products p ON p.product_id::text = x."productId"
       WHERE ${txWindow} AND t.status <> 'voided'
       GROUP BY p.product_id, p.name_ar, p.name_fr
       ORDER BY revenue DESC
       LIMIT 5`,
      [tenantId, day_start, day_end],
    );
    return r.rows.map((row) => ({
      nameAr: row.name_ar,
      nameFr: row.name_fr,
      revenuePiastres: Math.round(num(row.revenue)),
      quantity: num(row.quantity),
    }));
  }, [] as DigestData['topProducts']);

  // Q3 — Payment split: sale_tenders (split-aware); fall back to the
  // transaction-level payment_method for days without tender rows.
  const payments = await safe('payment split', async () => {
    const tenders = await pg.query<{ method: string; amount: string; n: string }>(
      `SELECT st.method,
              SUM(st.amount_piastres) AS amount,
              COUNT(DISTINCT st.transaction_id) AS n
       FROM sale_tenders st
       JOIN transactions t ON t.transaction_id = st.transaction_id
       WHERE ${txWindow} AND t.status <> 'voided'
       GROUP BY st.method
       ORDER BY amount DESC`,
      [tenantId, day_start, day_end],
    );
    if (tenders.rows.length > 0) {
      return tenders.rows.map((r) => ({
        method: r.method, amountPiastres: Math.round(num(r.amount)), count: num(r.n),
      }));
    }
    const legacy = await pg.query<{ method: string; amount: string; n: string }>(
      `SELECT t.payment_method AS method,
              SUM(t.total_amount_cents) AS amount,
              COUNT(*) AS n
       FROM transactions t
       WHERE ${txWindow} AND t.status <> 'voided'
       GROUP BY t.payment_method
       ORDER BY amount DESC`,
      [tenantId, day_start, day_end],
    );
    return legacy.rows.map((r) => ({
      method: r.method, amountPiastres: Math.round(num(r.amount)), count: num(r.n),
    }));
  }, [] as DigestData['payments']);

  // Q4 — Gross margin over lines whose product has a cost (cost_price_cents > 0).
  const margin = await safe('margin', async () => {
    const r = await pg.query<{ revenue_all: string; revenue_costed: string; cost: string }>(
      `SELECT
         COALESCE(SUM(x."lineTotalPiastres"), 0) AS revenue_all,
         COALESCE(SUM(x."lineTotalPiastres") FILTER (WHERE p.cost_price_cents > 0), 0) AS revenue_costed,
         COALESCE(SUM(x."quantity" * p.cost_price_cents) FILTER (WHERE p.cost_price_cents > 0), 0) AS cost
       FROM transactions t
       CROSS JOIN LATERAL jsonb_to_recordset(t.items)
         AS x("productId" text, "quantity" numeric, "lineTotalPiastres" numeric)
       LEFT JOIN products p ON p.product_id::text = x."productId" AND p.tenant_id = t.tenant_id
       WHERE ${txWindow} AND t.status <> 'voided'`,
      [tenantId, day_start, day_end],
    );
    const row = r.rows[0]!;
    const all = num(row.revenue_all);
    const costed = num(row.revenue_costed);
    const cost = num(row.cost);
    return {
      grossMarginPiastres: Math.round(costed - cost),
      marginPct: costed > 0 ? Math.round(((costed - cost) / costed) * 1000) / 10 : null,
      costCoveragePct: all > 0 ? Math.round((costed / all) * 1000) / 10 : null,
    };
  }, { grossMarginPiastres: 0, marginPct: null, costCoveragePct: null } as DigestData['margin']);

  // Q5 — Refunds (pos_returns, by return time).
  const refunds = await safe('refunds', async () => {
    const r = await pg.query<{ n: string; amount: string; large: string }>(
      `SELECT COUNT(*) AS n,
              COALESCE(SUM(total_piastres), 0) AS amount,
              COUNT(*) FILTER (WHERE total_piastres > $4) AS large
       FROM pos_returns
       WHERE tenant_id = $1 AND created_at >= $2 AND created_at < $3`,
      [tenantId, day_start, day_end, anomalyThreshold],
    );
    const row = r.rows[0]!;
    return { count: num(row.n), amountPiastres: num(row.amount), large: num(row.large) };
  }, { count: 0, amountPiastres: 0, large: 0 });

  // Q6 — Waste cost = weight_grams / 1000 * cost (price_cents when no cost).
  const waste = await safe('waste', async () => {
    const r = await pg.query<{ name_ar: string; name_fr: string; grams: string; cost: string }>(
      `SELECT p.name_ar, p.name_fr,
              SUM(wr.weight_grams) AS grams,
              SUM(wr.weight_grams / 1000.0
                  * COALESCE(NULLIF(p.cost_price_cents, 0), p.price_cents, 0)) AS cost
       FROM waste_records wr
       JOIN products p ON p.product_id = wr.product_id
       WHERE wr.tenant_id = $1
         AND wr.server_received_at >= $2
         AND wr.server_received_at < $3
       GROUP BY p.product_id, p.name_ar, p.name_fr
       ORDER BY cost DESC`,
      [tenantId, day_start, day_end],
    );
    const lines = r.rows.map((row) => ({
      nameAr: row.name_ar,
      nameFr: row.name_fr,
      grams: num(row.grams),
      costPiastres: Math.round(num(row.cost)),
    }));
    return {
      total: lines.reduce((sum, l) => sum + l.costPiastres, 0),
      lines: lines.slice(0, 5),
    };
  }, { total: 0, lines: [] as DigestData['wasteLines'] });

  // Q7 — Cash variance per shift closed during the day.
  const shifts = await safe('cash variance', async () => {
    const r = await pg.query<{
      shift_id: string; cashier_name_ar: string | null; cashier_name_fr: string | null;
      expected_cash: number | null; closing_cash_counted: number | null;
      cash_variance: number | null; closed_at: string | null;
    }>(
      `SELECT s.shift_id, s.cashier_name_ar, st.name_fr AS cashier_name_fr,
              s.expected_cash, s.closing_cash_counted, s.cash_variance, s.closed_at
       FROM shifts s
       LEFT JOIN staff st ON st.staff_id = s.cashier_id AND st.tenant_id = s.tenant_id
       WHERE s.tenant_id = $1 AND s.status = 'closed'
         AND s.closed_at >= $2 AND s.closed_at < $3
       ORDER BY ABS(COALESCE(s.cash_variance, 0)) DESC
       LIMIT 10`,
      [tenantId, day_start, day_end],
    );
    return r.rows.map((row) => ({
      shiftId: row.shift_id,
      cashierName: row.cashier_name_ar,
      cashierNameFr: row.cashier_name_fr,
      expectedCashPiastres: row.expected_cash,
      countedCashPiastres: row.closing_cash_counted,
      variancePiastres: row.cash_variance,
      closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
    }));
  }, [] as DigestData['shifts']);

  // Q8 — Unacknowledged anomaly alerts (all-time open items) and the top 3.
  const alerts = await safe('anomaly alerts', async () => {
    const count = await pg.query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM anomaly_alerts WHERE tenant_id = $1 AND acknowledged = false`,
      [tenantId],
    );
    const top = await pg.query<{ alert_type: string; severity: string; score: string }>(
      `SELECT alert_type, severity, score
       FROM anomaly_alerts
       WHERE tenant_id = $1 AND acknowledged = false
       ORDER BY CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3
                              WHEN 'medium' THEN 2 ELSE 1 END DESC,
                score DESC, created_at DESC
       LIMIT 3`,
      [tenantId],
    );
    return {
      unacknowledgedCount: num(count.rows[0]?.n),
      top: top.rows.map((r) => ({ alertType: r.alert_type, severity: r.severity, score: num(r.score) })),
    };
  }, { unacknowledgedCount: 0, top: [] } as DigestData['alerts']);

  // Q9 — Low stock: stock_quantity <= low_stock_threshold on tracked, active products.
  const lowStock = await safe('low stock', async () => {
    const total = await pg.query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM products
       WHERE tenant_id = $1 AND track_stock = true AND is_active = true
         AND stock_quantity <= low_stock_threshold`,
      [tenantId],
    );
    const list = await pg.query<{
      name_ar: string; name_fr: string; stock_quantity: string; low_stock_threshold: string;
    }>(
      `SELECT name_ar, name_fr, stock_quantity, low_stock_threshold
       FROM products
       WHERE tenant_id = $1 AND track_stock = true AND is_active = true
         AND stock_quantity <= low_stock_threshold
       ORDER BY stock_quantity ASC
       LIMIT 10`,
      [tenantId],
    );
    return {
      count: num(total.rows[0]?.n),
      products: list.rows.map((r) => ({
        nameAr: r.name_ar,
        nameFr: r.name_fr,
        stockQuantity: num(r.stock_quantity),
        threshold: num(r.low_stock_threshold),
      })),
    };
  }, { count: 0, products: [] as DigestData['lowStockProducts'] });

  return {
    tenantId,
    date: date_label,
    totalSalesPiastres: Math.round(num(s['sales'])),
    transactionCount: num(s['tx_count']),
    topProducts,
    payments,
    margin,
    voids: { count: num(s['void_count']), amountPiastres: Math.round(num(s['void_amount'])) },
    refunds: { count: refunds.count, amountPiastres: refunds.amountPiastres },
    discounts: { totalPiastres: Math.round(num(s['discounts'])), transactionCount: num(s['discounted_tx']) },
    totalWastePiastres: waste.total,
    topWasteItem: waste.lines[0]?.nameAr ?? null,
    topWasteItemFr: waste.lines[0]?.nameFr ?? null,
    wasteLines: waste.lines,
    shifts,
    totalCashVariancePiastres: shifts.reduce((sum, sh) => sum + (sh.variancePiastres ?? 0), 0),
    alerts,
    lowStockCount: lowStock.count,
    lowStockProducts: lowStock.products,
    anomalyFlags: {
      largeDiscountCount: num(s['large_discounts']),
      largeReturnCount: refunds.large,
      voidCount: num(s['void_count']),
    },
  };
}
