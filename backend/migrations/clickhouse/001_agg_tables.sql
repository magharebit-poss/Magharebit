-- ClickHouse aggregation tables
-- Used by etl-runner.ts runAggregation() and analytics-ch-routes.ts
-- Apply via: docker exec -i infra-clickhouse-1 clickhouse-client \
--   --user magharebit --password analyticsdev \
--   --database magharebit_analytics < 001_agg_tables.sql

-- Daily product aggregates (rebuilt every 7 days by nightly ETL)
CREATE TABLE IF NOT EXISTS agg_product_day
(
    tenant_id   String,
    product_id  String,
    event_date  Date,
    total_qty   Float64,
    total_mad   Float64,
    txn_count   UInt32
)
ENGINE = ReplacingMergeTree
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, product_id, event_date)
SETTINGS index_granularity = 8192;

-- Hourly aggregates per tenant (peak-hour heatmap)
CREATE TABLE IF NOT EXISTS agg_hour
(
    tenant_id   String,
    event_date  Date,
    hour        UInt8,
    total_mad   Float64,
    txn_count   UInt32
)
ENGINE = ReplacingMergeTree
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, event_date, hour)
SETTINGS index_granularity = 8192;

-- Daily cashier performance aggregates
CREATE TABLE IF NOT EXISTS agg_cashier_day
(
    tenant_id   String,
    staff_id    String,
    event_date  Date,
    total_mad   Float64,
    txn_count   UInt32,
    items_count UInt32
)
ENGINE = ReplacingMergeTree
PARTITION BY toYYYYMM(event_date)
ORDER BY (tenant_id, staff_id, event_date)
SETTINGS index_granularity = 8192;
