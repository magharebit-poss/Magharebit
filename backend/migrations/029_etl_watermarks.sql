-- Migration: 029_etl_watermarks
-- ETL watermark table for ClickHouse analytics pipeline.
-- Tracks the last successfully synced timestamp per table per tenant.
-- Lives in PostgreSQL (not ClickHouse). Idempotent.
-- Depends on: 007_tenants_and_licenses (tenants)

CREATE TABLE IF NOT EXISTS etl_watermarks (
  watermark_id    UUID PRIMARY KEY
                  DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL,
  table_name      TEXT NOT NULL,
    -- 'transactions', 'waste_records', 'loyalty_stamps', 'product_lots', etc.
  last_synced_at  TIMESTAMPTZ NOT NULL
                  DEFAULT '2024-01-01T00:00:00Z',
    -- Default: beginning of time for first run (syncs all historical data)
  last_run_at     TIMESTAMPTZ,
    -- When the ETL last ran for this table/tenant
  rows_synced     BIGINT NOT NULL DEFAULT 0,
    -- Running total of rows synced
  last_error      TEXT,
    -- Last error message if the run failed
  updated_at      TIMESTAMPTZ NOT NULL
                  DEFAULT NOW(),
  UNIQUE (tenant_id, table_name)
);

CREATE INDEX IF NOT EXISTS idx_watermarks_tenant
  ON etl_watermarks(tenant_id, table_name);
