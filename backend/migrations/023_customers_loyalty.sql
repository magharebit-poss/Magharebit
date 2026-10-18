-- 023_customers_loyalty.sql
-- Customer profiles, punch-card loyalty stamps, and tenant loyalty config.
-- Idempotent throughout.

-- ── Customer profiles ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  customer_id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            UUID        NOT NULL REFERENCES tenants(id),
  phone                TEXT        NOT NULL,
  name                 TEXT,
  notes                TEXT,
  total_visits         INTEGER     NOT NULL DEFAULT 0,
  total_spent_piastres BIGINT      NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_customers_tenant_phone
  ON customers(tenant_id, phone);

-- ── Punch-card stamps ─────────────────────────────────────────────────────────
-- One row per completed sale linked to a customer.
-- stamp_number is the sequential stamp within the current punch-card cycle.
CREATE TABLE IF NOT EXISTS loyalty_stamps (
  stamp_id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id     UUID        NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  tenant_id       UUID        NOT NULL,
  transaction_id  UUID        REFERENCES transactions(transaction_id),
  stamp_number    INTEGER     NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stamps_customer
  ON loyalty_stamps(customer_id, created_at DESC);

-- ── Tenant loyalty configuration ──────────────────────────────────────────────
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS loyalty_enabled          BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty_stamps_required  INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS loyalty_reward_description TEXT;

-- ── Link transactions to customers (nullable) ─────────────────────────────────
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(customer_id);
