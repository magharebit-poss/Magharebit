-- ClickHouse analytics schema — GreenGo POS / Magharebit
-- Runs automatically on first container start (docker-entrypoint-initdb.d).
-- All tables use the magharebit_analytics database.
-- Every row carries tenant_id for multi-tenant isolation.

CREATE DATABASE IF NOT EXISTS magharebit_analytics;

-- ── DIMENSION TABLES ──────────────────────────────────────────────────────────

-- dim_tenants
CREATE TABLE IF NOT EXISTS magharebit_analytics.dim_tenants
(
  tenant_id     String,
  name          String,
  business_type Nullable(String),
  country       String DEFAULT 'MA',
  status        String,
  updated_at    DateTime
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id);

-- dim_stores
CREATE TABLE IF NOT EXISTS magharebit_analytics.dim_stores
(
  store_id   String,
  tenant_id  String,
  name_ar    String,
  name_fr    String,
  updated_at DateTime
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, store_id);

-- dim_products
CREATE TABLE IF NOT EXISTS magharebit_analytics.dim_products
(
  product_id    String,
  tenant_id     String,
  name_ar       String,
  name_fr       String,
  category      String,
  price_mad     Float64,
  uom           String,
  is_weighted   UInt8,
  is_perishable UInt8,
  is_bom        UInt8,
  is_active     UInt8,
  updated_at    DateTime
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, product_id);

-- dim_staff
CREATE TABLE IF NOT EXISTS magharebit_analytics.dim_staff
(
  staff_id   String,
  tenant_id  String,
  name_ar    String,
  name_fr    String,
  role       String,
  is_active  UInt8,
  updated_at DateTime
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, staff_id);

-- dim_suppliers
CREATE TABLE IF NOT EXISTS magharebit_analytics.dim_suppliers
(
  supplier_id String,
  tenant_id   String,
  name        String,
  is_active   UInt8,
  updated_at  DateTime
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, supplier_id);

-- dim_lots
CREATE TABLE IF NOT EXISTS magharebit_analytics.dim_lots
(
  lot_id             String,
  tenant_id          String,
  product_id         String,
  supplier_id        Nullable(String),
  received_at        DateTime,
  quantity_received  Float64,
  unit_cost_mad      Nullable(Float64),
  is_active          UInt8,
  updated_at         DateTime
) ENGINE = ReplacingMergeTree(updated_at)
ORDER BY (tenant_id, lot_id);

-- ── FACT TABLES ───────────────────────────────────────────────────────────────

-- fact_transactions
-- Grain: one row per line item per transaction
CREATE TABLE IF NOT EXISTS magharebit_analytics.fact_transactions
(
  -- Keys
  row_id          String,
  transaction_id  String,
  tenant_id       String,
  store_id        Nullable(String),
  staff_id        Nullable(String),
  customer_id     Nullable(String),
  product_id      String,
  -- Time
  event_date      Date,
  event_ts        DateTime,
  -- Measures
  quantity        Float64,
  unit_price_mad  Float64,
  line_total_mad  Float64,
  discount_mad    Float64 DEFAULT 0,
  tax_mad         Float64 DEFAULT 0,
  net_mad         Float64,
  -- Context
  payment_method  String,
  receipt_number  String,
  -- ETL metadata
  synced_at       DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(event_date))
ORDER BY (tenant_id, event_date, transaction_id, product_id)
SETTINGS index_granularity = 8192;

-- fact_waste_records
CREATE TABLE IF NOT EXISTS magharebit_analytics.fact_waste_records
(
  row_id         String,
  waste_id       String,
  tenant_id      String,
  store_id       Nullable(String),
  staff_id       Nullable(String),
  product_id     Nullable(String),
  lot_id         Nullable(String),
  -- Time
  event_date     Date,
  event_ts       DateTime,
  -- Measures
  quantity       Float64,
  unit_cost_mad  Float64,
  total_cost_mad Float64,
  waste_reason   String,
  -- ETL metadata
  synced_at      DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(event_date))
ORDER BY (tenant_id, event_date, waste_id)
SETTINGS index_granularity = 8192;

-- fact_inventory_events
-- Grain: one row per inventory movement
CREATE TABLE IF NOT EXISTS magharebit_analytics.fact_inventory_events
(
  row_id         String,
  tenant_id      String,
  product_id     String,
  lot_id         Nullable(String),
  store_id       Nullable(String),
  -- Time
  event_date     Date,
  event_ts       DateTime,
  -- Event type
  event_type     String,
  -- Measures
  quantity_delta Float64,
  unit_cost_mad  Nullable(Float64),
  -- ETL metadata
  source_id      String,
  synced_at      DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(event_date))
ORDER BY (tenant_id, event_date, product_id, event_ts)
SETTINGS index_granularity = 8192;

-- fact_loyalty_events
CREATE TABLE IF NOT EXISTS magharebit_analytics.fact_loyalty_events
(
  row_id         String,
  stamp_id       String,
  tenant_id      String,
  customer_id    String,
  transaction_id Nullable(String),
  -- Time
  event_date     Date,
  event_ts       DateTime,
  -- Measures
  stamp_number   UInt16,
  total_visits   UInt32,
  -- ETL metadata
  synced_at      DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY (tenant_id, toYYYYMM(event_date))
ORDER BY (tenant_id, event_date, customer_id)
SETTINGS index_granularity = 8192;
