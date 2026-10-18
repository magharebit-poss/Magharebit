-- Migration: 025_whatsapp_orders
-- Creates the whatsapp_orders table for WhatsApp order intake queue.
-- Idempotent: CREATE TABLE IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.
-- Depends on: 007 (tenants), 008 (staff), 001 (stores/customers), 023 (customers)

CREATE TABLE IF NOT EXISTS whatsapp_orders (
  order_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),

  -- Customer contact (from incoming WhatsApp message)
  customer_phone    TEXT NOT NULL,
  customer_name     TEXT,

  -- Raw intake — the customer's original WhatsApp message, stored as-is
  raw_message       TEXT NOT NULL,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Fulfillment (filled by staff)
  fulfillment_type  TEXT NOT NULL DEFAULT 'pickup'
                    CHECK (fulfillment_type IN ('pickup', 'delivery')),
  delivery_address  TEXT,
  delivery_notes    TEXT,
  scheduled_at      TIMESTAMPTZ,

  -- Payment
  payment_method    TEXT NOT NULL DEFAULT 'cash_on_delivery'
                    CHECK (payment_method IN (
                      'cash_on_delivery',
                      'virement',
                      'tpe'
                    )),
  payment_received  BOOLEAN NOT NULL DEFAULT false,

  -- Status lifecycle
  status            TEXT NOT NULL DEFAULT 'new'
                    CHECK (status IN (
                      'new',        -- just arrived from WhatsApp
                      'reviewing',  -- staff opened and is reviewing
                      'confirmed',  -- staff confirmed with customer
                      'preparing',  -- being prepared
                      'ready',      -- ready for pickup / out for delivery
                      'completed',  -- done
                      'cancelled'   -- cancelled
                    )),

  -- Links
  customer_id       UUID REFERENCES customers(customer_id),
  transaction_id    UUID REFERENCES transactions(transaction_id),
  assigned_to       UUID REFERENCES staff(staff_id),
  store_id          UUID REFERENCES stores(store_id),

  -- Audit
  notes             TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_tenant_status
  ON whatsapp_orders(tenant_id, status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_phone
  ON whatsapp_orders(tenant_id, customer_phone);
