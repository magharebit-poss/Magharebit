-- ClickHouse: café orders fact table, dim_date, and nightly aggregate tables
-- Runs automatically on first container start (docker-entrypoint-initdb.d).
-- For an already-running container apply manually:
--   docker exec -i infra-clickhouse-1 clickhouse-client \
--     --user magharebit --password "$CLICKHOUSE_PASSWORD" \
--     < clickhouse/initdb/003_agg_tables.sql

-- ── CAFÉ ORDERS FACT TABLE ───────────────────────────────────────────────────
-- Grain: one row per order line in a paid café order.
-- Money fields are full MAD (NUMERIC(10,2) in PG → Float64 here).
CREATE TABLE IF NOT EXISTS magharebit_analytics.fact_cafe_orders
(
  row_id             String,
  order_id           String,
  line_id            String,
  tenant_id          String,
  store_id           Nullable(String),
  staff_id           Nullable(String),
  product_id         String,
  event_date         Date,
  event_ts           DateTime,
  quantity           Float64,
  unit_price_mad     Float64,
  modifier_total_mad Float64 DEFAULT 0,
  line_total_mad     Float64,
  covers             UInt8 DEFAULT 1,
  synced_at          DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(event_date))
ORDER BY (tenant_id, event_date, order_id, line_id)
SETTINGS index_granularity = 8192;

-- ── CALENDAR DIMENSION ───────────────────────────────────────────────────────
-- Morocco calendar (2025–2028). Populated by scripts/sync-dim-date.ts.
-- ReplacingMergeTree deduplicates on merge — safe to re-run the sync script.
CREATE TABLE IF NOT EXISTS magharebit_analytics.dim_date
(
  date            Date,
  year            UInt16,
  month           UInt8,
  day_of_week     UInt8,       -- 1=Mon…7=Sun ISO 8601
  is_weekend      UInt8,
  is_friday       UInt8,
  holiday_code    Nullable(String),
  holiday_name_ar Nullable(String),
  holiday_name_fr Nullable(String),
  is_ramadan      UInt8 DEFAULT 0,
  date_confirmed  UInt8 DEFAULT 1
) ENGINE = ReplacingMergeTree()
ORDER BY (date);

-- ── NIGHTLY AGGREGATE TABLES (SummingMergeTree) ──────────────────────────────
-- Refreshed nightly by runAggregation() in etl-runner.ts.
-- Always query these tables with FINAL or re-GROUP to get correct sums.

-- agg_product_day: revenue + unit volume per product per day
CREATE TABLE IF NOT EXISTS magharebit_analytics.agg_product_day
(
  tenant_id  String,
  product_id String,
  event_date Date,
  total_qty  Float64,
  total_mad  Float64,
  txn_count  UInt64
) ENGINE = SummingMergeTree(total_qty, total_mad, txn_count)
ORDER BY (tenant_id, product_id, event_date);

-- agg_hour: hourly transaction volume heatmap
CREATE TABLE IF NOT EXISTS magharebit_analytics.agg_hour
(
  tenant_id  String,
  event_date Date,
  hour       UInt8,   -- 0–23
  total_mad  Float64,
  txn_count  UInt64
) ENGINE = SummingMergeTree(total_mad, txn_count)
ORDER BY (tenant_id, event_date, hour);

-- agg_cashier_day: daily performance per staff member
CREATE TABLE IF NOT EXISTS magharebit_analytics.agg_cashier_day
(
  tenant_id   String,
  staff_id    String,
  event_date  Date,
  total_mad   Float64,
  txn_count   UInt64,
  items_count UInt64
) ENGINE = SummingMergeTree(total_mad, txn_count, items_count)
ORDER BY (tenant_id, staff_id, event_date);
