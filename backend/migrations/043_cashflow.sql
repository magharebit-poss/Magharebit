-- 043_cashflow.sql — Cash flow snapshots and upcoming obligations tables

CREATE TABLE IF NOT EXISTS cashflow_snapshots (
  snapshot_id   UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  snapshot_date DATE NOT NULL,
  sales_mad     NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_collected_mad
                NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_inflow_mad
                NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_inflow_mad NUMERIC(12,2)
    GENERATED ALWAYS AS
    (sales_mad + credit_collected_mad
     + other_inflow_mad) STORED,
  supplier_paid_mad
                NUMERIC(12,2) NOT NULL DEFAULT 0,
  waste_cost_mad
                NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_outflow_mad
                NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_outflow_mad NUMERIC(12,2)
    GENERATED ALWAYS AS
    (supplier_paid_mad + waste_cost_mad
     + other_outflow_mad) STORED,
  net_mad       NUMERIC(12,2)
    GENERATED ALWAYS AS
    (sales_mad + credit_collected_mad
     + other_inflow_mad
     - supplier_paid_mad - waste_cost_mad
     - other_outflow_mad) STORED,
  running_balance_mad
                NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, snapshot_date)
);
CREATE INDEX IF NOT EXISTS
  idx_cashflow_tenant_date
  ON cashflow_snapshots(
    tenant_id, snapshot_date DESC);

CREATE TABLE IF NOT EXISTS upcoming_obligations (
  obligation_id UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  due_date      DATE NOT NULL,
  supplier_id   UUID NOT NULL,
  supplier_name_ar TEXT NOT NULL,
  invoice_id    UUID,
  amount_mad    NUMERIC(12,2) NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
    CONSTRAINT oblig_status CHECK (
      status IN ('pending','paid','overdue')
    ),
  days_until_due INT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, invoice_id)
);
CREATE INDEX IF NOT EXISTS
  idx_obligations_tenant_due
  ON upcoming_obligations(
    tenant_id, due_date, status);
