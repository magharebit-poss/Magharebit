-- ClickHouse ML tables
-- Written by model-trainer.ts via ch-exec.ts insertChRows()
-- Apply via: docker exec -i infra-clickhouse-1 clickhouse-client \
--   --user magharebit --password analyticsdev \
--   --database magharebit_analytics < 002_ml_tables.sql
-- NOTE: Tables already exist in production (created in prior session).
--       This file documents the canonical schema for idempotent re-runs.

-- Demand forecasts (Holt-Winters double exponential smoothing)
CREATE TABLE IF NOT EXISTS ml_demand_forecasts
(
    forecast_id        String,
    tenant_id          String,
    product_id         String,
    store_id           Nullable(String),
    forecast_date      Date,
    trained_on         Date,
    horizon_days       UInt8,
    predicted_units    Float64,
    lower_bound        Float64,
    upper_bound        Float64,
    model_version      String DEFAULT '1.0',
    data_points        UInt16,
    insufficient_data  UInt8  DEFAULT 0,
    created_at         DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(created_at)
ORDER BY (tenant_id, product_id, forecast_date, horizon_days)
SETTINGS index_granularity = 8192;

-- Waste risk scores (logistic regression per lot)
CREATE TABLE IF NOT EXISTS ml_waste_risk
(
    risk_id                  String,
    tenant_id                String,
    product_id               String,
    lot_id                   String,
    trained_on               Date,
    lot_age_days             Float64,
    current_stock            Float64,
    sales_velocity_7d        Float64,
    current_markdown_pct     Float64,
    waste_rate_30d           Float64,
    waste_probability        Float64,
    risk_level               String,
    recommended_markdown_pct Nullable(Float64),
    days_until_waste         Nullable(Float64),
    insufficient_data        UInt8 DEFAULT 0,
    created_at               DateTime DEFAULT now()
)
ENGINE = ReplacingMergeTree(created_at)
ORDER BY (tenant_id, lot_id, trained_on)
SETTINGS index_granularity = 8192;

-- ML training run log
CREATE TABLE IF NOT EXISTS ml_training_log
(
    run_id            String,
    tenant_id         String,
    model_name        String,
    trained_at        DateTime,
    products_trained  UInt32,
    products_skipped  UInt32,
    duration_ms       UInt32,
    error             Nullable(String)
)
ENGINE = MergeTree
ORDER BY (tenant_id, model_name, trained_at)
SETTINGS index_granularity = 8192;
