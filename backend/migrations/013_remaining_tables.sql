-- Migration: 013_remaining_tables
-- Creates: products, transactions, allocated_stock, pending_deductions_queue,
--          correction_events, register_heartbeats, demo_requests, apk_releases
-- Run order: must execute after 012

-- Add cashier_name_ar to shifts for denormalized health dashboard query
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS cashier_name_ar VARCHAR(255);

-- Add accepted_count and total_count to processed_batches for sync stats
ALTER TABLE processed_batches ADD COLUMN IF NOT EXISTS accepted_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE processed_batches ADD COLUMN IF NOT EXISTS total_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- PRODUCTS TABLE — catalog items (BOM and non-BOM)
-- ============================================================

CREATE TABLE products (
    product_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id    UUID NOT NULL REFERENCES tenants(id),
    plu_code     VARCHAR(20),
    barcode      VARCHAR(50),
    name_ar      VARCHAR(255) NOT NULL,
    name_fr      VARCHAR(255) NOT NULL,
    category     VARCHAR(50) NOT NULL DEFAULT 'general',
    price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
    is_bom       BOOLEAN NOT NULL DEFAULT false,
    is_weighted  BOOLEAN NOT NULL DEFAULT false,
    uom          VARCHAR(20) NOT NULL DEFAULT 'unit',
    bom_recipe   JSONB,
    is_active    BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_tenant ON products(tenant_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_plu ON products(plu_code);

-- ============================================================
-- TRANSACTIONS TABLE — sale records
-- ============================================================

CREATE TABLE transactions (
    transaction_id  UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL,
    register_id     UUID NOT NULL,
    shift_id        UUID NOT NULL,
    cashier_id      UUID NOT NULL,
    items           JSONB NOT NULL DEFAULT '[]',
    total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents >= 0),
    payment_method  VARCHAR(10) NOT NULL
                    CHECK (payment_method IN ('cash', 'card', 'lana')),
    status          VARCHAR(15) NOT NULL DEFAULT 'completed'
                    CHECK (status IN ('completed', 'voided', 'refunded')),
    client_timestamp TIMESTAMPTZ NOT NULL,
    server_received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_shift ON transactions(shift_id);
CREATE INDEX idx_transactions_tenant ON transactions(tenant_id);
CREATE INDEX idx_transactions_register ON transactions(register_id);

-- ============================================================
-- ALLOCATED STOCK — per-register soft allocation (LAW 1)
-- ============================================================

CREATE TABLE allocated_stock (
    register_id      UUID NOT NULL,
    ingredient_id    UUID NOT NULL REFERENCES ingredients(id),
    tenant_id        UUID NOT NULL,
    allocated_grams  DECIMAL(14,2) NOT NULL DEFAULT 0
                     CHECK (allocated_grams >= 0),
    last_granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    grant_version    INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (register_id, ingredient_id)
);

CREATE INDEX idx_allocated_stock_tenant ON allocated_stock(tenant_id);

-- ============================================================
-- PENDING DEDUCTIONS QUEUE — offline deductions awaiting sync
-- ============================================================

CREATE TABLE pending_deductions_queue (
    deduction_id     UUID PRIMARY KEY,
    register_id      UUID NOT NULL,
    tenant_id        UUID NOT NULL,
    ingredient_id    UUID NOT NULL REFERENCES ingredients(id),
    quantity_grams   DECIMAL(12,2) NOT NULL CHECK (quantity_grams > 0),
    transaction_id   UUID,
    shift_id         UUID,
    sync_status      VARCHAR(10) NOT NULL DEFAULT 'pending'
                     CHECK (sync_status IN ('pending', 'synced', 'rejected')),
    client_timestamp TIMESTAMPTZ NOT NULL,
    server_received_at TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pending_deductions_register ON pending_deductions_queue(register_id, sync_status);
CREATE INDEX idx_pending_deductions_tenant ON pending_deductions_queue(tenant_id);

-- ============================================================
-- CORRECTION EVENTS — adjudication corrections from backend
-- ============================================================

CREATE TABLE correction_events (
    correction_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deduction_id     UUID NOT NULL,
    register_id      UUID NOT NULL,
    tenant_id        UUID NOT NULL,
    ingredient_id    UUID NOT NULL REFERENCES ingredients(id),
    original_grams   DECIMAL(12,2) NOT NULL,
    corrected_grams  DECIMAL(12,2) NOT NULL,
    reason           VARCHAR(50) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_correction_events_register ON correction_events(register_id);

-- ============================================================
-- REGISTER HEARTBEATS — health monitoring (S4-003)
-- ============================================================

CREATE TABLE register_heartbeats (
    register_id    UUID PRIMARY KEY REFERENCES registers(register_id),
    tenant_id      UUID NOT NULL,
    last_seen      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    scale_status   TEXT NOT NULL DEFAULT 'disconnected',
    printer_status TEXT NOT NULL DEFAULT 'disconnected',
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DEMO REQUESTS — marketing form (S4-005)
-- ============================================================

CREATE TABLE demo_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name  VARCHAR(255) NOT NULL,
    country       VARCHAR(100) NOT NULL DEFAULT 'Morocco',
    store_count   INTEGER NOT NULL CHECK (store_count > 0),
    email         VARCHAR(255) NOT NULL,
    phone         VARCHAR(50),
    submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- APK RELEASES — client portal downloads (S4-006)
-- ============================================================

CREATE TABLE apk_releases (
    version         TEXT PRIMARY KEY,
    s3_key          TEXT NOT NULL,
    sha256_hash     TEXT NOT NULL,
    file_size_bytes BIGINT,
    released_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_current      BOOLEAN NOT NULL DEFAULT false,
    release_notes   TEXT
);

-- Enforces exactly one current release at the database level
CREATE UNIQUE INDEX idx_apk_releases_current
    ON apk_releases(is_current) WHERE is_current = true;
