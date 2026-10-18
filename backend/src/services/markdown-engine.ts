import type { Pool } from 'pg';

export interface MarkdownResult {
  productId: string;
  productName: string;
  basePricePiastres: number;
  markdownPercent: number;
  effectivePricePiastres: number;
  daysOld: number;
  ruleTriggeredAt: number;
}

export interface MarkdownComputeResult {
  tenantId: string;
  computed: MarkdownResult[];
  cleared: string[];
  computedAt: string;
}

export async function computeMarkdowns(
  pool: Pool,
  tenantId: string,
): Promise<MarkdownComputeResult> {
  const computed: MarkdownResult[] = [];
  const cleared: string[] = [];

  // All active perishable products with their oldest active lot
  const { rows: products } = await pool.query<{
    product_id: string;
    name_fr: string;
    price_cents: number;
    current_markdown_percent: number | null;
    received_at: Date;
  }>(
    `SELECT p.product_id, p.name_fr, p.price_cents,
            p.current_markdown_percent,
            MIN(pl.received_at) AS received_at
     FROM products p
     JOIN product_lots pl
       ON pl.product_id = p.product_id
      AND pl.tenant_id  = p.tenant_id
      AND pl.is_active  = true
     WHERE p.tenant_id     = $1
       AND p.is_perishable = true
     GROUP BY p.product_id, p.name_fr, p.price_cents, p.current_markdown_percent`,
    [tenantId],
  );

  for (const product of products) {
    try {
      const daysOld = Math.floor(
        (Date.now() - new Date(product.received_at).getTime()) / 86_400_000,
      );

      // Highest-tier rule whose threshold has been crossed
      const { rows: rules } = await pool.query<{
        discount_percent: number;
        days_after_receipt: number;
      }>(
        `SELECT discount_percent, days_after_receipt
         FROM markdown_rules
         WHERE tenant_id          = $1
           AND product_id         = $2
           AND days_after_receipt <= $3
         ORDER BY days_after_receipt DESC
         LIMIT 1`,
        [tenantId, product.product_id, daysOld],
      );

      if (rules.length > 0) {
        const rule = rules[0]!;
        // Minimum effective price: 1 piastre
        const effectivePrice = Math.max(
          Math.round(product.price_cents * (1 - rule.discount_percent / 100)),
          1,
        );
        await pool.query(
          `UPDATE products
           SET current_markdown_percent = $1
           WHERE product_id = $2 AND tenant_id = $3`,
          [rule.discount_percent, product.product_id, tenantId],
        );
        computed.push({
          productId: product.product_id,
          productName: product.name_fr,
          basePricePiastres: product.price_cents,
          markdownPercent: rule.discount_percent,
          effectivePricePiastres: effectivePrice,
          daysOld,
          ruleTriggeredAt: rule.days_after_receipt,
        });
      } else if (product.current_markdown_percent !== null) {
        // No rule applies — clear any previously set markdown
        await pool.query(
          `UPDATE products
           SET current_markdown_percent = NULL
           WHERE product_id = $1 AND tenant_id = $2`,
          [product.product_id, tenantId],
        );
        cleared.push(product.product_id);
      }
    } catch (err) {
      // Per-product isolation: one failure must not stop the rest
      console.error(`[markdown-engine] product ${product.product_id}:`, err);
    }
  }

  return { tenantId, computed, cleared, computedAt: new Date().toISOString() };
}
