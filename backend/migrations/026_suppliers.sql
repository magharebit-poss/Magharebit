-- Migration: 026_suppliers
-- Depends on: 007_tenants_and_licenses (tenants), 008_rbac (staff),
--             013_remaining_tables (stores, products), 024_markdown_rules (product_lots)
-- Creates: suppliers, purchase_orders, po_lines
-- Extends: product_lots (supplier_id, unit_cost_piastres, total_cost_piastres)

-- ── Supplier profiles ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS suppliers (
  supplier_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  name            TEXT NOT NULL,
  phone           TEXT,
  address         TEXT,
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_suppliers_tenant
  ON suppliers(tenant_id, is_active);

-- ── Extend product_lots with supplier attribution and cost ───────────────────

ALTER TABLE product_lots
  ADD COLUMN IF NOT EXISTS supplier_id UUID
    REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_cost_piastres INTEGER
    CHECK (unit_cost_piastres IS NULL OR unit_cost_piastres >= 0),
  ADD COLUMN IF NOT EXISTS total_cost_piastres INTEGER
    CHECK (total_cost_piastres IS NULL OR total_cost_piastres >= 0);

-- ── Purchase orders (delivery records) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_orders (
  po_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  supplier_id         UUID REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
  store_id            UUID REFERENCES stores(store_id),
  received_by         UUID REFERENCES staff(staff_id),
  received_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes               TEXT,
  total_cost_piastres INTEGER DEFAULT 0,
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'received', 'cancelled')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_po_tenant
  ON purchase_orders(tenant_id, received_at DESC);

-- ── Purchase order line items ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS po_lines (
  line_id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id                 UUID NOT NULL REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
  tenant_id             UUID NOT NULL,
  product_id            UUID NOT NULL REFERENCES products(product_id),
  lot_id                UUID REFERENCES product_lots(lot_id),
  quantity_received     INTEGER NOT NULL CHECK (quantity_received > 0),
  unit_cost_piastres    INTEGER CHECK (unit_cost_piastres IS NULL OR unit_cost_piastres >= 0),
  line_total_piastres   INTEGER CHECK (line_total_piastres IS NULL OR line_total_piastres >= 0),
  notes                 TEXT
);

CREATE INDEX IF NOT EXISTS idx_po_lines_po
  ON po_lines(po_id);
