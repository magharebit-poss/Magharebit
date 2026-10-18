-- Migration: 024_markdown_rules
-- Depends on: 007_tenants_and_licenses (tenants), 013_remaining_tables (products)
-- Creates: markdown_rules, product_lots; alters products

-- ── Per-product markdown rules ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS markdown_rules (
  rule_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  product_id         UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  days_after_receipt INTEGER NOT NULL CHECK (days_after_receipt > 0),
  discount_percent   INTEGER NOT NULL
                     CHECK (discount_percent > 0 AND discount_percent < 100),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, product_id, days_after_receipt)
);

CREATE INDEX IF NOT EXISTS idx_markdown_rules_product
  ON markdown_rules(tenant_id, product_id);

-- ── Product lot tracking (for non-BOM perishables) ──────────────────────────
-- BOM products use ingredient_lots.received_at as their aging clock.
-- Simple perishable products use this table.

CREATE TABLE IF NOT EXISTS product_lots (
  lot_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL,
  product_id        UUID NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  quantity_received INTEGER NOT NULL CHECK (quantity_received > 0),
  notes             TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_lots_active
  ON product_lots(tenant_id, product_id, is_active)
  WHERE is_active = true;

-- ── Markdown fields on products ──────────────────────────────────────────────
-- is_perishable: opt-in flag; only perishable products are eligible for rules
-- current_markdown_percent: set by the hourly cron; NULL = no active markdown

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_perishable BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_markdown_percent INTEGER
    CHECK (current_markdown_percent IS NULL
      OR (current_markdown_percent > 0 AND current_markdown_percent < 100));
