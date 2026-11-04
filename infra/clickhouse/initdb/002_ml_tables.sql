-- ML prediction tables — demand forecasting + waste risk
-- Runs on container first start via docker-entrypoint-initdb.d.
-- For an already-running container, apply manually:
--   docker exec -i infra-clickhouse-1 clickhouse-client \
--     --user magharebit --password "$CLICKHOUSE_PASSWORD" \
--     < clickhouse/initdb/002_ml_tables.sql

-- Demand forecasts (Holt-Winters double smoothing)
CREATE TABLE IF NOT EXISTS magharebit_analytics.ml_demand_forecasts
(
  forecast_id       String,
    -- synthetic key: tenant_id + product_id + forecast_date + horizon_days
  tenant_id         String,
  product_id        String,
  store_id          Nullable(String),
  forecast_date     Date,
    -- the date being predicted
  trained_on        Date,
    -- date the model was trained
  horizon_days      UInt8,
    -- 1, 3, or 7
  predicted_units   Float64,
  lower_bound       Float64,
    -- 80% prediction interval lower
  upper_bound       Float64,
    -- 80% prediction interval upper
  model_version     String DEFAULT '1.0',
  data_points       UInt16,
    -- number of training days used
  insufficient_data UInt8 DEFAULT 0,
    -- 1 if < 14 days data, prediction is null
  created_at        DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY (tenant_id, product_id, forecast_date, horizon_days);

-- Waste risk scores (logistic regression)
CREATE TABLE IF NOT EXISTS magharebit_analytics.ml_waste_risk
(
  risk_id                  String,
    -- synthetic key: tenant_id + lot_id + trained_on
  tenant_id                String,
  product_id               String,
  lot_id                   String,
  trained_on               Date,
  lot_age_days             Float64,
  current_stock            Float64,
  sales_velocity_7d        Float64,
    -- avg daily units sold past 7 days
  current_markdown_pct     Float64,
  waste_rate_30d           Float64,
    -- historical waste rate for this product
  waste_probability        Float64,
    -- 0-1, model output
  risk_level               String,
    -- 'low' (<0.3), 'medium' (0.3-0.6), 'high' (>0.6)
  recommended_markdown_pct Nullable(Float64),
    -- markdown pct that reduces waste_probability below 0.3; null if low risk
  days_until_waste         Nullable(Float64),
    -- estimated days until stock exhaustion at current velocity
  insufficient_data        UInt8 DEFAULT 0,
  created_at               DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(created_at)
ORDER BY (tenant_id, lot_id, trained_on);

-- Model training run log
CREATE TABLE IF NOT EXISTS magharebit_analytics.ml_training_log
(
  run_id           String,
  tenant_id        String,
  model_name       String,
    -- 'demand_forecast' or 'waste_risk'
  trained_at       DateTime,
  products_trained UInt32,
  products_skipped UInt32,
    -- insufficient data or errors
  duration_ms      UInt32,
  error            Nullable(String)
) ENGINE = MergeTree()
ORDER BY (tenant_id, model_name, trained_at);
