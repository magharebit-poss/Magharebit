-- Anomaly alerts table
-- One row per detected anomaly event.
-- The Margin Guardian writes here in real time.
CREATE TABLE IF NOT EXISTS anomaly_alerts (
  alert_id      UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL,
  shift_id      UUID,
  cashier_id    UUID,
  alert_type    TEXT NOT NULL,
  -- 'void_spike'
  -- 'discount_over_limit'
  -- 'cash_discrepancy'
  -- 'unusual_refund'
  -- 'price_override'
  -- 'rapid_voids'   (>3 voids in 10 min)
  -- 'no_sale'       (drawer opened, no sale)
  severity      TEXT NOT NULL DEFAULT 'medium'
    CONSTRAINT severity_check CHECK (
      severity IN ('low','medium','high','critical')
    ),
  score         NUMERIC(5,2) NOT NULL DEFAULT 0,
  -- 0-100 anomaly score
  details       JSONB NOT NULL DEFAULT '{}',
  -- raw numbers that triggered the alert
  reference_id  UUID,
  -- transaction or waste id that triggered it
  acknowledged  BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by UUID,
  acknowledged_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS
  idx_alerts_tenant_shift
  ON anomaly_alerts(tenant_id, shift_id,
    created_at DESC);
CREATE INDEX IF NOT EXISTS
  idx_alerts_unack
  ON anomaly_alerts(tenant_id, acknowledged)
  WHERE acknowledged = false;

-- Cashier baseline stats (per tenant)
-- Updated nightly by ETL.
-- Used to compute z-scores in real time.
CREATE TABLE IF NOT EXISTS cashier_baselines (
  baseline_id    UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  cashier_id     UUID NOT NULL,
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Based on last 30 days of shifts
  avg_void_rate     NUMERIC(6,4) DEFAULT 0,
  std_void_rate     NUMERIC(6,4) DEFAULT 0,
  avg_discount_rate NUMERIC(6,4) DEFAULT 0,
  std_discount_rate NUMERIC(6,4) DEFAULT 0,
  avg_basket_cents  INTEGER DEFAULT 0,
  std_basket_cents  INTEGER DEFAULT 0,
  avg_tx_per_hour   NUMERIC(6,2) DEFAULT 0,
  std_tx_per_hour   NUMERIC(6,2) DEFAULT 0,
  sample_days       INTEGER DEFAULT 0,
  UNIQUE (tenant_id, cashier_id)
);
