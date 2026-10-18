import type { Pool } from 'pg';

// ── DIMENSION EXTRACTORS ──────────────────────────────────────────────────────
// Dimensions are always full-refresh (all rows, no watermark) because they're
// small and we want the latest state.

export async function extractDimTenants(pg: Pool): Promise<object[]> {
  const { rows } = await pg.query(`
    SELECT
      id::text          AS tenant_id,
      name,
      business_type,
      COALESCE(country, 'MA') AS country,
      status,
      NOW()             AS updated_at
    FROM tenants
    WHERE is_active = true
  `);
  return rows;
}

export async function extractDimProducts(pg: Pool, tenantId: string): Promise<object[]> {
  const { rows } = await pg.query(
    `
    SELECT
      product_id::text,
      tenant_id::text,
      name_ar,
      name_fr,
      COALESCE(category, 'general') AS category,
      ROUND((price_cents::numeric / 100.0), 2) AS price_mad,
      uom,
      is_weighted::int               AS is_weighted,
      COALESCE(is_perishable, false)::int AS is_perishable,
      is_bom::int                    AS is_bom,
      is_active::int                 AS is_active,
      COALESCE(updated_at, NOW())    AS updated_at
    FROM products
    WHERE tenant_id = $1
    `,
    [tenantId],
  );
  return rows;
}

export async function extractDimStores(pg: Pool, tenantId: string): Promise<object[]> {
  const { rows } = await pg.query(
    `
    SELECT
      store_id::text,
      tenant_id::text,
      COALESCE(name_ar, '') AS name_ar,
      COALESCE(name_fr, '') AS name_fr,
      NOW()                 AS updated_at
    FROM stores
    WHERE tenant_id = $1
    `,
    [tenantId],
  );
  return rows;
}

export async function extractDimStaff(pg: Pool, tenantId: string): Promise<object[]> {
  const { rows } = await pg.query(
    `
    SELECT
      staff_id::text,
      tenant_id::text,
      name_ar,
      name_fr,
      role,
      is_active::int AS is_active,
      NOW()          AS updated_at
    FROM staff
    WHERE tenant_id = $1
    `,
    [tenantId],
  );
  return rows;
}

export async function extractDimSuppliers(pg: Pool, tenantId: string): Promise<object[]> {
  const { rows } = await pg.query(
    `
    SELECT
      supplier_id::text,
      tenant_id::text,
      name,
      is_active::int AS is_active,
      NOW()          AS updated_at
    FROM suppliers
    WHERE tenant_id = $1
    `,
    [tenantId],
  );
  return rows;
}

// Lots are incremental (new lots arrive with each purchase order).
export async function extractDimLots(pg: Pool, tenantId: string, since: Date): Promise<object[]> {
  const { rows } = await pg.query(
    `
    SELECT
      lot_id::text,
      tenant_id::text,
      product_id::text,
      supplier_id::text,
      received_at,
      quantity_received::numeric AS quantity_received,
      ROUND(
        (COALESCE(unit_cost_piastres, 0)::numeric / 100.0), 2
      ) AS unit_cost_mad,
      is_active::int AS is_active,
      NOW()          AS updated_at
    FROM product_lots
    WHERE tenant_id = $1
      AND created_at > $2
    `,
    [tenantId, since],
  );
  return rows;
}

// ── FACT EXTRACTORS ───────────────────────────────────────────────────────────

// Transactions: unnest JSONB items array to one row per line item.
// Schema corrections vs spec:
//   - transactions.cashier_id (not staff_id)
//   - join registers → stores for store_id
//   - total_discount_cents (from migration 016)
//   - created_at as event timestamp
export async function extractFactTransactions(
  pg: Pool,
  tenantId: string,
  since: Date,
): Promise<object[]> {
  const { rows } = await pg.query(
    `
    SELECT
      (t.transaction_id::text || '_' || (ordinality - 1)::text) AS row_id,
      t.transaction_id::text,
      t.tenant_id::text,
      r.store_id::text                                  AS store_id,
      t.cashier_id::text                                AS staff_id,
      t.customer_id::text                               AS customer_id,
      (item ->> 'productId')::text                      AS product_id,
      to_char(t.created_at::date, 'YYYY-MM-DD')          AS event_date,
      t.created_at                                      AS event_ts,
      COALESCE((item ->> 'quantity')::numeric, 1)       AS quantity,
      ROUND(
        (COALESCE(
          (item ->> 'unitPricePiastres')::numeric,
          (item ->> 'effectivePriceCents')::numeric,
          0
        ) / 100.0), 2
      )                                                 AS unit_price_mad,
      ROUND(
        (COALESCE((item ->> 'lineTotalPiastres')::numeric, 0) / 100.0), 2
      )                                                 AS line_total_mad,
      ROUND(
        (COALESCE(t.total_discount_cents, 0)::numeric
          / 100.0
          / NULLIF(jsonb_array_length(t.items), 0)),
        2
      )                                                 AS discount_mad,
      ROUND(
        (COALESCE((item ->> 'taxAmountPiastres')::numeric, 0) / 100.0), 2
      )                                                 AS tax_mad,
      ROUND(
        (COALESCE((item ->> 'lineTotalPiastres')::numeric, 0) / 100.0
        - COALESCE(t.total_discount_cents, 0)::numeric
            / 100.0
            / NULLIF(jsonb_array_length(t.items), 0)),
        2
      )                                                 AS net_mad,
      t.payment_method,
      COALESCE(t.receipt_number, '')                    AS receipt_number
    FROM transactions t
    LEFT JOIN registers reg ON reg.register_id = t.register_id
    LEFT JOIN stores r      ON r.store_id = reg.store_id
    CROSS JOIN LATERAL jsonb_array_elements(t.items)
      WITH ORDINALITY AS arr(item, ordinality)
    WHERE t.tenant_id = $1
      AND t.created_at > $2
      AND t.status = 'completed'
      AND t.items IS NOT NULL
      AND jsonb_array_length(t.items) > 0
    `,
    [tenantId, since],
  );
  return rows;
}

// Waste records: use real column names from migrations 005 + 014.
// Schema corrections vs spec:
//   - PK is waste_record_id (not waste_id)
//   - quantity column is weight_grams (not quantity_grams)
//   - reason column is reason_code (not reason or waste_reason)
//   - lot column is ingredient_lot_id (not lot_id)
//   - join registers → stores for store_id (no direct store_id)
export async function extractFactWaste(
  pg: Pool,
  tenantId: string,
  since: Date,
): Promise<object[]> {
  const { rows } = await pg.query(
    `
    SELECT
      w.waste_record_id::text             AS row_id,
      w.waste_record_id::text             AS waste_id,
      w.tenant_id::text,
      r.store_id::text                    AS store_id,
      w.recorded_by::text                 AS staff_id,
      w.product_id::text                  AS product_id,
      w.ingredient_lot_id::text           AS lot_id,
      to_char(w.server_received_at::date, 'YYYY-MM-DD') AS event_date,
      w.server_received_at                AS event_ts,
      ROUND((w.weight_grams::numeric / 1000.0), 3) AS quantity,
      ROUND(
        (COALESCE(p.price_cents, 0)::numeric / 100.0), 2
      )                                   AS unit_cost_mad,
      ROUND(
        ((w.weight_grams::numeric / 1000.0)
          * COALESCE(p.price_cents, 0)::numeric / 100.0),
        2
      )                                   AS total_cost_mad,
      COALESCE(w.reason_code, 'unknown')  AS waste_reason
    FROM waste_records w
    LEFT JOIN products p
      ON p.product_id = w.product_id
    LEFT JOIN registers reg
      ON reg.register_id = w.register_id
    LEFT JOIN stores r
      ON r.store_id = reg.store_id
    WHERE w.tenant_id = $1
      AND w.server_received_at > $2
    `,
    [tenantId, since],
  );
  return rows;
}

export async function extractFactLoyalty(
  pg: Pool,
  tenantId: string,
  since: Date,
): Promise<object[]> {
  const { rows } = await pg.query(
    `
    SELECT
      ls.stamp_id::text,
      ls.stamp_id::text       AS row_id,
      ls.tenant_id::text,
      ls.customer_id::text,
      ls.transaction_id::text AS transaction_id,
      to_char(ls.created_at::date, 'YYYY-MM-DD') AS event_date,
      ls.created_at           AS event_ts,
      ls.stamp_number,
      COALESCE(c.total_visits, 0) AS total_visits
    FROM loyalty_stamps ls
    LEFT JOIN customers c
      ON c.customer_id = ls.customer_id
    WHERE ls.tenant_id = $1
      AND ls.created_at > $2
    `,
    [tenantId, since],
  );
  return rows;
}

// Café orders: one row per order line in a paid café order.
// Money fields come from NUMERIC(10,2) columns (full MAD), not piastres.
// store_id is absent from cafe_orders — always NULL in ClickHouse.
// Watermark uses paid_at (null rows excluded by AND o.paid_at IS NOT NULL).
export async function extractFactCafeOrders(
  pg: Pool,
  tenantId: string,
  since: Date,
): Promise<object[]> {
  const { rows } = await pg.query(
    `
    SELECT
      (o.order_id::text || '_' || l.line_id::text) AS row_id,
      o.order_id::text,
      l.line_id::text,
      o.tenant_id::text,
      NULL::text                             AS store_id,
      o.staff_id::text                       AS staff_id,
      l.product_id::text,
      to_char(o.paid_at::date, 'YYYY-MM-DD') AS event_date,
      o.paid_at                              AS event_ts,
      l.quantity::numeric                    AS quantity,
      l.unit_price                           AS unit_price_mad,
      l.modifier_total                       AS modifier_total_mad,
      l.line_total                           AS line_total_mad,
      o.covers                               AS covers
    FROM cafe_orders o
    JOIN cafe_order_lines l ON l.order_id = o.order_id
    WHERE o.tenant_id = $1
      AND o.paid_at > $2
      AND o.status = 'paid'
      AND o.paid_at IS NOT NULL
    `,
    [tenantId, since],
  );
  return rows;
}
