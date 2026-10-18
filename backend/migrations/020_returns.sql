-- Migration: 020_returns
-- POS Returns & Refunds tables.
-- Note: an early placeholder `returns` table exists from migration 003 (different schema,
-- workflow-state-machine design). These three tables are the operational POS returns schema
-- used by the cashier interface. They use the `pos_returns` prefix to avoid any name clash.
--
-- FK pattern follows existing migrations:
--   tenant_return_counters → no FK on tenant_id (same as tenant_receipt_counters / tenant_invoice_counters)
--   pos_returns            → REFERENCES tenants(id)   [tenants PK is `id`, not `tenant_id`]

-- ── Atomic return-number counter per tenant ────────────────────────────────────────────────
-- No FK on tenant_id — follows the pattern of tenant_receipt_counters (015) and
-- tenant_invoice_counters (018): plain UUID primary key, no referential constraint.
CREATE TABLE IF NOT EXISTS tenant_return_counters (
  tenant_id   UUID    PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- ── Return header — one row per refund transaction ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_returns (
  return_id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES tenants(id),
  return_number           TEXT        NOT NULL,                  -- RET-000001
  original_transaction_id UUID        REFERENCES transactions(transaction_id),
  original_receipt_number TEXT,                                  -- NULL when freeform
  cashier_id              UUID        NOT NULL REFERENCES staff(staff_id),
  approving_manager_id    UUID        REFERENCES staff(staff_id),-- NULL when under threshold
  total_piastres          INTEGER     NOT NULL CHECK (total_piastres >= 0),
  refund_method           TEXT        NOT NULL CHECK (refund_method IN ('cash','card','store_credit')),
  is_freeform             BOOLEAN     NOT NULL DEFAULT FALSE,
  notes                   TEXT,
  shift_id                UUID        REFERENCES shifts(shift_id),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, return_number)
);

CREATE INDEX IF NOT EXISTS idx_pos_returns_tenant_receipt
  ON pos_returns(tenant_id, original_receipt_number);

CREATE INDEX IF NOT EXISTS idx_pos_returns_cashier
  ON pos_returns(cashier_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_returns_shift
  ON pos_returns(shift_id);

-- ── Return line items ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pos_return_items (
  return_item_id      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id           UUID    NOT NULL REFERENCES pos_returns(return_id) ON DELETE CASCADE,
  product_id          UUID    REFERENCES products(product_id),   -- NULL for freeform items
  product_name        TEXT    NOT NULL,
  quantity            INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_piastres INTEGER NOT NULL CHECK (unit_price_piastres >= 0),
  line_total_piastres INTEGER NOT NULL,
  -- disposition: restock = goes back to inventory; damaged/discard = no stock change
  disposition         TEXT    NOT NULL CHECK (disposition IN ('restock','damaged','discard'))
);

CREATE INDEX IF NOT EXISTS idx_pos_return_items_return
  ON pos_return_items(return_id);
