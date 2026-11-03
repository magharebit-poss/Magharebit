-- Migration 051: stock_variances (record oversells instead of silently clamping at zero)
--   *** DRAFT: NOT APPLIED ***  Review before applying.
-- Apply with: npx tsx scripts/migrate-051.ts (from backend). Rollback: migrations/rollback/051_rollback.sql
-- Depends on: 007 (tenants, registers), 009 (staff), 013 (products, transactions)
--
-- Why: POST /transactions deducts product stock with GREATEST(stock_quantity - qty, 0), so a sale
-- that exceeds the stock leaves no trace. The reconciliation design (docs/pos-architecture-sync.md,
-- section 5) never rejects a real sale; it records the shortfall here and raises an alert.
--
-- Sign convention: variance_qty = actual_qty - expected_qty (a shortage / oversell is NEGATIVE).
-- Quantities are units for normal products and kilograms for weighted ones (same as products.stock_quantity,
-- see migration 052; this line originally said grams).
-- variance_qty is GENERATED so it can never disagree with expected/actual.
--
-- Foreign keys: product is RESTRICT (an audit row must not vanish with a product; products are
-- deactivated, and no backend code hard-deletes them). register and transaction are SET NULL
-- (the variance stays even if those rows are archived). tenant is CASCADE like tenant_integrations.

CREATE TABLE IF NOT EXISTS stock_variances (
  variance_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(product_id) ON DELETE RESTRICT,
  register_id      UUID REFERENCES registers(register_id) ON DELETE SET NULL,
  transaction_id   UUID REFERENCES transactions(transaction_id) ON DELETE SET NULL,
  expected_qty     NUMERIC(14,3) NOT NULL,
  actual_qty       NUMERIC(14,3) NOT NULL,
  variance_qty     NUMERIC(14,3) GENERATED ALWAYS AS (actual_qty - expected_qty) STORED,
  reason           TEXT NOT NULL CONSTRAINT stock_variances_reason_check CHECK (char_length(reason) BETWEEN 1 AND 200),
  detected_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_by  UUID REFERENCES staff(staff_id) ON DELETE SET NULL,
  acknowledged_at  TIMESTAMPTZ,
  -- An acknowledger without a time is invalid. (The reverse is allowed: staff.staff_id SET NULL
  -- keeps the time when the staff row is later removed.)
  CONSTRAINT stock_variances_ack_check CHECK (acknowledged_at IS NOT NULL OR acknowledged_by IS NULL)
);

COMMENT ON TABLE stock_variances IS
  'Stock shortfalls found when a sale exceeded stock or reconciliation disagreed. Append-only; acknowledge, do not edit.';
COMMENT ON COLUMN stock_variances.variance_qty IS 'actual_qty - expected_qty. Negative = shortage / oversell.';

-- Recent variances for a tenant (dashboard, digest).
CREATE INDEX IF NOT EXISTS idx_stock_variances_tenant_detected
  ON stock_variances (tenant_id, detected_at DESC);

-- The "needs attention" list: only unacknowledged rows, which stay few.
CREATE INDEX IF NOT EXISTS idx_stock_variances_unacknowledged
  ON stock_variances (tenant_id, detected_at DESC)
  WHERE acknowledged_at IS NULL;
