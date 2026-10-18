/**
 * Customer Insights Engine
 *
 * Computes RFM scores, segments, credit risk,
 * and generates actionable suggestions.
 *
 * RFM scoring (1–5 each, 5=best):
 *   Recency:   days since last purchase
 *     ≤7d=5, ≤14d=4, ≤30d=3, ≤60d=2, >60d=1
 *   Frequency: purchase count (last 90 days)
 *     ≥20=5, ≥10=4, ≥5=3, ≥2=2, else=1
 *   Monetary:  total spent MAD (last 90 days)
 *     ≥5000=5, ≥2000=4, ≥1000=3, ≥300=2, else=1
 *
 * Segments:
 *   champion:    rfm_total 13-15
 *   loyal:       rfm_total 10-12, recency ≥3
 *   at_risk:     frequency ≥3, recency ≤2
 *   big_spender: monetary=5, frequency ≤2
 *   dormant:     days_since > 60
 *   credit_risk: utilization > 0.80
 *   new:         purchase_count < 3
 *
 * Credit risk score (0–100):
 *   utilization 0.00–0.50: score 0
 *   utilization 0.50–0.70: score 20
 *   utilization 0.70–0.85: score 50
 *   utilization 0.85–0.95: score 75
 *   utilization > 0.95:    score 90
 *   balance > credit_limit: score 100
 */

import type { Pool } from 'pg';

function recencyScore(days: number): number {
  if (days <=  7) return 5;
  if (days <= 14) return 4;
  if (days <= 30) return 3;
  if (days <= 60) return 2;
  return 1;
}

function frequencyScore(count: number): number {
  if (count >= 20) return 5;
  if (count >= 10) return 4;
  if (count >=  5) return 3;
  if (count >=  2) return 2;
  return 1;
}

function monetaryScore(mad: number): number {
  if (mad >= 5000) return 5;
  if (mad >= 2000) return 4;
  if (mad >= 1000) return 3;
  if (mad >=  300) return 2;
  return 1;
}

function creditRiskScore(utilization: number): number {
  if (utilization > 1.00) return 100;
  if (utilization > 0.95) return 90;
  if (utilization > 0.85) return 75;
  if (utilization > 0.70) return 50;
  if (utilization > 0.50) return 20;
  return 0;
}

function assignSegment(params: {
  rfmTotal:      number;
  recency:       number;
  frequency:     number;
  monetary:      number;
  daysSinceLast: number;
  purchaseCount: number;
  utilization:   number;
}): string {
  if (params.utilization > 0.80)  return 'credit_risk';
  if (params.purchaseCount < 3)   return 'new';
  if (params.daysSinceLast > 60)  return 'dormant';
  if (params.rfmTotal >= 13)      return 'champion';
  if (params.rfmTotal >= 10 && params.recency >= 3) return 'loyal';
  if (params.frequency >= 3 && params.recency <= 2) return 'at_risk';
  if (params.monetary === 5 && params.frequency <= 2) return 'big_spender';
  return 'regular';
}

interface CustomerRow {
  customer_id:     string;
  balance:         string;
  credit_limit:    string;
  purchase_count:  string;
  total_spent_mad: string | null;
  avg_basket_mad:  string | null;
  days_since_last: string | null;
}

export async function computeCustomerInsights(
  tenantId: string,
  pool: Pool,
): Promise<{ processed: number; suggestions: number }> {
  // Fetch all customers with 90-day purchase history.
  // Uses total_amount_cents (transactions table) / 100.0 for MAD values.
  const { rows: customers } = await pool.query<CustomerRow>(
    `SELECT
       c.customer_id,
       c.balance::text,
       c.credit_limit::text,
       COUNT(t.transaction_id)::text            AS purchase_count,
       (SUM(t.total_amount_cents) / 100.0)::text AS total_spent_mad,
       (AVG(t.total_amount_cents) / 100.0)::text AS avg_basket_mad,
       EXTRACT(EPOCH FROM (now() - MAX(t.sold_at)))
         / 86400.0                              AS days_since_last
     FROM customers c
     LEFT JOIN transactions t
       ON t.customer_id = c.customer_id
      AND t.tenant_id   = c.tenant_id
      AND t.status      = 'completed'
      AND t.sold_at     > now() - INTERVAL '90 days'
     WHERE c.tenant_id = $1
     GROUP BY
       c.customer_id, c.balance, c.credit_limit`,
    [tenantId],
  );

  let processed   = 0;
  let suggestions = 0;

  for (const c of customers) {
    const balance       = parseFloat(c.balance);
    const creditLimit   = parseFloat(c.credit_limit);
    const purchaseCount = parseInt(c.purchase_count, 10);
    const totalSpentMad = parseFloat(c.total_spent_mad ?? '0');
    const avgBasketMad  = parseFloat(c.avg_basket_mad ?? '0');
    const daysSinceLast = parseFloat(c.days_since_last ?? '999');
    const utilization   = creditLimit > 0 ? balance / creditLimit : 0;

    const rec      = recencyScore(Math.round(daysSinceLast));
    const frq      = frequencyScore(purchaseCount);
    const mon      = monetaryScore(totalSpentMad);
    const rfmTotal = rec + frq + mon;
    const segment  = assignSegment({
      rfmTotal, recency: rec, frequency: frq, monetary: mon,
      daysSinceLast, purchaseCount, utilization,
    });
    const riskScore = creditRiskScore(utilization);

    await pool.query(
      `INSERT INTO customer_segments
         (tenant_id, customer_id,
          recency_score, frequency_score, monetary_score,
          segment, days_since_last_purchase,
          purchase_count, total_spent_mad, avg_basket_mad,
          credit_utilization, risk_score, last_computed)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now())
       ON CONFLICT (tenant_id, customer_id)
       DO UPDATE SET
         recency_score            = EXCLUDED.recency_score,
         frequency_score          = EXCLUDED.frequency_score,
         monetary_score           = EXCLUDED.monetary_score,
         segment                  = EXCLUDED.segment,
         days_since_last_purchase = EXCLUDED.days_since_last_purchase,
         purchase_count           = EXCLUDED.purchase_count,
         total_spent_mad          = EXCLUDED.total_spent_mad,
         avg_basket_mad           = EXCLUDED.avg_basket_mad,
         credit_utilization       = EXCLUDED.credit_utilization,
         risk_score               = EXCLUDED.risk_score,
         last_computed            = now()`,
      [
        tenantId, c.customer_id,
        rec, frq, mon, segment,
        Math.round(daysSinceLast),
        purchaseCount, totalSpentMad, avgBasketMad,
        utilization, riskScore,
      ],
    );
    processed++;

    const suggestionRows: Array<{
      type:    string;
      priority: number;
      details: Record<string, unknown>;
      expires: string | null;
    }> = [];

    if (utilization > 0.90) {
      suggestionRows.push({
        type:     'credit_block',
        priority: 90,
        details:  {
          balance, creditLimit, utilization,
          message_ar: 'رصيد الكريدي يتجاوز 90% من الحد الأقصى',
        },
        expires: null,
      });
    } else if (utilization > 0.75) {
      suggestionRows.push({
        type:     'credit_warning',
        priority: 65,
        details:  { balance, creditLimit, utilization, message_ar: 'تنبيه: رصيد مرتفع' },
        expires:  null,
      });
    }

    if (segment === 'dormant') {
      suggestionRows.push({
        type:     'reactivation',
        priority: 50,
        details:  {
          days_inactive: Math.round(daysSinceLast),
          message_ar: `لم يتسوق منذ ${Math.round(daysSinceLast)} يوماً`,
        },
        expires: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      });
    }

    if (segment === 'champion' || segment === 'loyal') {
      suggestionRows.push({
        type:     'loyalty_reward',
        priority: 30,
        details:  { rfm_total: rfmTotal, message_ar: 'زبون مميز — استحق مكافأة ولاء' },
        expires:  new Date(Date.now() + 30 * 86_400_000).toISOString(),
      });
    }

    for (const s of suggestionRows) {
      try {
        await pool.query(
          `INSERT INTO customer_suggestions
             (tenant_id, customer_id, suggestion_type,
              priority, details, expires_at)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT DO NOTHING`,
          [tenantId, c.customer_id, s.type, s.priority, JSON.stringify(s.details), s.expires],
        );
        suggestions++;
      } catch { /* best-effort */ }
    }
  }

  return { processed, suggestions };
}
