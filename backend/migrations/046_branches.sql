-- Branch management (multi-store)

-- Staff can be scoped to one store.
-- NULL = access to all stores (SUPERVISOR/OWNER); non-null = restricted to that store.
ALTER TABLE staff
  ADD COLUMN IF NOT EXISTS store_id
    UUID REFERENCES stores(store_id)
    ON DELETE SET NULL;

-- Cross-branch stock transfer requests (status tracking only; stock is not per-store yet)
CREATE TABLE IF NOT EXISTS stock_transfers (
  transfer_id   UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  from_store_id UUID NOT NULL
    REFERENCES stores(store_id),
  to_store_id   UUID NOT NULL
    REFERENCES stores(store_id),
  product_id    UUID NOT NULL
    REFERENCES products(product_id),
  quantity      NUMERIC(12,3) NOT NULL
    CHECK (quantity > 0),
  unit          TEXT NOT NULL DEFAULT 'unit',
  status        TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT transfer_status CHECK (
      status IN (
        'pending','approved',
        'in_transit','received','cancelled'
      )
    ),
  requested_by  UUID REFERENCES staff(staff_id),
  approved_by   UUID REFERENCES staff(staff_id),
  notes         TEXT,
  requested_at  TIMESTAMPTZ NOT NULL
    DEFAULT now(),
  approved_at   TIMESTAMPTZ,
  received_at   TIMESTAMPTZ,
  CONSTRAINT transfer_distinct_stores CHECK (from_store_id <> to_store_id)
);
CREATE INDEX IF NOT EXISTS
  idx_transfers_tenant
  ON stock_transfers(tenant_id, status);
CREATE INDEX IF NOT EXISTS
  idx_transfers_stores
  ON stock_transfers(
    from_store_id, to_store_id);

-- Central product catalog flag
-- When true, product is visible in all stores
-- When false, only in its home store
-- (products have no home-store column yet, so this flag is informational for now)
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_central
    BOOLEAN NOT NULL DEFAULT true;

-- Branch daily summary (materialized nightly)
CREATE TABLE IF NOT EXISTS
  branch_daily_summary (
  summary_id    UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  store_id      UUID NOT NULL
    REFERENCES stores(store_id),
  summary_date  DATE NOT NULL,
  total_revenue_mad NUMERIC(12,2)
    NOT NULL DEFAULT 0,
  total_tx      INT NOT NULL DEFAULT 0,
  total_waste_mad NUMERIC(12,2)
    NOT NULL DEFAULT 0,
  avg_basket_mad NUMERIC(12,2)
    NOT NULL DEFAULT 0,
  top_product_id UUID,
  top_product_name_ar TEXT,
  cashier_count INT NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, store_id, summary_date)
);
CREATE INDEX IF NOT EXISTS
  idx_branch_summary_tenant
  ON branch_daily_summary(
    tenant_id, summary_date DESC);
