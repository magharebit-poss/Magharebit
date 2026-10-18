/**
 * Margin Guardian — real-time anomaly detection.
 *
 * Called after each sale, void, refund, discount,
 * and at shift close. Computes an anomaly score
 * by comparing the current action against the
 * cashier's historical baseline.
 *
 * Severity mapping:
 *   score 0–30:  low     (log only)
 *   score 31–60: medium  (dashboard highlight)
 *   score 61–80: high    (manager notification)
 *   score 81–100:critical(immediate alert)
 */

import type { Pool } from 'pg';

type PgPool = Pool | {
  query(sql: string, params: unknown[]): Promise<{ rows: unknown[] }>;
};

export interface AnomalyContext {
  tenantId:  string;
  shiftId:   string;
  cashierId: string;
  pool:      PgPool;
}

export interface AnomalyAlert {
  type:         string;
  severity:     'low' | 'medium' | 'high' | 'critical';
  score:        number;
  details:      Record<string, unknown>;
  referenceId?: string;
}

export interface AnomalyResult {
  hasAnomaly: boolean;
  alerts:     AnomalyAlert[];
}

function severity(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 81) return 'critical';
  if (score >= 61) return 'high';
  if (score >= 31) return 'medium';
  return 'low';
}

function zScore(value: number, mean: number, std: number): number {
  if (std < 0.0001) return 0;
  return Math.abs((value - mean) / std);
}

type BaselineRow = {
  avg_void_rate:     string;
  std_void_rate:     string;
  avg_discount_rate: string;
  std_discount_rate: string;
};

type CountRow = { cnt: string };
type TxRow   = { tx: string; voids: string };

/**
 * Check a void transaction for anomalies.
 */
export async function checkVoid(
  ctx:           AnomalyContext,
  transactionId: string,
  voidAmount:    number,
): Promise<AnomalyResult> {
  const alerts: AnomalyAlert[] = [];

  // Count voids in last 10 minutes via manager_overrides audit log.
  const rapidResult = await ctx.pool.query(
    `SELECT count(*) AS cnt
     FROM manager_overrides
     WHERE tenant_id  = $1
       AND cashier_id = $2
       AND action     = 'void'
       AND created_at > now() - INTERVAL '10 min'`,
    [ctx.tenantId, ctx.cashierId],
  );
  const rapidCount = parseInt(((rapidResult.rows as CountRow[])[0]?.cnt ?? '0'), 10);

  if (rapidCount >= 3) {
    const score = Math.min(60 + rapidCount * 10, 100);
    alerts.push({
      type:        'rapid_voids',
      severity:    severity(score),
      score,
      details:     { voids_in_10min: rapidCount, threshold: 3 },
      referenceId: transactionId,
    });
  }

  // Compare current shift void rate to baseline.
  const baseResult = await ctx.pool.query(
    `SELECT avg_void_rate, std_void_rate
     FROM cashier_baselines
     WHERE tenant_id  = $1
       AND cashier_id = $2`,
    [ctx.tenantId, ctx.cashierId],
  );

  if ((baseResult.rows as BaselineRow[]).length > 0) {
    const base = (baseResult.rows as BaselineRow[])[0]!;
    const txResult = await ctx.pool.query(
      `SELECT count(*) AS tx,
              sum(CASE WHEN status = 'voided' THEN 1 ELSE 0 END) AS voids
       FROM transactions
       WHERE tenant_id = $1
         AND shift_id  = $2`,
      [ctx.tenantId, ctx.shiftId],
    );
    const txRow = (txResult.rows as TxRow[])[0];
    const tx    = parseInt(txRow?.tx    ?? '1', 10);
    const voids = parseInt(txRow?.voids ?? '0', 10);
    const currentVoidRate = tx > 0 ? voids / tx : 0;
    const z = zScore(
      currentVoidRate,
      parseFloat(base.avg_void_rate),
      parseFloat(base.std_void_rate),
    );
    if (z > 2.5) {
      const score = Math.min(30 + z * 12, 90);
      alerts.push({
        type:        'void_spike',
        severity:    severity(score),
        score,
        details:     {
          current_void_rate: currentVoidRate.toFixed(3),
          baseline_mean:     base.avg_void_rate,
          z_score:           z.toFixed(2),
          void_amount:       voidAmount,
        },
        referenceId: transactionId,
      });
    }
  }

  await persistAlerts(ctx, alerts);
  return { hasAnomaly: alerts.length > 0, alerts };
}

/**
 * Check a discount for anomalies.
 */
export async function checkDiscount(
  ctx:             AnomalyContext,
  transactionId:   string,
  discountPercent: number,
  discountCents:   number,
): Promise<AnomalyResult> {
  const alerts: AnomalyAlert[] = [];

  // >30% discount is always flagged regardless of baseline.
  if (discountPercent > 30) {
    const score = Math.min(50 + discountPercent, 100);
    alerts.push({
      type:        'discount_over_limit',
      severity:    severity(score),
      score,
      details:     {
        discount_percent: discountPercent,
        discount_cents:   discountCents,
        hard_limit:       30,
      },
      referenceId: transactionId,
    });
  }

  // Baseline comparison.
  const baseResult = await ctx.pool.query(
    `SELECT avg_discount_rate, std_discount_rate
     FROM cashier_baselines
     WHERE tenant_id  = $1
       AND cashier_id = $2`,
    [ctx.tenantId, ctx.cashierId],
  );

  if ((baseResult.rows as BaselineRow[]).length > 0) {
    const base = (baseResult.rows as BaselineRow[])[0]!;
    const z = zScore(
      discountPercent / 100,
      parseFloat(base.avg_discount_rate),
      parseFloat(base.std_discount_rate),
    );
    if (z > 2.5 && discountPercent > 5) {
      const score = Math.min(25 + z * 10, 75);
      alerts.push({
        type:        'unusual_discount',
        severity:    severity(score),
        score,
        details:     {
          discount_percent: discountPercent,
          z_score:          z.toFixed(2),
          baseline_mean:    base.avg_discount_rate,
        },
        referenceId: transactionId,
      });
    }
  }

  await persistAlerts(ctx, alerts);
  return { hasAnomaly: alerts.length > 0, alerts };
}

/**
 * Check shift close cash discrepancy.
 */
export async function checkCashVariance(
  ctx:      AnomalyContext,
  expected: number,
  counted:  number,
): Promise<AnomalyResult> {
  const variance    = counted - expected;
  const variancePct = expected > 0 ? Math.abs(variance) / expected : 0;
  const alerts: AnomalyAlert[] = [];

  if (Math.abs(variance) > 20000 || variancePct > 0.05) {
    const score = Math.min(40 + variancePct * 200, 100);
    alerts.push({
      type:     'cash_discrepancy',
      severity: severity(score),
      score,
      details:  {
        expected_cents: expected,
        counted_cents:  counted,
        variance_cents: variance,
        variance_pct:   (variancePct * 100).toFixed(2),
      },
    });
  }

  await persistAlerts(ctx, alerts);
  return { hasAnomaly: alerts.length > 0, alerts };
}

async function persistAlerts(ctx: AnomalyContext, alerts: AnomalyAlert[]): Promise<void> {
  for (const a of alerts) {
    try {
      await ctx.pool.query(
        `INSERT INTO anomaly_alerts
           (tenant_id, shift_id, cashier_id,
            alert_type, severity, score,
            details, reference_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          ctx.tenantId,
          ctx.shiftId,
          ctx.cashierId,
          a.type,
          a.severity,
          a.score,
          JSON.stringify(a.details),
          a.referenceId ?? null,
        ],
      );
    } catch (err: unknown) {
      console.error('[guardian] persist failed', err);
    }
  }
}

/**
 * Recompute baselines for a tenant.
 * Call nightly from ETL cron.
 */
export async function recomputeBaselines(
  tenantId: string,
  pool: PgPool,
): Promise<void> {
  type BaselineComputeRow = {
    cashier_id:        string;
    avg_void_rate:     string | null;
    std_void_rate:     string | null;
    avg_discount_rate: string | null;
    std_discount_rate: string | null;
    avg_basket_cents:  string | null;
    std_basket_cents:  string | null;
    sample_days:       string;
  };

  const result = await pool.query(
    `WITH shift_stats AS (
       SELECT
         s.cashier_id,
         count(t.transaction_id) FILTER (
           WHERE t.status = 'completed'
         ) AS tx_count,
         count(t.transaction_id) FILTER (
           WHERE t.status = 'voided'
         ) AS void_count,
         COALESCE(SUM(t.total_discount_cents), 0) AS total_discount,
         COALESCE(SUM(t.total_amount_cents), 0)   AS total_revenue,
         EXTRACT(EPOCH FROM (
           s.closed_at - s.opened_at
         )) / 3600.0 AS shift_hours
       FROM shifts s
       LEFT JOIN transactions t
         ON t.shift_id   = s.shift_id
        AND t.tenant_id  = $1
       WHERE s.tenant_id  = $1
         AND s.closed_at IS NOT NULL
         AND s.opened_at  > now() - INTERVAL '30 days'
       GROUP BY s.shift_id, s.cashier_id
     )
     SELECT
       cashier_id,
       avg(CASE WHEN tx_count > 0
         THEN void_count::float / tx_count ELSE 0 END)     AS avg_void_rate,
       stddev(CASE WHEN tx_count > 0
         THEN void_count::float / tx_count ELSE 0 END)     AS std_void_rate,
       avg(CASE WHEN total_revenue > 0
         THEN total_discount::float / total_revenue
         ELSE 0 END)                                       AS avg_discount_rate,
       stddev(CASE WHEN total_revenue > 0
         THEN total_discount::float / total_revenue
         ELSE 0 END)                                       AS std_discount_rate,
       avg(CASE WHEN tx_count > 0
         THEN total_revenue / tx_count ELSE 0 END)         AS avg_basket_cents,
       stddev(CASE WHEN tx_count > 0
         THEN total_revenue / tx_count ELSE 0 END)         AS std_basket_cents,
       count(*)                                            AS sample_days
     FROM shift_stats
     GROUP BY cashier_id`,
    [tenantId],
  );

  for (const row of result.rows as BaselineComputeRow[]) {
    await pool.query(
      `INSERT INTO cashier_baselines
         (tenant_id, cashier_id,
          avg_void_rate, std_void_rate,
          avg_discount_rate, std_discount_rate,
          avg_basket_cents, std_basket_cents,
          sample_days, computed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now())
       ON CONFLICT (tenant_id, cashier_id)
       DO UPDATE SET
         avg_void_rate     = EXCLUDED.avg_void_rate,
         std_void_rate     = EXCLUDED.std_void_rate,
         avg_discount_rate = EXCLUDED.avg_discount_rate,
         std_discount_rate = EXCLUDED.std_discount_rate,
         avg_basket_cents  = EXCLUDED.avg_basket_cents,
         std_basket_cents  = EXCLUDED.std_basket_cents,
         sample_days       = EXCLUDED.sample_days,
         computed_at       = now()`,
      [
        tenantId,
        row.cashier_id,
        parseFloat(row.avg_void_rate     ?? '0'),
        parseFloat(row.std_void_rate     ?? '0'),
        parseFloat(row.avg_discount_rate ?? '0'),
        parseFloat(row.std_discount_rate ?? '0'),
        parseInt(row.avg_basket_cents    ?? '0', 10),
        parseInt(row.std_basket_cents    ?? '0', 10),
        parseInt(row.sample_days, 10),
      ],
    );
  }
}
