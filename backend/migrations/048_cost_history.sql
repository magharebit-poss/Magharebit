-- Migration 048: product cost history (Cost Shield V1)
-- One row per supplier-invoice line that carries a product_id. Written in the
-- same transaction as the invoice so history can never disagree with the ledger.
-- Depends on: 013 (products, tenants), 026/040 (suppliers, supplier_invoices)

CREATE TABLE IF NOT EXISTS product_cost_history (
  cost_id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id),
  product_id          UUID NOT NULL REFERENCES products(product_id),
  supplier_id         UUID REFERENCES suppliers(supplier_id) ON DELETE SET NULL,
  invoice_id          UUID REFERENCES supplier_invoices(invoice_id) ON DELETE SET NULL,
  unit_cost_cents     INTEGER NOT NULL CHECK (unit_cost_cents >= 0),
  -- NULL when the product had no cost recorded before this invoice.
  previous_cost_cents INTEGER CHECK (previous_cost_cents IS NULL OR previous_cost_cents >= 0),
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_hist_product
  ON product_cost_history(tenant_id, product_id, recorded_at DESC);
