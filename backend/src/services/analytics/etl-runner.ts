import { execSync } from 'node:child_process';
import type { Pool } from 'pg';
import { getClickHouseClient } from './clickhouse-client.js';
import { recomputeBaselines } from './anomaly-detector.js';
import { runForecasting } from './demand-forecaster.js';
import { computeCustomerInsights } from './customer-insights.js';
import { runCashFlowUpdate } from './cashflow-predictor.js';
import {
  extractDimProducts,
  extractDimStores,
  extractDimStaff,
  extractDimSuppliers,
  extractDimLots,
  extractFactTransactions,
  extractFactWaste,
  extractFactLoyalty,
  extractFactCafeOrders,
} from './etl-extractors.js';

export interface EtlRunOptions {
  tenantId?: string;   // if omitted: run for all active tenants
  date?: string;       // ISO date string, default: yesterday
  dryRun?: boolean;    // extract + log but do not insert into ClickHouse
  tables?: string[];   // if omitted: run all tables
}

export interface EtlRunResult {
  tenantId: string;
  tablesRun: string[];
  rowsSynced: Record<string, number>;
  errors: Record<string, string>;
  dryRun: boolean;
  durationMs: number;
}

const ALL_TABLES = [
  'dim_products',
  'dim_stores',
  'dim_staff',
  'dim_suppliers',
  'dim_lots',
  'fact_transactions',
  'fact_waste_records',
  'fact_loyalty_events',
  'fact_cafe_orders',
] as const;

type TableName = (typeof ALL_TABLES)[number];

async function getWatermark(pg: Pool, tenantId: string, tableName: string): Promise<Date> {
  const { rows } = await pg.query<{ last_synced_at: Date }>(
    `SELECT last_synced_at FROM etl_watermarks
     WHERE tenant_id = $1 AND table_name = $2`,
    [tenantId, tableName],
  );
  if (rows.length > 0 && rows[0]) {
    return rows[0].last_synced_at;
  }
  return new Date('2024-01-01T00:00:00Z');
}

async function updateWatermark(
  pg: Pool,
  tenantId: string,
  tableName: string,
  lastSyncedAt: Date,
  rowsSynced: number,
): Promise<void> {
  await pg.query(
    `INSERT INTO etl_watermarks
       (tenant_id, table_name, last_synced_at, last_run_at, rows_synced)
     VALUES ($1, $2, $3, NOW(), $4)
     ON CONFLICT (tenant_id, table_name)
     DO UPDATE SET
       last_synced_at = EXCLUDED.last_synced_at,
       last_run_at    = NOW(),
       rows_synced    = etl_watermarks.rows_synced + EXCLUDED.rows_synced,
       last_error     = NULL,
       updated_at     = NOW()`,
    [tenantId, tableName, lastSyncedAt, rowsSynced],
  );
}

async function markWatermarkError(
  pg: Pool,
  tenantId: string,
  tableName: string,
  error: string,
): Promise<void> {
  await pg.query(
    `INSERT INTO etl_watermarks
       (tenant_id, table_name, last_run_at, last_error)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (tenant_id, table_name)
     DO UPDATE SET
       last_run_at = NOW(),
       last_error  = EXCLUDED.last_error,
       updated_at  = NOW()`,
    [tenantId, tableName, error],
  );
}

// Serialize a row for ClickHouse JSONEachRow format.
// JS Date → "YYYY-MM-DD HH:MM:SS" (DateTime columns reject sub-second precision).
// pg NUMERIC/DECIMAL → string in JS; ClickHouse accepts string for numeric cols.
function serializeRowForCh(row: object): string {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Date) {
      // "2026-10-09T19:35:15.328Z" → "2026-10-09 19:35:15" (truncate ms + Z)
      out[k] = v.toISOString().replace('T', ' ').slice(0, 19);
    } else {
      out[k] = v;
    }
  }
  return JSON.stringify(out);
}

async function insertIntoClickHouse(table: string, rows: object[]): Promise<void> {
  if (rows.length === 0) return;

  // Prefer docker-exec native TCP path when the HTTP interface is unavailable
  // (Docker Desktop on Windows blocks HTTP POST to mapped ports).
  const containerName =
    process.env['CLICKHOUSE_CONTAINER'] ?? 'infra-clickhouse-1';
  const chUser = process.env['CLICKHOUSE_USER'] ?? 'magharebit';
  const chPassword = process.env['CLICKHOUSE_PASSWORD'] ?? 'analyticsdev';
  const chDb = process.env['CLICKHOUSE_DB'] ?? 'magharebit_analytics';

  const useDockerExec = process.env['CLICKHOUSE_USE_DOCKER_EXEC'] !== '0';

  if (useDockerExec) {
    const jsonLines = rows.map(serializeRowForCh).join('\n');
    execSync(
      `docker exec -i ${containerName} clickhouse-client` +
        ` --user ${chUser}` +
        ` --password ${chPassword}` +
        ` --database ${chDb}` +
        ` --query "INSERT INTO ${table} FORMAT JSONEachRow"`,
      { input: jsonLines, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return;
  }

  // Fallback: HTTP client (works when ClickHouse HTTP port is accessible)
  const client = getClickHouseClient();
  await client.insert({
    table,
    values: rows,
    format: 'JSONEachRow',
  });
}

// Execute a DDL/DML statement (INSERT...SELECT, ALTER TABLE DELETE, etc.)
// directly in ClickHouse without row-level data streaming.
async function execClickHouseCommand(sql: string): Promise<void> {
  const containerName =
    process.env['CLICKHOUSE_CONTAINER'] ?? 'infra-clickhouse-1';
  const chUser = process.env['CLICKHOUSE_USER'] ?? 'magharebit';
  const chPassword = process.env['CLICKHOUSE_PASSWORD'] ?? 'analyticsdev';
  const chDb = process.env['CLICKHOUSE_DB'] ?? 'magharebit_analytics';
  const useDockerExec = process.env['CLICKHOUSE_USE_DOCKER_EXEC'] !== '0';

  if (useDockerExec) {
    // clickhouse-client reads SQL from stdin when no --query flag is given.
    execSync(
      `docker exec -i ${containerName} clickhouse-client` +
        ` --user ${chUser}` +
        ` --password ${chPassword}` +
        ` --database ${chDb}`,
      { input: sql, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    );
    return;
  }

  const client = getClickHouseClient();
  const result = await client.exec({ query: sql });
  result.stream.destroy();
}

// Rebuild the last 7 days of aggregate tables for one tenant.
// Called at the end of each nightly ETL run (after fact tables are synced).
// ALTER TABLE DELETE creates async mutations; they are complete well before
// the next nightly run fires 24 h later.
export async function runAggregation(tenantId: string): Promise<void> {
  const cmds = [
    // Delete the 7-day window to prevent double-counting on re-runs.
    `ALTER TABLE agg_product_day DELETE WHERE tenant_id = '${tenantId}' AND event_date >= today() - 7`,
    `ALTER TABLE agg_hour DELETE WHERE tenant_id = '${tenantId}' AND event_date >= today() - 7`,
    `ALTER TABLE agg_cashier_day DELETE WHERE tenant_id = '${tenantId}' AND event_date >= today() - 7`,
    // Re-aggregate from fact_transactions for the same window.
    `INSERT INTO agg_product_day
     SELECT tenant_id, product_id, event_date,
            sum(quantity)             AS total_qty,
            sum(line_total_mad)       AS total_mad,
            uniqExact(transaction_id) AS txn_count
     FROM fact_transactions
     WHERE tenant_id = '${tenantId}'
       AND event_date >= today() - 7
     GROUP BY tenant_id, product_id, event_date`,
    `INSERT INTO agg_hour
     SELECT tenant_id, event_date,
            toHour(event_ts)          AS hour,
            sum(line_total_mad)       AS total_mad,
            uniqExact(transaction_id) AS txn_count
     FROM fact_transactions
     WHERE tenant_id = '${tenantId}'
       AND event_date >= today() - 7
     GROUP BY tenant_id, event_date, hour`,
    `INSERT INTO agg_cashier_day
     SELECT tenant_id, staff_id, event_date,
            sum(line_total_mad)       AS total_mad,
            uniqExact(transaction_id) AS txn_count,
            count()                   AS items_count
     FROM fact_transactions
     WHERE tenant_id = '${tenantId}'
       AND staff_id IS NOT NULL
       AND event_date >= today() - 7
     GROUP BY tenant_id, staff_id, event_date`,
  ];

  for (const cmd of cmds) {
    await execClickHouseCommand(cmd);
  }
}

async function runEtlForTenant(
  pg: Pool,
  tenantId: string,
  targetTables: TableName[],
  now: Date,
  dryRun: boolean,
): Promise<{ rowsSynced: Record<string, number>; errors: Record<string, string> }> {
  const rowsSynced: Record<string, number> = {};
  const errors: Record<string, string> = {};

  for (const tableName of targetTables) {
    try {
      let rows: object[] = [];
      const watermark = await getWatermark(pg, tenantId, tableName);

      // Dimensions are full-refresh (no watermark needed for selection)
      // but we still record watermarks for observability.
      switch (tableName) {
        case 'dim_products':
          rows = await extractDimProducts(pg, tenantId);
          break;
        case 'dim_stores':
          rows = await extractDimStores(pg, tenantId);
          break;
        case 'dim_staff':
          rows = await extractDimStaff(pg, tenantId);
          break;
        case 'dim_suppliers':
          rows = await extractDimSuppliers(pg, tenantId);
          break;
        case 'dim_lots':
          rows = await extractDimLots(pg, tenantId, watermark);
          break;
        case 'fact_transactions':
          rows = await extractFactTransactions(pg, tenantId, watermark);
          break;
        case 'fact_waste_records':
          rows = await extractFactWaste(pg, tenantId, watermark);
          break;
        case 'fact_loyalty_events':
          rows = await extractFactLoyalty(pg, tenantId, watermark);
          break;
        case 'fact_cafe_orders':
          rows = await extractFactCafeOrders(pg, tenantId, watermark);
          break;
      }

      rowsSynced[tableName] = rows.length;

      if (dryRun) {
        // Dry run: log counts only, no writes
        continue;
      }

      await insertIntoClickHouse(tableName, rows);
      await updateWatermark(pg, tenantId, tableName, now, rows.length);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors[tableName] = message;
      try {
        await markWatermarkError(pg, tenantId, tableName, message);
      } catch {
        // Best-effort — don't let watermark errors mask the original error
      }
    }
  }

  // Rebuild 7-day aggregates from the fact tables now in ClickHouse.
  if (!dryRun) {
    try {
      await runAggregation(tenantId);
    } catch (err: unknown) {
      errors['_aggregation'] = err instanceof Error ? err.message : String(err);
    }

    // Recompute cashier baselines for the Margin Guardian z-score engine.
    try {
      await recomputeBaselines(tenantId, pg);
    } catch (err: unknown) {
      errors['_baselines'] = err instanceof Error ? err.message : String(err);
    }

    // Generate 7-day demand forecasts and reorder alerts.
    try {
      await runForecasting(tenantId, pg);
    } catch (err: unknown) {
      errors['_forecasting'] = err instanceof Error ? err.message : String(err);
    }

    // Compute RFM scores, segments, and credit risk suggestions.
    try {
      const cResult = await computeCustomerInsights(tenantId, pg);
      console.log(
        `[ETL] Customer insights: ${cResult.processed} customers, ${cResult.suggestions} suggestions`,
      );
    } catch (err: unknown) {
      errors['_customer_insights'] = err instanceof Error ? err.message : String(err);
    }

    // Build 30-day cash flow forecast and persist snapshots.
    try {
      await runCashFlowUpdate(tenantId, pg);
      console.log('[ETL] Cash flow updated');
    } catch (err: unknown) {
      errors['_cashflow'] = err instanceof Error ? err.message : String(err);
    }

    // Nightly branch summary for yesterday (store resolved through the register).
    try {
      await pg.query(
        `INSERT INTO branch_daily_summary
           (tenant_id, store_id, summary_date,
            total_revenue_mad, total_tx,
            avg_basket_mad, cashier_count)
         SELECT
           t.tenant_id,
           r.store_id,
           CURRENT_DATE - 1,
           SUM(t.total_amount_cents) / 100.0,
           COUNT(*),
           AVG(t.total_amount_cents) / 100.0,
           COUNT(DISTINCT t.cashier_id)
         FROM transactions t
         JOIN registers r ON r.register_id = t.register_id
         WHERE t.tenant_id = $1
           AND t.status = 'completed'
           AND t.sold_at >= CURRENT_DATE - 1
           AND t.sold_at <  CURRENT_DATE
         GROUP BY t.tenant_id, r.store_id
         ON CONFLICT (tenant_id, store_id, summary_date)
         DO UPDATE SET
           total_revenue_mad = EXCLUDED.total_revenue_mad,
           total_tx          = EXCLUDED.total_tx,
           avg_basket_mad    = EXCLUDED.avg_basket_mad,
           cashier_count     = EXCLUDED.cashier_count`,
        [tenantId],
      );
      console.log('[ETL] Branch daily summary updated');
    } catch (err: unknown) {
      errors['_branch_summary'] = err instanceof Error ? err.message : String(err);
    }
  }

  return { rowsSynced, errors };
}

export async function runEtl(pg: Pool, options: EtlRunOptions = {}): Promise<EtlRunResult[]> {
  const dryRun = options.dryRun ?? false;
  const now = new Date();

  // Resolve target tables
  const targetTables = (options.tables ?? [...ALL_TABLES]).filter((t): t is TableName =>
    (ALL_TABLES as readonly string[]).includes(t),
  );

  // Resolve target tenants
  let tenantIds: string[];
  if (options.tenantId) {
    tenantIds = [options.tenantId];
  } else {
    // Only sync active tenants that had recent activity (last 90 days)
    const { rows } = await pg.query<{ tenant_id: string }>(
      `SELECT DISTINCT tenant_id::text FROM transactions
       WHERE created_at > NOW() - INTERVAL '90 days'`,
    );
    tenantIds = rows.map((r) => r.tenant_id);
  }

  const results: EtlRunResult[] = [];

  for (const tenantId of tenantIds) {
    const start = Date.now();
    const { rowsSynced, errors } = await runEtlForTenant(
      pg,
      tenantId,
      targetTables,
      now,
      dryRun,
    );
    results.push({
      tenantId,
      tablesRun: targetTables,
      rowsSynced,
      errors,
      dryRun,
      durationMs: Date.now() - start,
    });
  }

  return results;
}
