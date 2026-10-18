-- Product demand forecasts
-- One row per (tenant, product, store, date)
-- Updated nightly by forecasting engine.
CREATE TABLE IF NOT EXISTS demand_forecasts (
  forecast_id    UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL,
  product_id     UUID NOT NULL,
  store_id       UUID,
  forecast_date  DATE NOT NULL,
  -- Predicted quantity to sell on this date
  qty_predicted  NUMERIC(10,3) NOT NULL,
  -- Confidence interval (±)
  qty_lower      NUMERIC(10,3) NOT NULL DEFAULT 0,
  qty_upper      NUMERIC(10,3) NOT NULL DEFAULT 0,
  -- Reorder trigger: if stock < reorder_point,
  -- suggest purchasing
  reorder_point  NUMERIC(10,3) NOT NULL DEFAULT 0,
  model_version  TEXT NOT NULL DEFAULT 'v1_baseline',
  -- baseline = 7-day moving average
  --            × day-of-week factor
  --            × holiday factor
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, product_id,
          store_id, forecast_date)
);
CREATE INDEX IF NOT EXISTS
  idx_forecasts_tenant_date
  ON demand_forecasts(
    tenant_id, forecast_date, product_id);

-- Holiday confirmation log
-- Admin can confirm or correct Islamic dates
CREATE TABLE IF NOT EXISTS
  holiday_confirmations (
  confirmation_id UUID PRIMARY KEY
    DEFAULT gen_random_uuid(),
  date            DATE NOT NULL,
  confirmed_by    UUID,
  old_holiday_code TEXT,
  new_holiday_code TEXT,
  note            TEXT,
  confirmed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
