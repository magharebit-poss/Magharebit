-- Migration: 027_kds_orders
-- Creates the kds_orders table for the Kitchen Display System.
-- Aggregates walk-in and WhatsApp orders into a unified kitchen queue.
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
-- Depends on: 007 (tenants), 013 (stores), 025 (whatsapp_orders), 004 (transactions)

CREATE TABLE IF NOT EXISTS kds_orders (
  kds_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  store_id          UUID REFERENCES stores(store_id),

  -- Source tracking
  source            TEXT NOT NULL
                    CHECK (source IN ('whatsapp', 'walkin')),
  whatsapp_order_id UUID REFERENCES whatsapp_orders(order_id) ON DELETE CASCADE,
  transaction_id    UUID REFERENCES transactions(transaction_id) ON DELETE CASCADE,

  -- Order content (denormalized for fast KDS reads)
  -- Array of { name_ar, name_fr, quantity, notes, category }
  items_json        JSONB NOT NULL,
  customer_name     TEXT,
  customer_phone    TEXT,
  order_notes       TEXT,

  -- Status
  kds_status        TEXT NOT NULL DEFAULT 'new'
                    CHECK (kds_status IN ('new', 'preparing', 'ready', 'done')),

  -- Timing
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMPTZ,   -- when kitchen tapped Start
  ready_at          TIMESTAMPTZ,   -- when kitchen tapped Ready
  done_at           TIMESTAMPTZ,

  -- Fulfillment context
  fulfillment_type  TEXT CHECK (fulfillment_type IN ('pickup', 'delivery', 'table', 'takeaway')),
  table_number      TEXT,          -- for dine-in orders

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kds_tenant_status
  ON kds_orders(tenant_id, kds_status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_kds_store
  ON kds_orders(store_id, kds_status);
