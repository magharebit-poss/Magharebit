-- 031_customers.sql
-- Extend the existing customers table (from 023_customers_loyalty) with
-- credit-ledger columns (name_ar, name_fr, balance, credit_limit).
-- Create the credit_transactions ledger table.

-- ── Extend customers table ────────────────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS name_ar       TEXT,
  ADD COLUMN IF NOT EXISTS name_fr       TEXT,
  ADD COLUMN IF NOT EXISTS balance       NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_limit  NUMERIC(12,2) NOT NULL DEFAULT 500;

-- Backfill name_ar from existing name column where not yet set
UPDATE customers SET name_ar = name WHERE name_ar IS NULL AND name IS NOT NULL;

-- Credit transactions ledger
CREATE TABLE IF NOT EXISTS credit_transactions (
  tx_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  customer_id   UUID NOT NULL
                REFERENCES customers(customer_id)
                ON DELETE CASCADE,
  shift_id      UUID REFERENCES shifts(shift_id),
  staff_id      UUID REFERENCES staff(staff_id),
  type          TEXT NOT NULL
                CONSTRAINT tx_type_check CHECK (
                  type IN ('charge', 'payment', 'adjustment')
                ),
  amount        NUMERIC(12,2) NOT NULL,
  balance_after NUMERIC(12,2) NOT NULL,
  note          TEXT,
  sale_id       UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_tx_customer
  ON credit_transactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_tx_shift
  ON credit_transactions(shift_id);
CREATE INDEX IF NOT EXISTS idx_credit_tx_tenant
  ON credit_transactions(tenant_id);

-- Seed 3 test customers for tenant 1111...
-- The existing unique constraint is (tenant_id, phone)
INSERT INTO customers (
  customer_id, tenant_id,
  name_ar, name_fr, phone,
  balance, credit_limit
) VALUES
(
  'c0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'محمد الأمين', 'Mohammed Amine',
  '0661234567', 0, 500
),
(
  'c0000001-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'فاطمة الزهراء', 'Fatima Zahra',
  '0662345678', 75.50, 300
),
(
  'c0000001-0000-0000-0000-000000000003',
  '11111111-1111-1111-1111-111111111111',
  'يوسف بنموسى', 'Youssef Benmousa',
  '0663456789', 120.00, 500
)
ON CONFLICT (tenant_id, phone) DO NOTHING;
