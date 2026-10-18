import type { FastifyInstance } from 'fastify';
import { getClickHouseClient, pingClickHouse } from '../../services/analytics/clickhouse-client.js';
import { runTool } from '../../services/mcp/analytics-server.js';
import { askAssistant } from '../../services/mcp/analytics-assistant.js';
import { buildCashFlowReport } from '../../services/analytics/cashflow-predictor.js';

const ANALYTICS_ROLES = ['MANAGER', 'SUPERVISOR', 'OWNER'] as const;

type WatermarkRow = {
  table_name: string;
  last_synced_at: Date | null;
  last_run_at: Date | null;
  rows_synced: string;
  last_error: string | null;
};

type ChCountRow = { count: string };

export async function analyticsChRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /analytics/ch/status ─────────────────────────────────────────────
  // Returns ClickHouse connectivity + row counts per table + last sync timestamps.
  fastify.get(
    '/analytics/ch/status',
    { config: { allowedRoles: ANALYTICS_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId;
      if (!tenantId) {
        return reply.status(400).send({ error: 'tenantId missing from token' });
      }

      const chAlive = await pingClickHouse();

      // Watermarks from PostgreSQL
      const { rows: watermarks } = await fastify.pg.query<WatermarkRow>(
        `SELECT table_name, last_synced_at, last_run_at,
                rows_synced::text, last_error
         FROM etl_watermarks
         WHERE tenant_id = $1
         ORDER BY table_name`,
        [tenantId],
      );

      // Row counts from ClickHouse (only when reachable)
      const chCounts: Record<string, number> = {};
      if (chAlive) {
        const tables = [
          'fact_transactions',
          'fact_waste_records',
          'fact_loyalty_events',
          'dim_products',
          'dim_stores',
          'dim_staff',
          'dim_suppliers',
          'dim_lots',
        ];
        const client = getClickHouseClient();
        for (const table of tables) {
          try {
            const result = await client.query({
              query: `SELECT count() AS count FROM ${table}
                      WHERE tenant_id = {tenantId: String}`,
              query_params: { tenantId },
              format: 'JSONEachRow',
            });
            const data = await result.json<ChCountRow>();
            chCounts[table] = parseInt(data[0]?.count ?? '0', 10);
          } catch {
            chCounts[table] = -1;
          }
        }
      }

      return reply.send({
        clickhouse: chAlive,
        tables: chCounts,
        watermarks: watermarks.map((w) => ({
          table: w.table_name,
          lastSyncedAt: w.last_synced_at,
          lastRunAt: w.last_run_at,
          rowsSynced: parseInt(w.rows_synced, 10),
          lastError: w.last_error,
        })),
      });
    },
  );

  // ── GET /analytics/ch/product-day ────────────────────────────────────────
  // Top products by revenue for a date range, from agg_product_day.
  // Query params: startDate? (YYYY-MM-DD), endDate? (YYYY-MM-DD), limit? (default 20)
  fastify.get<{ Querystring: { startDate?: string; endDate?: string; limit?: string } }>(
    '/analytics/ch/product-day',
    { config: { allowedRoles: ANALYTICS_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const chAlive = await pingClickHouse();
      if (!chAlive) return reply.status(503).send({ error: 'ClickHouse unavailable' });

      const endDate   = request.query.endDate   ?? new Date().toISOString().slice(0, 10);
      const startDate = request.query.startDate ?? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const limit     = Math.min(parseInt(request.query.limit ?? '20', 10), 100);

      try {
        const client = getClickHouseClient();
        const result = await client.query({
          query: `
            SELECT product_id,
                   sum(total_qty) AS total_qty,
                   sum(total_mad) AS total_mad,
                   sum(txn_count) AS txn_count
            FROM agg_product_day FINAL
            WHERE tenant_id  = {tenantId: String}
              AND event_date >= {startDate: Date}
              AND event_date <= {endDate: Date}
            GROUP BY product_id
            ORDER BY total_mad DESC
            LIMIT {limit: UInt32}
          `,
          query_params: { tenantId, startDate, endDate, limit },
          format: 'JSONEachRow',
        });

        type ProductRow = {
          product_id: string;
          total_qty: string;
          total_mad: string;
          txn_count: string;
        };

        const data = await result.json<ProductRow>();
        return reply.send({
          startDate,
          endDate,
          products: data.map((r) => ({
            productId: r.product_id,
            totalQty:  parseFloat(r.total_qty),
            totalMad:  parseFloat(r.total_mad),
            txnCount:  parseInt(r.txn_count, 10),
          })),
        });
      } catch (err: unknown) {
        request.log.error({ err }, 'analytics/ch/product-day: query failed');
        return reply.status(500).send({ error: 'Query failed' });
      }
    },
  );

  // ── GET /analytics/ch/peak-hours ─────────────────────────────────────────
  // Hourly sales heatmap across a date range, from agg_hour.
  // Query params: startDate? (YYYY-MM-DD), endDate? (YYYY-MM-DD)
  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    '/analytics/ch/peak-hours',
    { config: { allowedRoles: ANALYTICS_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const chAlive = await pingClickHouse();
      if (!chAlive) return reply.status(503).send({ error: 'ClickHouse unavailable' });

      const endDate   = request.query.endDate   ?? new Date().toISOString().slice(0, 10);
      const startDate = request.query.startDate ?? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

      try {
        const client = getClickHouseClient();
        const result = await client.query({
          query: `
            SELECT hour,
                   sum(total_mad) AS total_mad,
                   sum(txn_count) AS txn_count
            FROM agg_hour FINAL
            WHERE tenant_id  = {tenantId: String}
              AND event_date >= {startDate: Date}
              AND event_date <= {endDate: Date}
            GROUP BY hour
            ORDER BY hour ASC
          `,
          query_params: { tenantId, startDate, endDate },
          format: 'JSONEachRow',
        });

        type HourRow = { hour: string; total_mad: string; txn_count: string };

        const data = await result.json<HourRow>();
        return reply.send({
          startDate,
          endDate,
          hours: data.map((r) => ({
            hour:     parseInt(r.hour, 10),
            totalMad: parseFloat(r.total_mad),
            txnCount: parseInt(r.txn_count, 10),
          })),
        });
      } catch (err: unknown) {
        request.log.error({ err }, 'analytics/ch/peak-hours: query failed');
        return reply.status(500).send({ error: 'Query failed' });
      }
    },
  );

  // ── GET /analytics/ch/cashier-day ────────────────────────────────────────
  // Daily cashier performance for a date range, from agg_cashier_day.
  // Query params: startDate? (YYYY-MM-DD), endDate? (YYYY-MM-DD)
  fastify.get<{ Querystring: { startDate?: string; endDate?: string } }>(
    '/analytics/ch/cashier-day',
    { config: { allowedRoles: ANALYTICS_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const chAlive = await pingClickHouse();
      if (!chAlive) return reply.status(503).send({ error: 'ClickHouse unavailable' });

      const endDate   = request.query.endDate   ?? new Date().toISOString().slice(0, 10);
      const startDate = request.query.startDate ?? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

      try {
        const client = getClickHouseClient();
        const result = await client.query({
          query: `
            SELECT staff_id,
                   event_date,
                   sum(total_mad)   AS total_mad,
                   sum(txn_count)   AS txn_count,
                   sum(items_count) AS items_count
            FROM agg_cashier_day FINAL
            WHERE tenant_id  = {tenantId: String}
              AND event_date >= {startDate: Date}
              AND event_date <= {endDate: Date}
            GROUP BY staff_id, event_date
            ORDER BY event_date DESC, total_mad DESC
          `,
          query_params: { tenantId, startDate, endDate },
          format: 'JSONEachRow',
        });

        type CashierRow = {
          staff_id: string;
          event_date: string;
          total_mad: string;
          txn_count: string;
          items_count: string;
        };

        const data = await result.json<CashierRow>();
        return reply.send({
          startDate,
          endDate,
          cashiers: data.map((r) => ({
            staffId:    r.staff_id,
            date:       r.event_date,
            totalMad:   parseFloat(r.total_mad),
            txnCount:   parseInt(r.txn_count, 10),
            itemsCount: parseInt(r.items_count, 10),
          })),
        });
      } catch (err: unknown) {
        request.log.error({ err }, 'analytics/ch/cashier-day: query failed');
        return reply.status(500).send({ error: 'Query failed' });
      }
    },
  );

  // ── GET /analytics/alerts ────────────────────────────────────────────────
  // Returns unacknowledged (or all) anomaly alerts for the caller's tenant.
  fastify.get<{
    Querystring: { shift_id?: string; acknowledged?: string };
  }>(
    '/analytics/alerts',
    { config: { allowedRoles: ANALYTICS_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId ?? request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const shiftId     = request.query.shift_id;
      const showAckStr  = request.query.acknowledged;
      const showAck     = showAckStr === 'true';

      type AlertRow = {
        alert_id:       string;
        shift_id:       string | null;
        cashier_id:     string | null;
        alert_type:     string;
        severity:       string;
        score:          string;
        details:        Record<string, unknown>;
        reference_id:   string | null;
        acknowledged:   boolean;
        created_at:     string;
      };

      const params: unknown[] = [tenantId];
      let where = `WHERE tenant_id = $1`;
      if (!showAck) {
        where += ` AND acknowledged = false`;
      }
      if (shiftId) {
        params.push(shiftId);
        where += ` AND shift_id = $${params.length}`;
      }

      const { rows } = await fastify.pg.query<AlertRow>(
        `SELECT alert_id, shift_id, cashier_id, alert_type,
                severity, score::text AS score, details,
                reference_id, acknowledged,
                created_at::text AS created_at
         FROM anomaly_alerts
         ${where}
         ORDER BY created_at DESC
         LIMIT 50`,
        params,
      );

      return reply.send(
        rows.map((r) => ({
          alert_id:     r.alert_id,
          shift_id:     r.shift_id,
          cashier_id:   r.cashier_id,
          alert_type:   r.alert_type,
          severity:     r.severity,
          score:        parseFloat(r.score),
          details:      r.details,
          reference_id: r.reference_id,
          acknowledged: r.acknowledged,
          created_at:   r.created_at,
        })),
      );
    },
  );

  // ── GET /analytics/forecasts ─────────────────────────────────────────────
  // Returns 7-day demand forecasts for the caller's tenant.
  // Query params: store_id? (UUID), product_id? (UUID), days? (1-30, default 7)
  fastify.get<{
    Querystring: { store_id?: string; product_id?: string; days?: string };
  }>(
    '/analytics/forecasts',
    { config: { allowedRoles: ANALYTICS_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId ?? request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const storeId   = request.query.store_id;
      const productId = request.query.product_id;
      const days      = Math.min(30, Math.max(1, parseInt(request.query.days ?? '7', 10)));

      type ForecastRow = {
        forecast_id:   string;
        product_id:    string;
        store_id:      string | null;
        forecast_date: string;
        qty_predicted: string;
        qty_lower:     string;
        qty_upper:     string;
        reorder_point: string;
        model_version: string;
        created_at:    string;
      };

      const params: unknown[] = [tenantId, days];
      let where = `WHERE df.tenant_id = $1 AND df.forecast_date >= CURRENT_DATE AND df.forecast_date < CURRENT_DATE + ($2 || ' days')::interval`;

      if (storeId) {
        params.push(storeId);
        where += ` AND df.store_id = $${params.length}`;
      }
      if (productId) {
        params.push(productId);
        where += ` AND df.product_id = $${params.length}`;
      }

      const { rows } = await fastify.pg.query<ForecastRow>(
        `SELECT df.forecast_id::text,
                df.product_id::text,
                df.store_id::text,
                df.forecast_date::text,
                df.qty_predicted::text,
                df.qty_lower::text,
                df.qty_upper::text,
                df.reorder_point::text,
                df.model_version,
                df.created_at::text
         FROM demand_forecasts df
         ${where}
         ORDER BY df.forecast_date ASC, df.qty_predicted DESC
         LIMIT 500`,
        params,
      );

      return reply.send({
        days,
        forecasts: rows.map((r) => ({
          forecastId:   r.forecast_id,
          productId:    r.product_id,
          storeId:      r.store_id,
          forecastDate: r.forecast_date,
          qtyPredicted: parseFloat(r.qty_predicted),
          qtyLower:     parseFloat(r.qty_lower),
          qtyUpper:     parseFloat(r.qty_upper),
          reorderPoint: parseFloat(r.reorder_point),
          modelVersion: r.model_version,
          createdAt:    r.created_at,
        })),
      });
    },
  );

  // ── GET /analytics/reorder-alerts ─────────────────────────────────────────
  // Returns products where current on-hand stock is below the 7-day reorder point.
  fastify.get(
    '/analytics/reorder-alerts',
    { config: { allowedRoles: ANALYTICS_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId ?? request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      type ReorderRow = {
        product_id:    string;
        store_id:      string | null;
        name_ar:       string;
        name_fr:       string;
        on_hand:       string;
        reorder_point: string;
        qty_predicted: string;
        forecast_date: string;
      };

      try {
        const { rows } = await fastify.pg.query<ReorderRow>(
          `SELECT
             df.product_id::text,
             df.store_id::text,
             p.name_ar,
             p.name_fr,
             p.stock_quantity::text AS on_hand,
             df.reorder_point::text,
             df.qty_predicted::text,
             df.forecast_date::text
           FROM demand_forecasts df
           JOIN products p
             ON p.product_id = df.product_id
            AND p.tenant_id  = df.tenant_id
            AND p.is_active  = true
           WHERE df.tenant_id     = $1
             AND df.forecast_date = CURRENT_DATE
             AND p.stock_quantity < df.reorder_point
           ORDER BY (df.reorder_point - p.stock_quantity) DESC
           LIMIT 50`,
          [tenantId],
        );

        return reply.send({
          alerts: rows.map((r) => ({
            productId:    r.product_id,
            storeId:      r.store_id,
            nameAr:       r.name_ar,
            nameFr:       r.name_fr,
            onHand:       parseFloat(r.on_hand),
            reorderPoint: parseFloat(r.reorder_point),
            qtyPredicted: parseFloat(r.qty_predicted),
            forecastDate: r.forecast_date,
            deficit:      parseFloat(r.reorder_point) - parseFloat(r.on_hand),
          })),
        });
      } catch (err) {
        console.error('[reorder-alerts]', err);
        return reply.status(500).send({
          error: String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    },
  );

  // ── PATCH /analytics/alerts/:id/acknowledge ───────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    '/analytics/alerts/:id/acknowledge',
    { config: { allowedRoles: ANALYTICS_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId ?? request.auth?.tenant_id;
      const staffId  = request.auth?.staff_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const { id } = request.params;

      const { rowCount } = await fastify.pg.query(
        `UPDATE anomaly_alerts
         SET acknowledged    = true,
             acknowledged_by = $1,
             acknowledged_at = now()
         WHERE alert_id  = $2
           AND tenant_id = $3
           AND acknowledged = false`,
        [staffId ?? null, id, tenantId],
      );

      if (rowCount === 0) {
        return reply.status(404).send({ error: 'Alert not found or already acknowledged' });
      }
      return reply.send({ acknowledged: true, alert_id: id });
    },
  );

  // ── GET /analytics/ch/daily-summary ──────────────────────────────────────
  // Returns a daily sales summary from ClickHouse.
  // Smoke test that proves the full pipeline works end to end.
  fastify.get<{ Querystring: { date?: string } }>(
    '/analytics/ch/daily-summary',
    { config: { allowedRoles: ANALYTICS_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId;
      if (!tenantId) {
        return reply.status(400).send({ error: 'tenantId missing from token' });
      }

      const chAlive = await pingClickHouse();
      if (!chAlive) {
        return reply.status(503).send({ error: 'ClickHouse unavailable' });
      }

      // Default to yesterday
      const targetDate =
        request.query.date ??
        new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      try {
        const client = getClickHouseClient();
        const result = await client.query({
          query: `
            SELECT
              event_date,
              count()                          AS transaction_line_count,
              sum(line_total_mad)              AS total_sales_mad,
              sum(discount_mad)                AS total_discount_mad,
              countDistinct(transaction_id)    AS unique_txns
            FROM fact_transactions
            WHERE tenant_id = {tenantId: String}
              AND event_date = {date: Date}
          `,
          query_params: { tenantId, date: targetDate },
          format: 'JSONEachRow',
        });

        type SummaryRow = {
          event_date: string;
          transaction_line_count: string;
          total_sales_mad: string;
          total_discount_mad: string;
          unique_txns: string;
        };

        const data = await result.json<SummaryRow>();
        const row = data[0];

        return reply.send({
          date: targetDate,
          transactionCount: parseInt(row?.unique_txns ?? '0', 10),
          lineCount: parseInt(row?.transaction_line_count ?? '0', 10),
          totalSalesMad: parseFloat(row?.total_sales_mad ?? '0'),
          totalDiscountMad: parseFloat(row?.total_discount_mad ?? '0'),
        });
      } catch (err: unknown) {
        request.log.error({ err }, 'analytics/ch/daily-summary: ClickHouse query failed');
        return reply.status(500).send({ error: 'Query failed' });
      }
    },
  );

  // ── GET /analytics/customer-segments ─────────────────────────────────────
  // Returns RFM segments for the caller's tenant.
  // Query params: segment? (text), min_risk? (int, default 0)
  fastify.get<{
    Querystring: { segment?: string; min_risk?: string };
  }>(
    '/analytics/customer-segments',
    { config: { allowedRoles: ANALYTICS_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId ?? request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const segment = request.query.segment ?? null;
      const minRisk = parseInt(request.query.min_risk ?? '0', 10);

      type SegmentRow = {
        segment_id:              string;
        customer_id:             string;
        recency_score:           number;
        frequency_score:         number;
        monetary_score:          number;
        rfm_total:               number;
        segment:                 string;
        days_since_last_purchase: number | null;
        purchase_count:          number;
        total_spent_mad:         string;
        avg_basket_mad:          string;
        credit_utilization:      string | null;
        risk_score:              number;
        last_computed:           string;
        name_ar:                 string | null;
        phone:                   string | null;
        balance:                 string;
        credit_limit:            string;
      };

      const params: unknown[] = [tenantId, minRisk];
      let where = `WHERE cs.tenant_id = $1 AND cs.risk_score >= $2`;
      if (segment) {
        params.push(segment);
        where += ` AND cs.segment = $${params.length}`;
      }

      const { rows } = await fastify.pg.query<SegmentRow>(
        `SELECT cs.segment_id::text,
                cs.customer_id::text,
                cs.recency_score, cs.frequency_score,
                cs.monetary_score, cs.rfm_total,
                cs.segment,
                cs.days_since_last_purchase,
                cs.purchase_count,
                cs.total_spent_mad::text,
                cs.avg_basket_mad::text,
                cs.credit_utilization::text,
                cs.risk_score,
                cs.last_computed::text,
                c.name_ar,
                c.phone,
                c.balance::text,
                c.credit_limit::text
         FROM customer_segments cs
         JOIN customers c
           ON c.customer_id = cs.customer_id
         ${where}
         ORDER BY cs.risk_score DESC, cs.rfm_total DESC
         LIMIT 100`,
        params,
      );

      return reply.send({
        segments: rows.map((r) => ({
          segmentId:             r.segment_id,
          customerId:            r.customer_id,
          recencyScore:          r.recency_score,
          frequencyScore:        r.frequency_score,
          monetaryScore:         r.monetary_score,
          rfmTotal:              r.rfm_total,
          segment:               r.segment,
          daysSinceLastPurchase: r.days_since_last_purchase,
          purchaseCount:         r.purchase_count,
          totalSpentMad:         parseFloat(r.total_spent_mad),
          avgBasketMad:          parseFloat(r.avg_basket_mad),
          creditUtilization:     r.credit_utilization ? parseFloat(r.credit_utilization) : null,
          riskScore:             r.risk_score,
          lastComputed:          r.last_computed,
          nameAr:                r.name_ar,
          phone:                 r.phone,
          balance:               parseFloat(r.balance),
          creditLimit:           parseFloat(r.credit_limit),
        })),
      });
    },
  );

  // ── GET /analytics/customer-suggestions ──────────────────────────────────
  // Returns unacted suggestions ordered by priority.
  // Auth: CASHIER and above (all roles).
  fastify.get(
    '/analytics/customer-suggestions',
    async (request, reply) => {
      const tenantId = request.tenantId ?? request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      type SuggestionRow = {
        suggestion_id:   string;
        customer_id:     string;
        suggestion_type: string;
        priority:        number;
        details:         Record<string, unknown>;
        shown_at:        string | null;
        expires_at:      string | null;
        created_at:      string;
        name_ar:         string | null;
      };

      const { rows } = await fastify.pg.query<SuggestionRow>(
        `SELECT s.suggestion_id::text,
                s.customer_id::text,
                s.suggestion_type,
                s.priority,
                s.details,
                s.shown_at::text,
                s.expires_at::text,
                s.created_at::text,
                c.name_ar
         FROM customer_suggestions s
         JOIN customers c
           ON c.customer_id = s.customer_id
         WHERE s.tenant_id  = $1
           AND s.acted_on   = false
           AND (s.expires_at IS NULL OR s.expires_at > now())
         ORDER BY s.priority DESC
         LIMIT 20`,
        [tenantId],
      );

      return reply.send({
        suggestions: rows.map((r) => ({
          suggestionId:   r.suggestion_id,
          customerId:     r.customer_id,
          suggestionType: r.suggestion_type,
          priority:       r.priority,
          details:        r.details,
          shownAt:        r.shown_at,
          expiresAt:      r.expires_at,
          createdAt:      r.created_at,
          nameAr:         r.name_ar,
        })),
      });
    },
  );

  // ── POST /analytics/customer-suggestions/:id/act ──────────────────────────
  // Marks a suggestion as acted on.
  // Auth: CASHIER and above (all roles).
  fastify.post<{ Params: { id: string } }>(
    '/analytics/customer-suggestions/:id/act',
    async (request, reply) => {
      const tenantId = request.tenantId ?? request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const { id } = request.params;

      const { rowCount } = await fastify.pg.query(
        `UPDATE customer_suggestions
         SET acted_on = true,
             shown_at = COALESCE(shown_at, now())
         WHERE suggestion_id = $1
           AND tenant_id     = $2
           AND acted_on      = false`,
        [id, tenantId],
      );

      if (rowCount === 0) {
        return reply.status(404).send({ error: 'Suggestion not found or already acted on' });
      }
      return reply.send({ acted_on: true, suggestion_id: id });
    },
  );

  // ── GET /analytics/cashflow ──────────────────────────────────────────────
  // 30-day cash flow forecast: daily inflows, supplier obligations, running balance.
  // Auth: MANAGER/SUPERVISOR/OWNER
  // Query param: days (default 30, max 90)
  fastify.get<{ Querystring: { days?: string } }>(
    '/analytics/cashflow',
    { config: { allowedRoles: ANALYTICS_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId ?? request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const horizonDays = Math.min(
        90,
        Math.max(1, parseInt(request.query.days ?? '30', 10))
      );

      try {
        const report = await buildCashFlowReport(
          tenantId,
          fastify.pg,
          horizonDays,
        );
        return reply.send(report);
      } catch (err: unknown) {
        console.error('[cashflow]', err);
        request.log.error({ err }, 'analytics/cashflow: query failed');
        return reply.status(500).send({ error: 'cashflow_failed' });
      }
    },
    // 15-second handler timeout
  );

  // ── POST /analytics/assistant ─────────────────────────────────────────────
  // Natural language analytics assistant powered by Claude (or Ollama).
  // Auth: MANAGER/SUPERVISOR/OWNER
  fastify.post<{
    Body: { question: string; history?: Array<{ role: 'user' | 'assistant'; content: string }>; lang?: string };
  }>(
    '/analytics/assistant',
    { config: { allowedRoles: ANALYTICS_ROLES } },
    async (request, reply) => {
      const tenantId = request.tenantId ?? request.auth?.tenant_id;
      if (!tenantId) return reply.status(400).send({ error: 'tenantId missing from token' });

      const { question, history = [], lang } = request.body;
      const answerLang = lang === 'ar' || lang === 'fr' || lang === 'en' ? lang : undefined;

      if (!question?.trim()) {
        return reply.status(400).send({ error: 'question required' });
      }
      if (question.length > 500) {
        return reply.status(400).send({ error: 'question too long (max 500)' });
      }

      try {
        const answer = await askAssistant({
          question: question.trim(),
          history:  history.slice(-6),
          lang:     answerLang,
          toolRunner: (name, args) =>
            runTool({ tenantId, pool: fastify.pg }, name, args),
        });

        return reply.send({ answer });
      } catch (err) {
        console.error('[assistant]', err);
        return reply.status(500).send({
          error: String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
      }
    },
  );
}
