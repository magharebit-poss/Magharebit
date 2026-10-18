/**
 * MAGHAREBIT MCP Analytics Server
 *
 * Exposes safe, read-only analytics tools
 * to any MCP-compatible AI model.
 * Tenant ID is always injected server-side.
 * The model cannot query arbitrary SQL.
 * All results are capped at 50 rows.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

export interface MCPAnalyticsOptions {
  tenantId: string;
  pool: {
    query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
  };
}

export function createAnalyticsServer(opts: MCPAnalyticsOptions) {
  const server = new Server(
    { name: 'magharebit-analytics', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'top_products',
        description:
          'Returns the top-selling products by revenue or quantity for a given period. ' +
          'Use this when asked about best-sellers, popular items, or product ranking.',
        inputSchema: {
          type: 'object',
          properties: {
            days:   { type: 'integer', description: 'Number of past days to analyse (default 7, max 90)' },
            limit:  { type: 'integer', description: 'Number of products to return (default 10, max 50)' },
            metric: { type: 'string', enum: ['revenue', 'quantity'], description: 'Sort by revenue or qty sold' },
          },
        },
      },
      {
        name: 'sales_by_hour',
        description:
          'Returns revenue and transaction count grouped by hour of day. ' +
          'Use to identify peak hours, quiet periods, or staffing needs.',
        inputSchema: {
          type: 'object',
          properties: {
            days: { type: 'integer', description: 'Past days to average over (default 7, max 30)' },
          },
        },
      },
      {
        name: 'cashier_performance',
        description:
          'Returns per-cashier statistics: transaction count, revenue, void rate, discount rate. ' +
          'Use when asked about staff performance or anomalies.',
        inputSchema: {
          type: 'object',
          properties: {
            days: { type: 'integer', description: 'Past days (default 30)' },
          },
        },
      },
      {
        name: 'overdue_credit',
        description:
          'Returns customers whose credit balance is above a threshold. ' +
          'Use when asked about unpaid accounts, credit risk, or customers owing money.',
        inputSchema: {
          type: 'object',
          properties: {
            min_balance_mad: { type: 'number', description: 'Minimum balance in MAD (default 0)' },
            limit:           { type: 'integer', description: 'Max results (default 20)' },
          },
        },
      },
      {
        name: 'daily_summary',
        description:
          'Returns daily sales totals for a period: revenue, tx count, average basket, waste cost. ' +
          'Use for trend questions or comparing specific dates.',
        inputSchema: {
          type: 'object',
          properties: {
            days: { type: 'integer', description: 'Past days (default 14, max 90)' },
          },
        },
      },
      {
        name: 'reorder_alerts',
        description:
          'Returns products whose current stock is below the forecasted reorder point. ' +
          'Use when asked about stock levels, what to order, or inventory shortages.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'anomaly_alerts',
        description:
          'Returns recent unacknowledged anomaly alerts: voids, unusual discounts, cash discrepancies. ' +
          'Use when asked about suspicious activity or shift problems.',
        inputSchema: {
          type: 'object',
          properties: {
            hours: { type: 'integer', description: 'Look back N hours (default 24)' },
          },
        },
      },
      {
        name: 'waste_summary',
        description:
          'Returns waste/loss records grouped by product and reason. ' +
          'Use when asked about shrinkage, spoilage, or loss.',
        inputSchema: {
          type: 'object',
          properties: {
            days: { type: 'integer', description: 'Past days (default 30)' },
          },
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const tid = opts.tenantId;
    const a = (args ?? {}) as Record<string, unknown>;

    try {
      let rows: unknown[] = [];

      if (name === 'top_products') {
        const days  = Math.min(parseInt(String(a.days ?? 7)), 90);
        const limit = Math.min(parseInt(String(a.limit ?? 10)), 50);
        const byQty = a.metric === 'quantity';
        const r = await opts.pool.query(
          `SELECT
             item->>'productId'  AS product_id,
             item->>'nameAr'     AS name_ar,
             SUM((item->>'quantity')::numeric)           AS qty,
             SUM((item->>'lineTotalCents')::numeric) / 100.0 AS revenue_mad
           FROM transactions tr,
             jsonb_array_elements(tr.items) item
           WHERE tr.tenant_id = $1
             AND tr.status    = 'completed'
             AND tr.sold_at   > now() - ($2 || ' days')::interval
           GROUP BY item->>'productId', item->>'nameAr'
           ORDER BY ${byQty ? 'qty' : 'revenue_mad'} DESC
           LIMIT $3`,
          [tid, days, limit],
        );
        rows = r.rows;

      } else if (name === 'sales_by_hour') {
        const days = Math.min(parseInt(String(a.days ?? 7)), 30);
        const r = await opts.pool.query(
          `SELECT
             EXTRACT(HOUR FROM sold_at)      AS hour,
             ROUND(AVG(daily_rev), 2)        AS avg_revenue_mad,
             ROUND(AVG(daily_tx)::numeric, 1) AS avg_tx_count
           FROM (
             SELECT
               DATE_TRUNC('day', sold_at)     AS day,
               EXTRACT(HOUR FROM sold_at)     AS hour,
               SUM(total_amount_cents) / 100.0 AS daily_rev,
               COUNT(*)                       AS daily_tx
             FROM transactions
             WHERE tenant_id = $1
               AND status    = 'completed'
               AND sold_at   > now() - ($2 || ' days')::interval
             GROUP BY day, EXTRACT(HOUR FROM sold_at)
           ) sub
           GROUP BY EXTRACT(HOUR FROM sold_at)
           ORDER BY hour`,
          [tid, days],
        );
        rows = r.rows;

      } else if (name === 'cashier_performance') {
        const days = Math.min(parseInt(String(a.days ?? 30)), 90);
        const r = await opts.pool.query(
          `SELECT
             st.name_ar                                          AS cashier,
             COUNT(t.transaction_id)                            AS tx_count,
             ROUND(SUM(t.total_amount_cents) / 100.0, 2)       AS revenue_mad,
             ROUND(
               100.0 * COUNT(t.transaction_id) FILTER (WHERE t.status = 'voided')
               / NULLIF(COUNT(t.transaction_id), 0),
             2)                                                 AS void_rate_pct
           FROM transactions t
           JOIN shifts s  ON s.shift_id  = t.shift_id
           JOIN staff  st ON st.staff_id = s.cashier_id
           WHERE t.tenant_id = $1
             AND t.sold_at   > now() - ($2 || ' days')::interval
           GROUP BY st.staff_id, st.name_ar
           ORDER BY revenue_mad DESC`,
          [tid, days],
        );
        rows = r.rows;

      } else if (name === 'overdue_credit') {
        const minBal = parseFloat(String(a.min_balance_mad ?? 0));
        const limit  = Math.min(parseInt(String(a.limit ?? 20)), 50);
        const r = await opts.pool.query(
          `SELECT
             name_ar, name_fr, phone, balance, credit_limit,
             ROUND(balance / NULLIF(credit_limit, 0) * 100, 1) AS utilization_pct
           FROM customers
           WHERE tenant_id = $1
             AND balance   >= $2
           ORDER BY balance DESC
           LIMIT $3`,
          [tid, minBal, limit],
        );
        rows = r.rows;

      } else if (name === 'daily_summary') {
        const days = Math.min(parseInt(String(a.days ?? 14)), 90);
        const r = await opts.pool.query(
          `SELECT
             DATE(sold_at)                              AS date,
             COUNT(transaction_id)                      AS tx_count,
             ROUND(SUM(total_amount_cents) / 100.0, 2) AS revenue_mad,
             ROUND(AVG(total_amount_cents) / 100.0, 2) AS avg_basket_mad
           FROM transactions
           WHERE tenant_id = $1
             AND status    = 'completed'
             AND sold_at   > now() - ($2 || ' days')::interval
           GROUP BY DATE(sold_at)
           ORDER BY date DESC`,
          [tid, days],
        );
        rows = r.rows;

      } else if (name === 'reorder_alerts') {
        const r = await opts.pool.query(
          `SELECT
             p.name_ar,
             p.stock_quantity,
             p.stock_unit,
             MAX(f.reorder_point) AS reorder_point,
             SUM(f.qty_predicted) AS demand_3d
           FROM demand_forecasts f
           JOIN products p
             ON p.product_id = f.product_id
            AND p.tenant_id  = f.tenant_id
           WHERE f.tenant_id    = $1
             AND f.forecast_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 3
             AND p.is_active     = true
             AND p.stock_quantity <= f.reorder_point
           GROUP BY p.product_id, p.name_ar, p.stock_unit, p.stock_quantity
           ORDER BY p.stock_quantity ASC
           LIMIT 50`,
          [tid],
        );
        rows = r.rows;

      } else if (name === 'anomaly_alerts') {
        const hours = Math.min(parseInt(String(a.hours ?? 24)), 168);
        const r = await opts.pool.query(
          `SELECT alert_type, severity, score, details, created_at
           FROM anomaly_alerts
           WHERE tenant_id    = $1
             AND acknowledged = false
             AND created_at   > now() - ($2 || ' hours')::interval
           ORDER BY score DESC
           LIMIT 50`,
          [tid, hours],
        );
        rows = r.rows;

      } else if (name === 'waste_summary') {
        const days = Math.min(parseInt(String(a.days ?? 30)), 90);
        const r = await opts.pool.query(
          `SELECT
             p.name_ar,
             w.reason_code,
             COUNT(*)                                       AS events,
             SUM(w.weight_grams) / 1000.0                 AS total_kg,
             ROUND(SUM(w.weight_grams * p.price_cents) / 1000000.0, 2) AS est_loss_mad
           FROM waste_records w
           JOIN products p ON p.product_id = w.product_id
           WHERE w.tenant_id = $1
             AND w.server_received_at > now() - ($2 || ' days')::interval
           GROUP BY p.product_id, p.name_ar, w.reason_code
           ORDER BY total_kg DESC
           LIMIT 50`,
          [tid, days],
        );
        rows = r.rows;

      } else {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'unknown_tool', tool: name }) }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify(rows, null, 2) }],
      };

    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: String(err), tool: name }) }],
        isError: true,
      };
    }
  });

  return server;
}

// In-process tool runner — bypasses MCP transport for server-side use.
// Returns parsed rows or throws on unknown tool / DB error.
export async function runTool(
  opts: MCPAnalyticsOptions,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tid = opts.tenantId;
  const a   = args;

  if (name === 'top_products') {
    const days  = Math.min(parseInt(String(a['days'] ?? 7)), 90);
    const limit = Math.min(parseInt(String(a['limit'] ?? 10)), 50);
    const byQty = a['metric'] === 'quantity';
    const r = await opts.pool.query(
      `SELECT item->>'productId' AS product_id, item->>'nameAr' AS name_ar,
              SUM((item->>'quantity')::numeric) AS qty,
              SUM((item->>'lineTotalCents')::numeric) / 100.0 AS revenue_mad
       FROM transactions tr, jsonb_array_elements(tr.items) item
       WHERE tr.tenant_id = $1 AND tr.status = 'completed'
         AND tr.sold_at > now() - ($2 || ' days')::interval
       GROUP BY item->>'productId', item->>'nameAr'
       ORDER BY ${byQty ? 'qty' : 'revenue_mad'} DESC LIMIT $3`,
      [tid, days, limit],
    );
    return r.rows;
  }

  if (name === 'sales_by_hour') {
    const days = Math.min(parseInt(String(a['days'] ?? 7)), 30);
    const r = await opts.pool.query(
      `SELECT EXTRACT(HOUR FROM sold_at) AS hour,
              ROUND(AVG(daily_rev), 2) AS avg_revenue_mad,
              ROUND(AVG(daily_tx)::numeric, 1) AS avg_tx_count
       FROM (SELECT DATE_TRUNC('day', sold_at) AS day,
                    EXTRACT(HOUR FROM sold_at) AS hour,
                    SUM(total_amount_cents) / 100.0 AS daily_rev,
                    COUNT(*) AS daily_tx
             FROM transactions WHERE tenant_id = $1 AND status = 'completed'
               AND sold_at > now() - ($2 || ' days')::interval
             GROUP BY day, EXTRACT(HOUR FROM sold_at)) sub
       GROUP BY EXTRACT(HOUR FROM sold_at) ORDER BY hour`,
      [tid, days],
    );
    return r.rows;
  }

  if (name === 'cashier_performance') {
    const days = Math.min(parseInt(String(a['days'] ?? 30)), 90);
    const r = await opts.pool.query(
      `SELECT st.name_ar AS cashier,
              COUNT(t.transaction_id) AS tx_count,
              ROUND(SUM(t.total_amount_cents) / 100.0, 2) AS revenue_mad,
              ROUND(100.0 * COUNT(t.transaction_id) FILTER (WHERE t.status = 'voided')
                / NULLIF(COUNT(t.transaction_id), 0), 2) AS void_rate_pct
       FROM transactions t
       JOIN shifts s ON s.shift_id = t.shift_id
       JOIN staff st ON st.staff_id = s.cashier_id
       WHERE t.tenant_id = $1 AND t.sold_at > now() - ($2 || ' days')::interval
       GROUP BY st.staff_id, st.name_ar ORDER BY revenue_mad DESC`,
      [tid, days],
    );
    return r.rows;
  }

  if (name === 'overdue_credit') {
    const minBal = parseFloat(String(a['min_balance_mad'] ?? 0));
    const limit  = Math.min(parseInt(String(a['limit'] ?? 20)), 50);
    const r = await opts.pool.query(
      `SELECT name_ar, name_fr, phone, balance, credit_limit,
              ROUND(balance / NULLIF(credit_limit, 0) * 100, 1) AS utilization_pct
       FROM customers WHERE tenant_id = $1 AND balance >= $2
       ORDER BY balance DESC LIMIT $3`,
      [tid, minBal, limit],
    );
    return r.rows;
  }

  if (name === 'daily_summary') {
    const days = Math.min(parseInt(String(a['days'] ?? 14)), 90);
    const r = await opts.pool.query(
      `SELECT DATE(sold_at) AS date, COUNT(transaction_id) AS tx_count,
              ROUND(SUM(total_amount_cents) / 100.0, 2) AS revenue_mad,
              ROUND(AVG(total_amount_cents) / 100.0, 2) AS avg_basket_mad
       FROM transactions WHERE tenant_id = $1 AND status = 'completed'
         AND sold_at > now() - ($2 || ' days')::interval
       GROUP BY DATE(sold_at) ORDER BY date DESC`,
      [tid, days],
    );
    return r.rows;
  }

  if (name === 'reorder_alerts') {
    const r = await opts.pool.query(
      `SELECT p.name_ar, p.stock_quantity, p.stock_unit,
              MAX(f.reorder_point) AS reorder_point, SUM(f.qty_predicted) AS demand_3d
       FROM demand_forecasts f
       JOIN products p ON p.product_id = f.product_id AND p.tenant_id = f.tenant_id
       WHERE f.tenant_id = $1
         AND f.forecast_date BETWEEN CURRENT_DATE + 1 AND CURRENT_DATE + 3
         AND p.is_active = true AND p.stock_quantity <= f.reorder_point
       GROUP BY p.product_id, p.name_ar, p.stock_unit, p.stock_quantity
       ORDER BY p.stock_quantity ASC LIMIT 50`,
      [tid],
    );
    return r.rows;
  }

  if (name === 'anomaly_alerts') {
    const hours = Math.min(parseInt(String(a['hours'] ?? 24)), 168);
    const r = await opts.pool.query(
      `SELECT alert_type, severity, score, details, created_at
       FROM anomaly_alerts WHERE tenant_id = $1 AND acknowledged = false
         AND created_at > now() - ($2 || ' hours')::interval
       ORDER BY score DESC LIMIT 50`,
      [tid, hours],
    );
    return r.rows;
  }

  if (name === 'waste_summary') {
    const days = Math.min(parseInt(String(a['days'] ?? 30)), 90);
    const r = await opts.pool.query(
      `SELECT p.name_ar, w.reason_code, COUNT(*) AS events,
              SUM(w.weight_grams) / 1000.0 AS total_kg,
              ROUND(SUM(w.weight_grams * p.price_cents) / 1000000.0, 2) AS est_loss_mad
       FROM waste_records w JOIN products p ON p.product_id = w.product_id
       WHERE w.tenant_id = $1
         AND w.server_received_at > now() - ($2 || ' days')::interval
       GROUP BY p.product_id, p.name_ar, w.reason_code ORDER BY total_kg DESC LIMIT 50`,
      [tid, days],
    );
    return r.rows;
  }

  throw new Error(`unknown_tool: ${name}`);
}

// Export for standalone stdio server usage
export async function startStdioServer(
  tenantId: string,
  pool: MCPAnalyticsOptions['pool'],
): Promise<void> {
  const server    = createAnalyticsServer({ tenantId, pool });
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
